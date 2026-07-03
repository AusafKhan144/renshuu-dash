"""FastAPI app: setup wizard endpoints + dashboard data API.

Also serves the built SPA (frontend/dist) so the whole thing runs at one URL in
production. The background poller is started/stopped in the lifespan.
"""

import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import analytics  # noqa: E402
import auth  # noqa: E402
import db  # noqa: E402
import gamification  # noqa: E402
import notifier  # noqa: E402
import poller  # noqa: E402
import push  # noqa: E402
import settings  # noqa: E402
import term_sync  # noqa: E402
from config import DEV_ORIGINS, FRONTEND_DIST  # noqa: E402
from renshuu_client import (  # noqa: E402
    add_word_to_list,
    get_grammar_detail,
    get_list_words,
    get_lists,
    get_reibun,
    get_schedules,
    remove_word_from_list,
    search_grammar,
    search_kanji,
    search_word,
)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("renshu.app")

# Tiny in-memory cache for the live /schedules call (avoid hammering the API).
_schedules_cache = {"at": 0.0, "data": None}
SCHEDULES_TTL = 300  # 5 min

# Same pattern, generalized, for the lists index/detail lookups below.
_cache: dict = {}
CACHE_TTL = 300  # 5 min


def _cached(key: str, compute):
    now = time.time()
    entry = _cache.get(key)
    if entry and now - entry["at"] < CACHE_TTL:
        return entry["data"]
    data = compute()
    _cache[key] = {"at": now, "data": data}
    return data


def _invalidate_cache(prefix: str):
    for k in [k for k in _cache if k.startswith(prefix)]:
        del _cache[k]


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    settings.bootstrap_from_env()
    poller.start_scheduler()
    yield
    poller.stop_scheduler()


app = FastAPI(title="Renshuu Progress Dashboard", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=DEV_ORIGINS,
    allow_credentials=True,  # session cookie must ride cross-origin in dev
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- request models -------------------------------------------------------

class KeyIn(BaseModel):
    api_key: str


class LoginIn(BaseModel):
    password: str


class DailyGoalIn(BaseModel):
    goal: int


class PushSubscriptionIn(BaseModel):
    subscription: dict


class PushUnsubscribeIn(BaseModel):
    endpoint: str


# --- auth endpoints (unprotected) -----------------------------------------

@app.get("/api/auth/status")
def auth_status(renshu_session: str | None = Cookie(default=None)):
    return {
        "auth_required": auth.auth_required(),
        "authenticated": auth.is_valid_session(renshu_session),
    }


@app.post("/api/auth/login")
def auth_login(body: LoginIn, response: Response):
    if not auth.check_password(body.password):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    auth.set_session_cookie(response)
    return {"ok": True}


@app.post("/api/auth/logout")
def auth_logout(response: Response):
    auth.clear_session_cookie(response)
    return {"ok": True}


# --- protected API router -------------------------------------------------
# Everything that exposes data or mutates settings requires a valid session.
api = APIRouter(prefix="/api", dependencies=[Depends(auth.require_auth)])


# --- setup endpoints ------------------------------------------------------

@api.get("/setup/status")
def setup_status():
    return {
        "configured": settings.is_configured(),
        "push_enabled": push.enabled(),
        "daily_goal": settings.get_daily_goal(),
        "account": settings.account_summary(),
        "digest_enabled": settings.digest_enabled(),
        "streak_check_enabled": settings.streak_check_enabled(),
    }


@api.post("/setup/key")
def setup_key(body: KeyIn):
    ok, profile = settings.save_api_key(body.api_key)
    if not ok:
        raise HTTPException(status_code=400, detail="Invalid Renshuu API key.")
    # Seed a baseline snapshot so charts aren't empty on day 1.
    poller.seed_initial_snapshots()
    return {
        "ok": True,
        "account": {
            "name": profile.get("real_name"),
            "id": profile.get("id"),
            "level": profile.get("adventure_level"),
        },
    }


@api.post("/setup/daily-goal")
def setup_daily_goal(body: DailyGoalIn):
    settings.set_daily_goal(body.goal)
    return {"ok": True, "daily_goal": settings.get_daily_goal()}


class ToggleIn(BaseModel):
    on: bool


@api.post("/setup/digest")
def setup_digest_toggle(body: ToggleIn):
    settings.set_digest_enabled(body.on)
    return {"ok": True, "digest_enabled": settings.digest_enabled()}


@api.post("/setup/streak-check")
def setup_streak_check_toggle(body: ToggleIn):
    settings.set_streak_check_enabled(body.on)
    return {"ok": True, "streak_check_enabled": settings.streak_check_enabled()}


# --- push notifications ---------------------------------------------------

@api.get("/push/vapid-key")
def push_vapid_key():
    return {"public_key": push.public_key()}


@api.post("/push/subscribe")
def push_subscribe(body: PushSubscriptionIn):
    if not push.save_subscription(body.subscription):
        raise HTTPException(status_code=400, detail="Invalid push subscription.")
    return {"ok": True}


@api.post("/push/unsubscribe")
def push_unsubscribe(body: PushUnsubscribeIn):
    push.remove_subscription(body.endpoint)
    return {"ok": True}


@api.post("/push/test")
def push_test():
    ok = notifier.send_text(
        "✅ Notifications are on! You'll get a nudge here when reviews are due.",
        kind="test",
    )
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Could not send. Enable notifications on this device first.",
        )
    return {"ok": True}


# --- data endpoints -------------------------------------------------------

def _require_configured():
    if not settings.is_configured():
        raise HTTPException(status_code=409, detail="Not configured yet.")


@api.get("/overview")
def overview():
    _require_configured()
    latest = db.latest_profile_snapshot()
    week_ago = db.profile_snapshot_n_days_ago(7)
    if not latest:
        # No snapshot yet (e.g. just configured) - grab one now.
        profile = poller.snapshot_profile()
        latest = db.latest_profile_snapshot() or {}

    def delta(field):
        if latest and week_ago and latest.get(field) is not None and week_ago.get(field) is not None:
            return latest[field] - week_ago[field]
        return None

    stats = gamification.current_stats()
    reviews_due = db.latest_total_review_due()
    xp = gamification.compute_xp(stats)
    level = gamification.level_info(xp)
    daily_goal = settings.get_daily_goal()
    analytics_summary = _analytics_summary()

    return {
        "account_name": (settings.account_summary() or {}).get("name"),
        "totals": {
            "total": latest.get("total"),
            "vocab": latest.get("total_vocab"),
            "kanji": latest.get("total_kanji"),
            "grammar": latest.get("total_grammar"),
            "sentences": latest.get("total_sent"),
        },
        "weekly_delta": {
            "total": delta("total"),
            "vocab": delta("total_vocab"),
            "kanji": delta("total_kanji"),
            "grammar": delta("total_grammar"),
            "sentences": delta("total_sent"),
        },
        "streaks": _json(latest.get("streak_json")),
        "jlpt": _json(latest.get("level_percs_json")),
        "level": level["level"],
        "level_title": level["title"],
        "adventure_level": latest.get("adventure_level"),
        "kao_url": latest.get("kao_url"),
        "xp": level["xp"],
        "daily": {"goal": daily_goal, "progress": db.learned_today(), "reviews_due": reviews_due},
        "insights": gamification.build_insights(stats, reviews_due, analytics_summary),
        "as_of": latest.get("ts"),
    }


def _analytics_summary() -> dict:
    """Best-effort synced-term analytics for the insights feed — returns {} if
    no terms have been synced yet, so /api/overview never depends on it."""
    try:
        leeches = analytics.leeches(limit=1000)
        vectors = analytics.vector_accuracy()
        risk = analytics.forgetting_risk()
        return {
            "leech_count": len(leeches),
            "weakest_vector": vectors[0]["name"] if vectors else None,
            "overdue_count": risk["overdue_count"],
            "nearest_eta": analytics.nearest_pace_eta(),
        }
    except Exception:  # noqa: BLE001 - insights are best-effort, never break overview
        return {}


@api.get("/achievements")
def achievements():
    _require_configured()
    return {"achievements": gamification.sync_and_list(gamification.current_stats())}


@api.post("/achievements/{achievement_id}/claim")
def claim_achievement(achievement_id: str):
    _require_configured()
    if not db.mark_claimed(achievement_id):
        raise HTTPException(status_code=404, detail="Achievement not earned yet.")
    return {"ok": True}


@api.get("/schedules")
def schedules():
    _require_configured()
    now = time.time()
    if _schedules_cache["data"] and now - _schedules_cache["at"] < SCHEDULES_TTL:
        return _schedules_cache["data"]
    raw = get_schedules(settings.get_api_key())
    data = {
        "schedules": [
            {
                "id": str(s.get("id")),
                "name": s.get("name"),
                "booktype": s.get("booktype"),
                "review_due": int((s.get("today") or {}).get("review", 0) or 0),
                "new_available": int((s.get("today") or {}).get("new", 0) or 0),
                "terms": s.get("terms", {}),
                "upcoming": s.get("upcoming", []),
            }
            for s in raw
        ]
    }
    data["total_review_due"] = sum(s["review_due"] for s in data["schedules"])
    _schedules_cache.update(at=now, data=data)
    return data


@api.get("/lookup")
def lookup(type: Literal["word", "kanji", "grammar"], q: str):
    """On-demand dictionary search (live Renshuu call — advances daily usage)."""
    _require_configured()
    q = q.strip()
    if not q:
        raise HTTPException(status_code=400, detail="q is required.")
    api_key = settings.get_api_key()

    if type == "word":
        word, note = search_word(api_key, q)
        return {"type": "word", "found": word is not None, "word": word, "note": note}

    if type == "kanji":
        data, err = search_kanji(api_key, q)
        if data is None:
            return {"type": "kanji", "found": False, "available": False, "error": err}
        kanjis = data.get("kanjis", [])
        return {"type": "kanji", "found": bool(kanjis), "available": True, "kanjis": kanjis}

    data, err = search_grammar(api_key, q)
    if data is None:
        return {"type": "grammar", "found": False, "available": False, "error": err}
    grammar = data.get("grammar", [])
    return {"type": "grammar", "found": bool(grammar), "available": True, "grammar": grammar}


@api.get("/lists")
def lists_index():
    _require_configured()

    def compute():
        raw = get_lists(settings.get_api_key())
        out = []
        for tg in raw.get("termtype_groups", []):
            for g in tg.get("groups", []):
                for entry in g.get("lists", []):
                    out.append({
                        "id": entry.get("list_id"),
                        "title": entry.get("title"),
                        "termtype": entry.get("termtype"),
                        "description": entry.get("description"),
                        "privacy": entry.get("privacy"),
                    })
        return {"lists": out}

    return _cached("lists", compute)


@api.get("/lists/{list_id}")
def list_detail(list_id: str, page: int = 1):
    _require_configured()

    def compute():
        data, err = get_list_words(settings.get_api_key(), list_id, page)
        if err:
            raise HTTPException(status_code=502, detail=f"Renshuu list lookup failed: {err}")
        contents = data.get("contents", {}) or {}
        words = [
            {
                "id": t.get("id"),
                "kanji_full": t.get("kanji_full"),
                "hiragana_full": t.get("hiragana_full"),
                "def": t.get("def"),
                "mastery": int(float((t.get("user_data") or {}).get("mastery_avg_perc") or 0)),
            }
            for t in contents.get("terms", []) or []
        ]
        return {
            "id": list_id,
            "title": data.get("title"),
            "termtype": data.get("termtype"),
            "page": contents.get("pg", page),
            "total_pages": contents.get("total_pg", 1),
            "words": words,
        }

    return _cached(f"list:{list_id}:{page}", compute)


class SaveWordIn(BaseModel):
    word_id: str


@api.post("/lists/{list_id}/words")
def save_word(list_id: str, body: SaveWordIn):
    _require_configured()
    ok, status = add_word_to_list(settings.get_api_key(), body.word_id, list_id)
    if not ok:
        raise HTTPException(status_code=502, detail=f"Renshuu rejected the save (HTTP {status}).")
    _invalidate_cache(f"list:{list_id}")
    _invalidate_cache("lists")
    return {"ok": True}


@api.delete("/lists/{list_id}/words/{word_id}")
def delete_word(list_id: str, word_id: str):
    _require_configured()
    ok, status = remove_word_from_list(settings.get_api_key(), word_id, list_id)
    if not ok:
        raise HTTPException(
            status_code=502,
            detail=f"Renshuu couldn't remove that word (HTTP {status}). It may not support removal.",
        )
    _invalidate_cache(f"list:{list_id}")
    _invalidate_cache("lists")
    return {"ok": True}


@api.get("/spotlight")
def spotlight():
    """Snapshot-backed: words captured during the daily poll (no live call)."""
    _require_configured()
    return {"words": db.latest_spotlight()}


@api.get("/kana")
def kana():
    """Snapshot-backed per-kana/kanji mastery, with a weekly-delta arrow."""
    _require_configured()
    latest = db.latest_kana_mastery()
    week_ago = db.kana_mastery_n_days_ago(7)
    sections = {}
    for section, chars in latest.items():
        prior = week_ago.get(section, {})
        sections[section] = [
            {
                "char": char,
                "score": info["score"],
                "delta": (info["score"] - prior[char]) if char in prior else None,
                "detail": info["detail"],
            }
            for char, info in chars.items()
        ]
    return {"sections": sections}


@api.get("/usage")
def api_usage():
    """Renshuu's own daily usage counter — for the sidebar footer and the
    refresh confirm dialog. No live call; reads the last captured value."""
    latest = db.latest_api_usage()
    if not latest:
        return {"calls_today": None, "daily_allowance": 500, "remaining": None, "ts": None}
    calls_today = latest["calls_today"] or 0
    allowance = latest["daily_allowance"] or 500
    return {**latest, "remaining": max(0, allowance - calls_today)}


@api.get("/history")
def history(metric: str = "total_vocab", days: int = 30):
    _require_configured()
    try:
        points = db.profile_history(metric, days)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"metric": metric, "days": days, "points": points}


@api.get("/activity")
def activity(days: int = 30):
    """Newly-learned terms per day, derived from stored schedule snapshots.

    Reads only from SQLite (no Renshuu call). Backfills as daily snapshots
    accumulate, like /api/history.
    """
    _require_configured()
    return {"days": days, "points": db.daily_activity(days)}


@api.post("/refresh")
def refresh():
    """Full on-demand refresh: everything the daily poll captures, run now."""
    _require_configured()
    profile = poller.snapshot_profile()
    result = poller.poll_schedules(notify=False)
    poller.snapshot_kana_mastery()
    poller.snapshot_spotlight()
    _schedules_cache["data"] = None  # invalidate cache
    return {"ok": True, "schedules": result}


@api.get("/analytics/retention")
def analytics_retention():
    _require_configured()
    return analytics.retention()


@api.get("/analytics/vectors")
def analytics_vectors(termtype: str | None = None):
    _require_configured()
    return {"vectors": analytics.vector_accuracy(termtype)}


@api.get("/analytics/leeches")
def analytics_leeches(termtype: str | None = None, limit: int = 20):
    _require_configured()
    return {"leeches": analytics.leeches(termtype, limit)}


@api.get("/analytics/risk")
def analytics_risk(days: int = 7):
    _require_configured()
    return analytics.forgetting_risk(days)


@api.get("/analytics/jlpt")
def analytics_jlpt():
    _require_configured()
    return analytics.jlpt_breakdown()


@api.get("/analytics/pace")
def analytics_pace():
    _require_configured()
    return {"per_termtype": analytics.pace_forecast()}


@api.get("/analytics/workload")
def analytics_workload(days: int = 14):
    _require_configured()
    return {"days": days, "points": analytics.workload(days)}


@api.get("/history/jlpt")
def history_jlpt(level: str = "n5", cat: str = "vocab", days: int = 90):
    _require_configured()
    return {"cat": cat, "level": level, "days": days, "points": db.jlpt_history(cat, level, days)}


@api.get("/grammar/{grammar_id}")
def grammar_detail(grammar_id: str):
    """Live grammar-point detail (construct image, model sentences), cached
    30 days — this is a live Renshuu call the first time, free thereafter."""
    _require_configured()
    key = f"grammar:{grammar_id}"
    cached = db.cache_get(key, ttl_days=30)
    if cached is not None:
        return cached
    data, err = get_grammar_detail(settings.get_api_key(), grammar_id)
    if err:
        raise HTTPException(status_code=502, detail=f"Renshuu grammar lookup failed: {err}")
    db.cache_put(key, data)
    return data


@api.get("/sentences")
def sentences(word_id: str | None = None, q: str | None = None):
    """Live example-sentence lookup by word id or free text, cached 30 days."""
    _require_configured()
    if not word_id and not q:
        raise HTTPException(status_code=400, detail="word_id or q is required.")
    key = f"reibun:word:{word_id}" if word_id else f"reibun:q:{q}"
    cached = db.cache_get(key, ttl_days=30)
    if cached is not None:
        return cached
    data, err = get_reibun(settings.get_api_key(), word_id=word_id, value=q)
    if err:
        raise HTTPException(status_code=502, detail=f"Renshuu example-sentence lookup failed: {err}")
    db.cache_put(key, data)
    return data


@api.get("/terms")
def terms_index(
    termtype: str | None = None,
    jlpt: str | None = None,
    sort: Literal["mastery", "missed", "recent", "display"] = "mastery",
    q: str | None = None,
    page: int = 1,
):
    """Paged, filterable term list backed entirely by the synced SQLite terms
    table (no live Renshuu call)."""
    _require_configured()
    rows = db.latest_term_mastery(termtype)
    if jlpt:
        rows = [r for r in rows if (r.get("jlpt") or "").lower() == jlpt.lower()]
    if q:
        needle = q.strip().lower()
        rows = [
            r for r in rows
            if needle in (r.get("display") or "").lower()
            or needle in (r.get("reading") or "").lower()
            or needle in (r.get("definition") or "").lower()
        ]

    if sort == "mastery":
        rows.sort(key=lambda r: r.get("mastery") or 0)
    elif sort == "missed":
        rows.sort(key=lambda r: r.get("missed") or 0, reverse=True)
    elif sort == "recent":
        rows.sort(key=lambda r: r.get("day") or "", reverse=True)
    else:
        rows.sort(key=lambda r: r.get("display") or "")

    per_page = 50
    total = len(rows)
    start = (max(1, page) - 1) * per_page
    page_rows = rows[start:start + per_page]

    return {
        "page": page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
        "total": total,
        "terms": [
            {
                "termtype": r["termtype"], "term_id": r["term_id"], "display": r["display"],
                "reading": r["reading"], "definition": r["definition"], "jlpt": r["jlpt"],
                "mastery": r.get("mastery") or 0, "correct": r.get("correct") or 0,
                "missed": r.get("missed") or 0,
            }
            for r in page_rows
        ],
    }


@api.get("/terms/{termtype}/{term_id}")
def term_detail(termtype: str, term_id: str):
    _require_configured()
    row = db.get_term(termtype, term_id)
    if not row:
        raise HTTPException(status_code=404, detail="Term not found.")
    return {
        "termtype": row["termtype"],
        "term_id": row["term_id"],
        "display": row["display"],
        "reading": row["reading"],
        "definition": row["definition"],
        "jlpt": row["jlpt"],
        "mastery": row.get("mastery") or 0,
        "correct": row.get("correct") or 0,
        "missed": row.get("missed") or 0,
        "vectors": row.get("vectors") or {},
        "payload": row.get("payload") or {},
        "history": db.term_mastery_history(termtype, term_id),
    }


@api.post("/sync/terms")
def sync_terms():
    """Full per-term sync, run on demand (Settings page button). Resumable:
    returns complete=False with calls_used if the daily quota ran out mid-sync."""
    _require_configured()
    result = term_sync.run_sync()
    return result


@api.get("/kao/history")
def kao_history():
    """Kao's growth timeline: distinct mascot images captured across daily
    profile snapshots, each with the date and adventure level it first appeared."""
    _require_configured()
    return {"history": db.kao_history()}


def _json(s):
    import json
    if not s:
        return {}
    try:
        return json.loads(s)
    except (TypeError, ValueError):
        return {}


# Register the protected API routes (after all are attached, before the SPA).
app.include_router(api)


# --- serve the SPA (must be last) -----------------------------------------

if os.path.isdir(FRONTEND_DIST):
    assets = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets):
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        # Serve known files; otherwise fall back to index.html (client routing).
        candidate = os.path.join(FRONTEND_DIST, full_path)
        if full_path and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
