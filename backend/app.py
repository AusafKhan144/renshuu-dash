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

from fastapi import APIRouter, Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import auth  # noqa: E402
import db  # noqa: E402
import notifier  # noqa: E402
import poller  # noqa: E402
import settings  # noqa: E402
from config import DEV_ORIGINS, FRONTEND_DIST  # noqa: E402
from renshuu_client import get_schedules  # noqa: E402

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("renshu.app")

# Tiny in-memory cache for the live /schedules call (avoid hammering the API).
_schedules_cache = {"at": 0.0, "data": None}
SCHEDULES_TTL = 300  # 5 min


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


class WebhookIn(BaseModel):
    webhook: str


class LoginIn(BaseModel):
    password: str


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
        "webhook_set": bool(settings.get_webhook()),
        "account": settings.account_summary(),
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


@api.post("/setup/webhook")
def setup_webhook(body: WebhookIn):
    settings.save_webhook(body.webhook)
    return {"ok": True, "webhook_set": bool(settings.get_webhook())}


@api.post("/setup/test-notify")
def setup_test_notify():
    ok = notifier.send_text(
        "✅ Renshuu Dashboard connected! You'll get review reminders here.",
        kind="test",
    )
    if not ok:
        raise HTTPException(
            status_code=400,
            detail="Could not send. Check the webhook URL is set and correct.",
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

    return {
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
        "as_of": latest.get("ts"),
    }


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
    _require_configured()
    profile = poller.snapshot_profile()
    result = poller.poll_schedules(notify=False)
    _schedules_cache["data"] = None  # invalidate cache
    return {"ok": True, "schedules": result}


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
