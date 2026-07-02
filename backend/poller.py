"""Background poller: snapshots progress and fires review reminders.

Runs inside the FastAPI process via APScheduler (started in the app lifespan).
All jobs are no-ops until an API key is configured, so a fresh fork sitting on
the setup wizard makes zero Renshuu calls.

Call budget is deliberately tiny: schedules hourly (~24/day) + profile once
daily (1/day), well under the 500/day limit; the shared client also spaces
calls and backs off on 429.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

import db
import gamification
import notifier
import settings
from config import PROFILE_SNAPSHOT_HOUR, SCHEDULE_POLL_MINUTES
from renshuu_client import get_kana_mastery, get_profile, get_schedule_terms, get_schedules

log = logging.getLogger("renshu.poller")

# Spotlight: how many "focus" (lowest-mastery, defined) terms to surface.
SPOTLIGHT_COUNT = 5

_scheduler: BackgroundScheduler | None = None


def poll_schedules(notify: bool = True):
    """Snapshot all schedules; notify once/day when reviews become due."""
    api_key = settings.get_api_key()
    if not api_key:
        return None
    schedules = get_schedules(api_key)
    db.insert_schedule_snapshots(schedules)

    due = [
        {"name": s.get("name"), "review_due": int((s.get("today") or {}).get("review", 0) or 0)}
        for s in schedules
    ]
    total_due = sum(s["review_due"] for s in due)

    if notify and total_due > 0 and not db.notified_today("review"):
        notifier.send_review_reminder(total_due, due)
        log.info("Sent review reminder: %s due", total_due)

    return {"total_due": total_due, "schedules": len(schedules)}


def snapshot_profile():
    """Snapshot the profile (seeds the progress-over-time charts)."""
    api_key = settings.get_api_key()
    if not api_key:
        return None
    profile = get_profile(api_key)
    db.insert_profile_snapshot(profile)
    # Evaluate achievements against the fresh snapshot so newly-earned ones are
    # recorded (and become claimable in the UI).
    try:
        gamification.sync_and_list(gamification.current_stats())
    except Exception as e:  # noqa: BLE001 - achievements are best-effort
        log.warning("Achievement evaluation failed: %s", e)
    log.info("Captured profile snapshot")
    return profile


def snapshot_kana_mastery():
    """Capture per-kana/kanji mastery from the hiragana/katakana/kanji schedules.

    Best-effort per section: a missing/renamed schedule just skips that
    section rather than failing the whole poll.
    """
    api_key = settings.get_api_key()
    if not api_key:
        return None
    ids = settings.get_kana_schedule_ids()
    for section, schedule_id in ids.items():
        if not schedule_id:
            continue
        rows, err = get_kana_mastery(api_key, schedule_id)
        if not rows:
            log.warning("Kana mastery capture failed for %s: %s", section, err)
            continue
        db.replace_kana_mastery(section, rows)
    log.info("Captured kana mastery snapshot")


def snapshot_spotlight():
    """Capture a few 'focus' vocab terms (lowest mastery, defined) for the
    dashboard's Word Spotlight. Best-effort: an empty result just leaves the
    spotlight empty rather than failing the poll."""
    api_key = settings.get_api_key()
    if not api_key:
        return None
    kana_ids = set(filter(None, settings.get_kana_schedule_ids().values()))
    schedules = get_schedules(api_key)
    vocab = [
        s for s in schedules
        if s.get("booktype") == "vocab" and str(s.get("id")) not in kana_ids
    ]
    if not vocab:
        return None
    schedule_id = str(vocab[0]["id"])
    data, err = get_schedule_terms(api_key, schedule_id, page=1)
    if err:
        log.warning("Spotlight capture failed: %s", err)
        return None
    terms = (data.get("contents") or {}).get("terms", []) or []
    picks = []
    for t in terms:
        word = t.get("kanji_full") or t.get("hiragana_full")
        defs = t.get("def") or []
        if not word or not defs:
            continue
        try:
            mastery = int(float((t.get("user_data") or {}).get("mastery_avg_perc") or 0))
        except (TypeError, ValueError):
            mastery = 0
        picks.append({
            "word_id": t.get("id"),
            "kanji_full": t.get("kanji_full") or "",
            "hiragana_full": t.get("hiragana_full") or "",
            "def": "; ".join(defs[:2]),
            "mastery": mastery,
        })
    picks.sort(key=lambda p: p["mastery"])
    db.replace_spotlight(picks[:SPOTLIGHT_COUNT])
    log.info("Captured %d spotlight words", min(len(picks), SPOTLIGHT_COUNT))


def seed_initial_snapshots():
    """On first successful setup, capture a baseline so day 1 isn't blank."""
    try:
        snapshot_profile()
        poll_schedules(notify=False)
        snapshot_kana_mastery()
        snapshot_spotlight()
    except Exception as e:  # noqa: BLE001 - best-effort seeding
        log.warning("Initial snapshot seeding failed: %s", e)


def start_scheduler():
    global _scheduler
    if _scheduler:
        return _scheduler
    sched = BackgroundScheduler(daemon=True, timezone="UTC")
    sched.add_job(
        poll_schedules, "interval", minutes=SCHEDULE_POLL_MINUTES,
        id="poll_schedules",
    )
    sched.add_job(
        snapshot_profile, "cron", hour=PROFILE_SNAPSHOT_HOUR, minute=0,
        id="snapshot_profile",
    )
    sched.add_job(
        snapshot_kana_mastery, "cron", hour=PROFILE_SNAPSHOT_HOUR, minute=5,
        id="snapshot_kana_mastery",
    )
    sched.add_job(
        snapshot_spotlight, "cron", hour=PROFILE_SNAPSHOT_HOUR, minute=10,
        id="snapshot_spotlight",
    )
    sched.start()
    _scheduler = sched
    log.info(
        "Poller started: schedules every %s min, profile daily at %02d:00 UTC",
        SCHEDULE_POLL_MINUTES, PROFILE_SNAPSHOT_HOUR,
    )
    return sched


def stop_scheduler():
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
