"""Gamification: XP/levels, achievements, and insights — all computed from the
real profile snapshots we already store, so nothing here is faked.

- XP is a weighted sum of studied terms (kanji/grammar count for more than vocab
  or sentences, reflecting study effort). Levels come from a smooth square-root
  curve over XP, with themed titles.
- Achievements are predicates over the latest snapshot, streaks, JLPT coverage,
  and recent activity. Earned/claimed state is persisted in SQLite (db.py); an
  earned-but-unclaimed achievement is "fresh" (the UI shows a Claim button).
- Insights are short, honest nudges derived from the same numbers.
"""

from __future__ import annotations

import json

import db

# --- XP & levels ----------------------------------------------------------

XP_WEIGHTS = {"vocab": 1, "kanji": 3, "grammar": 5, "sentences": 1}

# Level curve: level L starts at XP = _LEVEL_K * (L - 1)**2. Tuned so a few
# thousand studied terms lands around level ~12-15.
_LEVEL_K = 50

# (min_level, title). The last entry is the catch-all for high levels.
_LEVEL_TITLES = [
    (1, "Kana Novice"),
    (3, "Vocabulary Seeker"),
    (6, "Grammar Apprentice"),
    (9, "Kanji Student"),
    (12, "Kanji Adept"),
    (15, "Fluency Climber"),
    (19, "Language Voyager"),
    (25, "Fluent Voyager"),
]


def compute_xp(totals: dict) -> int:
    """Weighted XP from studied-term totals ({vocab, kanji, grammar, sentences})."""
    return sum(int(totals.get(k) or 0) * w for k, w in XP_WEIGHTS.items())


def _loads(raw):
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return {}


def _pick_streak(streaks: dict, field: str) -> int:
    """Highest value of `field` across streak categories (mirrors the UI)."""
    vals = []
    for cat in (streaks or {}).values():
        if isinstance(cat, dict):
            try:
                vals.append(int(cat.get(field)))
            except (TypeError, ValueError):
                pass
    return max(vals) if vals else 0


def _perfect_week() -> bool:
    """True if a term was learned on all of the last 7 days."""
    points = db.daily_activity(7)
    active = sum(1 for p in points if (p.get("learned") or 0) > 0)
    return active >= 7


def current_stats() -> dict:
    """Assemble the stats dict used by achievements, insights, and levels."""
    latest = db.latest_profile_snapshot() or {}
    streaks = _loads(latest.get("streak_json"))
    return {
        "vocab": latest.get("total_vocab") or 0,
        "kanji": latest.get("total_kanji") or 0,
        "grammar": latest.get("total_grammar") or 0,
        "sentences": latest.get("total_sent") or 0,
        "adventure_level": latest.get("adventure_level"),
        "streak_current": _pick_streak(streaks, "days_studied_in_a_row"),
        "streak_best": _pick_streak(streaks, "days_studied_in_a_row_alltime"),
        "jlpt": _loads(latest.get("level_percs_json")),
        "perfect_week": _perfect_week(),
    }


def _title_for(level: int) -> str:
    title = _LEVEL_TITLES[0][1]
    for min_level, name in _LEVEL_TITLES:
        if level >= min_level:
            title = name
        else:
            break
    return title


def level_info(xp: int) -> dict:
    """Given XP, return the current level, its title, and progress to the next."""
    level = int((xp / _LEVEL_K) ** 0.5) + 1
    floor = _LEVEL_K * (level - 1) ** 2
    nxt = _LEVEL_K * level ** 2
    span = max(nxt - floor, 1)
    pct = max(0, min(100, round((xp - floor) / span * 100)))
    return {
        "level": level,
        "title": _title_for(level),
        "xp": {"current": xp, "floor": floor, "next": nxt, "pct": pct},
    }


# --- achievements ---------------------------------------------------------

# Each: id, name, hue, and a target used both to decide "earned" and to show a
# progress % while locked. kind selects how `value` is read from the stats dict.
_ACHIEVEMENTS = [
    {"id": "streak7", "name": "7-Day Streak", "hue": "amber", "kind": "streak", "target": 7},
    {"id": "streak30", "name": "30-Day Streak", "hue": "teal", "kind": "streak", "target": 30},
    {"id": "streak100", "name": "100-Day Streak", "hue": "rose", "kind": "streak", "target": 100},
    {"id": "kanji100", "name": "100 Kanji Club", "hue": "teal", "kind": "kanji", "target": 100},
    {"id": "kanji500", "name": "500 Kanji", "hue": "teal", "kind": "kanji", "target": 500},
    {"id": "vocab1000", "name": "1,000 Vocab", "hue": "amber", "kind": "vocab", "target": 1000},
    {"id": "vocab2500", "name": "2,500 Vocab", "hue": "amber", "kind": "vocab", "target": 2500},
    {"id": "grammar300", "name": "Grammar Grinder", "hue": "violet", "kind": "grammar", "target": 300},
    {"id": "sent1000", "name": "1,000 Sentences", "hue": "rose", "kind": "sentences", "target": 1000},
    {"id": "n5complete", "name": "N5 Complete", "hue": "success", "kind": "jlpt", "level": "n5", "target": 99},
    {"id": "n4ready", "name": "N4 Ready", "hue": "violet", "kind": "jlpt", "level": "n4", "target": 80},
    {"id": "n3contender", "name": "N3 Contender", "hue": "violet", "kind": "jlpt", "level": "n3", "target": 50},
    {"id": "perfectweek", "name": "Perfect Week", "hue": "rose", "kind": "perfect_week", "target": 100},
]

# What each achievement measures, for the "N to go" insight.
_UNIT = {"vocab": "vocab", "kanji": "kanji", "grammar": "grammar patterns", "sentences": "sentences"}


def _jlpt_avg(jlpt: dict, level: str) -> float:
    """Average coverage % across the four categories for a JLPT level."""
    vals = [float((jlpt.get(cat) or {}).get(level) or 0) for cat in ("vocab", "kanji", "grammar", "sent")]
    return sum(vals) / len(vals) if vals else 0.0


def _value_for(a: dict, stats: dict) -> float:
    kind = a["kind"]
    if kind == "streak":
        return float(stats.get("streak_best") or 0)
    if kind == "perfect_week":
        return 100.0 if stats.get("perfect_week") else 0.0
    if kind == "jlpt":
        return _jlpt_avg(stats.get("jlpt") or {}, a["level"])
    return float(stats.get(kind) or 0)


def _evaluate(stats: dict) -> list:
    """Return raw achievement rows with value/earned/progress (no persistence)."""
    out = []
    for a in _ACHIEVEMENTS:
        value = _value_for(a, stats)
        target = a["target"]
        earned = value >= target
        progress = 100 if earned else max(0, min(99, round(value / target * 100)))
        out.append({
            "id": a["id"], "name": a["name"], "hue": a["hue"],
            "kind": a["kind"], "target": target,
            "value": value, "earned": earned, "progress": progress,
        })
    return out


def sync_and_list(stats: dict) -> list:
    """Evaluate achievements, persist newly-earned ones, and merge claim state.

    Returns UI-ready rows: {id, name, hue, earned, fresh, claimed, progress}.
    `fresh` = earned but not yet claimed (the UI shows the Claim button).
    """
    rows = _evaluate(stats)
    for r in rows:
        if r["earned"]:
            db.mark_earned(r["id"])
    claim_state = db.earned_achievements()
    result = []
    for r in rows:
        state = claim_state.get(r["id"])
        claimed = bool(state and state.get("claimed_at"))
        result.append({
            "id": r["id"], "name": r["name"], "hue": r["hue"],
            "earned": r["earned"], "progress": r["progress"],
            "claimed": claimed, "fresh": r["earned"] and not claimed,
        })
    return result


# --- insights -------------------------------------------------------------

def build_insights(stats: dict, reviews_due: int, analytics_summary: dict | None = None) -> list:
    """Up to three short, real nudges from the current stats, plus (when
    synced term data is available) weakness/pace-aware tips from analytics."""
    insights = []
    a = analytics_summary or {}

    # 0. Synced-data tips take priority — they're the most actionable.
    if a.get("leech_count"):
        insights.append(
            f"{a['leech_count']} leech{'es' if a['leech_count'] != 1 else ''} keep tripping you up — "
            "worth a focused review from Insights."
        )
    if a.get("weakest_vector"):
        insights.append(f"{a['weakest_vector']} is your weakest study mode lately.")
    if a.get("overdue_count"):
        insights.append(f"{a['overdue_count']} terms are overdue for review.")
    if a.get("nearest_eta"):
        label, eta = a["nearest_eta"]
        insights.append(f"You're on pace for {label.upper()} by {eta}.")

    # 1. Highest in-progress JLPT cell across categories.
    jlpt = stats.get("jlpt") or {}
    best = None  # (pct, level, category-label)
    labels = {"vocab": "vocab", "kanji": "kanji", "grammar": "grammar", "sent": "sentences"}
    for cat, percs in jlpt.items():
        for lvl, pct in (percs or {}).items():
            pct = float(pct or 0)
            if 0 < pct < 100 and (best is None or pct > best[0]):
                best = (pct, lvl.upper(), labels.get(cat, cat))
    if best:
        insights.append(
            f"You're {round(best[0])}% through {best[1]} {best[2]} — keep going to complete it."
        )

    # 2. Nearest unearned term-count milestone.
    nearest = None  # (remaining, name, unit)
    for r in _evaluate(stats):
        if r["kind"] in _UNIT and not r["earned"]:
            remaining = int(r["target"] - r["value"])
            if remaining > 0 and (nearest is None or remaining < nearest[0]):
                nearest = (remaining, r["name"], _UNIT[r["kind"]])
    if nearest:
        insights.append(f"{nearest[0]} {nearest[2]} away from the “{nearest[1]}” badge.")

    # 3. Streak / due nudge.
    cur = int(stats.get("streak_current") or 0)
    if reviews_due > 0 and cur > 0:
        insights.append(f"You're on a {cur}-day streak — {reviews_due} reviews are due to keep it alive.")
    elif reviews_due > 0:
        insights.append(f"{reviews_due} reviews are due — clear them to start a new streak.")
    elif cur > 0:
        insights.append(f"{cur}-day streak and all caught up. Nicely done.")

    return insights[:5]
