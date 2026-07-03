"""Retention & weakness analytics — pure functions over the synced SQLite term
data (see term_sync.py). Zero live API calls; everything here reads from
`terms` / `term_mastery_daily` / `mastery_daily_agg`, so it's safe to call on
every page load.
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone

import db

TERMTYPES = ("vocab", "kanji", "grammar", "sent")

# Canonical JLPT term-count targets used for pace forecasting (Phase 3) and as
# a rough denominator for "how much of N5 kanji have I seen" style framing.
JLPT_TARGETS = {
    "vocab":   {"n5": 670,  "n4": 640,  "n3": 3750, "n2": 3000, "n1": 6000},
    "kanji":   {"n5": 80,   "n4": 170,  "n3": 370,  "n2": 380,  "n1": 1130},
    "grammar": {"n5": 60,   "n4": 60,   "n3": 90,   "n2": 90,   "n1": 100},
    "sent":    {"n5": 100,  "n4": 100,  "n3": 100,  "n2": 100,  "n1": 100},
}


def _date_token(s: str | None):
    """Parse Renshuu's `next_quiz`/`last_quizzed` tokens ("2026/07/03", "Now",
    "Not yet") into a date, or None if there's no concrete date."""
    if not s or s in ("Not yet", "Now"):
        return None
    try:
        return datetime.strptime(s.strip(), "%Y/%m/%d").replace(tzinfo=timezone.utc).date()
    except ValueError:
        return None


# --- retention & histogram --------------------------------------------------

def retention() -> dict:
    """Per-termtype: latest mastery histogram + avg, and a trend series."""
    out = {}
    for termtype in TERMTYPES:
        latest = db.latest_mastery_agg(termtype)
        history = db.mastery_agg_history(termtype, days=60)
        out[termtype] = {
            "total": latest["total"] if latest else 0,
            "avg_mastery": round(latest["avg_mastery"], 1) if latest else 0,
            "histogram": {
                "0-19": latest["b0"] if latest else 0,
                "20-39": latest["b20"] if latest else 0,
                "40-59": latest["b40"] if latest else 0,
                "60-79": latest["b60"] if latest else 0,
                "80-100": latest["b80"] if latest else 0,
            } if latest else None,
            "trend": [{"day": h["day"], "avg_mastery": round(h["avg_mastery"], 1)} for h in history],
        }
    return out


# --- per-study-mode (vector) accuracy --------------------------------------

def vector_accuracy(termtype: str | None = None) -> list:
    """Aggregate study_vectors across all latest-known term mastery rows into
    per-mode {name, correct, missed, accuracy_pct}, worst-accuracy first."""
    rows = db.latest_term_mastery(termtype)
    agg: dict[str, dict] = {}
    for r in rows:
        for name, v in (r.get("vectors") or {}).items():
            bucket = agg.setdefault(name, {"correct": 0, "missed": 0})
            bucket["correct"] += int(v.get("correct_count") or 0)
            bucket["missed"] += int(v.get("missed_count") or 0)
    out = []
    for name, b in agg.items():
        total = b["correct"] + b["missed"]
        if total == 0:
            continue
        out.append({
            "name": name,
            "correct": b["correct"],
            "missed": b["missed"],
            "accuracy_pct": round(b["correct"] / total * 100, 1),
        })
    out.sort(key=lambda v: v["accuracy_pct"])
    return out


# --- leeches (persistently-missed terms) -----------------------------------

def leeches(termtype: str | None = None, limit: int = 20) -> list:
    """Terms that keep getting missed: missed>=5, mastery<50, attempted>=10,
    scored by missed*(100-mastery) so the worst offenders sort first."""
    rows = db.latest_term_mastery(termtype)
    scored = []
    for r in rows:
        mastery = r.get("mastery") or 0
        correct = r.get("correct") or 0
        missed = r.get("missed") or 0
        if missed >= 5 and mastery < 50 and (correct + missed) >= 10:
            scored.append({
                "termtype": r["termtype"],
                "term_id": r["term_id"],
                "display": r["display"],
                "reading": r["reading"],
                "definition": r["definition"],
                "jlpt": r["jlpt"],
                "mastery": mastery,
                "correct": correct,
                "missed": missed,
                "score": missed * (100 - mastery),
            })
    scored.sort(key=lambda s: s["score"], reverse=True)
    return scored[:limit]


# --- forgetting risk (overdue / due-soon reviews) --------------------------

def forgetting_risk(days: int = 7) -> dict:
    """Terms whose study_vectors show a next_quiz date that's already passed
    (overdue) or falls within `days` (due-soon), weighted toward low mastery."""
    today = datetime.now(timezone.utc).date()
    horizon = today + timedelta(days=days)
    rows = db.latest_term_mastery(None)

    overdue, due_soon = [], []
    for r in rows:
        mastery = r.get("mastery") or 0
        nearest = None
        for v in (r.get("vectors") or {}).values():
            d = _date_token(v.get("next_quiz"))
            if d and (nearest is None or d < nearest):
                nearest = d
        if nearest is None:
            continue
        entry = {
            "termtype": r["termtype"],
            "term_id": r["term_id"],
            "display": r["display"],
            "jlpt": r["jlpt"],
            "mastery": mastery,
            "next_quiz": nearest.isoformat(),
        }
        if nearest < today:
            overdue.append(entry)
        elif nearest <= horizon:
            due_soon.append(entry)

    overdue.sort(key=lambda e: e["mastery"])
    due_soon.sort(key=lambda e: (e["next_quiz"], e["mastery"]))
    return {
        "overdue": overdue[:50],
        "overdue_count": len(overdue),
        "due_soon": due_soon[:50],
        "due_soon_count": len(due_soon),
    }


# --- JLPT breakdown (term-level, finer than the profile-level percs) -------

# --- pace / JLPT-completion forecasting ------------------------------------

EWMA_ALPHA = 0.3


def _ewma(diffs: list[float]) -> float:
    pace = diffs[0]
    for d in diffs[1:]:
        pace = EWMA_ALPHA * d + (1 - EWMA_ALPHA) * pace
    return pace


def pace_forecast() -> dict:
    """Per termtype x JLPT level: studied count (from profile coverage % x the
    canonical JLPT term-count target), a learning pace (terms/day), and a
    projected completion date.

    Pace is an EWMA of day-over-day growth in the level's studied-count,
    derived from `level_progress_percs` history (the daily profile snapshot
    already stores this). With fewer than 2 days of that history — a fresh
    install — it falls back to the overall recent daily_activity() rate as a
    rough, termtype-agnostic stand-in until per-level history builds up.
    """
    history = db.profile_level_history(90)
    retention_data = retention()
    today = datetime.now(timezone.utc).date()

    fallback_pace = None
    recent = db.daily_activity(14)
    if recent:
        fallback_pace = sum(p.get("learned") or 0 for p in recent) / len(recent)

    out = {}
    for termtype, targets in JLPT_TARGETS.items():
        avg_mastery = (retention_data.get(termtype) or {}).get("avg_mastery") or 0
        levels_out = []
        for level, target in targets.items():
            counts = [
                pct / 100 * target
                for h in history
                if (pct := (h["percs"].get(termtype) or {}).get(level)) is not None
            ]
            pace, source = None, None
            if len(counts) >= 2:
                diffs = [max(0.0, counts[i] - counts[i - 1]) for i in range(1, len(counts))]
                pace, source = _ewma(diffs), "synced"
            elif fallback_pace and fallback_pace > 0:
                pace, source = fallback_pace, "fallback"

            studied = counts[-1] if counts else 0
            remaining = max(0.0, target - studied)
            eta_date = None
            mastery_weighted_eta_date = None
            if pace and pace > 0:
                eta_date = (today + timedelta(days=remaining / pace)).isoformat()
                if avg_mastery > 0:
                    effective_pace = pace * (avg_mastery / 100)
                    if effective_pace > 0:
                        mastery_weighted_eta_date = (today + timedelta(days=remaining / effective_pace)).isoformat()

            levels_out.append({
                "level": level,
                "studied": round(studied),
                "target": target,
                "pct": round(studied / target * 100, 1) if target else 0,
                "pace_per_day": round(pace, 2) if pace else None,
                "pace_source": source,
                "eta_date": eta_date,
                "mastery_weighted_eta_date": mastery_weighted_eta_date,
            })
        out[termtype] = levels_out
    return out


def nearest_pace_eta(pace: dict | None = None) -> tuple[str, str] | None:
    """The soonest in-progress JLPT-level ETA across every termtype, as
    (label, eta_date) — used by both the overview insights feed and the
    daily digest push so they agree on "what's coming up next"."""
    pace = pace if pace is not None else pace_forecast()
    today = datetime.now(timezone.utc).date()
    nearest, best_days = None, None
    for termtype, levels in pace.items():
        for lvl in levels:
            if lvl["eta_date"] and 0 < lvl["pct"] < 100:
                days = (datetime.strptime(lvl["eta_date"], "%Y-%m-%d").date() - today).days
                if best_days is None or days < best_days:
                    best_days, nearest = days, (f"{termtype} {lvl['level']}", lvl["eta_date"])
    return nearest


# --- upcoming review workload -----------------------------------------------

def workload(days: int = 14) -> list:
    """Sum of terms_to_review per day-offset from the latest captured
    /schedule upcoming[] forecast, zero-filled across the full window."""
    rows = db.latest_schedule_upcoming()
    by_offset: dict[int, int] = {}
    for r in rows:
        try:
            offset = int(r["due_date"])
        except (TypeError, ValueError):
            continue
        if 0 <= offset <= days:
            by_offset[offset] = by_offset.get(offset, 0) + int(r["terms_to_review"] or 0)

    today = datetime.now(timezone.utc).date()
    return [
        {
            "date": (today + timedelta(days=off)).isoformat(),
            "days_out": off,
            "terms_to_review": by_offset.get(off, 0),
        }
        for off in range(0, days + 1)
    ]


def jlpt_breakdown() -> dict:
    """Per termtype x level: {studied, avg_mastery, mastered(>=80), weak(<40)}.

    Term-level JLPT tags only come back from Renshuu for kanji (the vocab/
    grammar/sent bulk endpoints don't carry JLPT markers) — those termtypes
    are simply omitted rather than shown as inaccurate zeros.
    """
    out = {}
    for termtype in TERMTYPES:
        rows = [r for r in db.latest_term_mastery(termtype) if r.get("jlpt")]
        if not rows:
            continue
        by_level: dict[str, list] = {}
        for r in rows:
            by_level.setdefault(r["jlpt"], []).append(r.get("mastery") or 0)
        out[termtype] = {
            level: {
                "studied": len(masteries),
                "avg_mastery": round(sum(masteries) / len(masteries), 1),
                "mastered": sum(1 for m in masteries if m >= 80),
                "weak": sum(1 for m in masteries if m < 40),
            }
            for level, masteries in by_level.items()
        }
    return out
