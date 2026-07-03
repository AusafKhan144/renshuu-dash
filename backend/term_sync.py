"""Nightly full term-sync engine.

Walks every term the user has ever studied via `GET /list/all/{termtype}`
(vocab, kanji, grammar, sent), upserting a durable `terms` row per term and a
change-only `term_mastery_daily` fact whenever mastery/correct/missed differ
from the last known value. Budget-aware and resumable: if the daily Renshuu
quota runs low mid-sync, the page cursor is persisted per termtype and picked
up again on the next call (see `poller.term_sync_resume`).
"""

import logging
from datetime import datetime, timezone

import db
import settings
from config import SYNC_RESERVE
from renshuu_client import get_all_terms_page

log = logging.getLogger("renshu.term_sync")

TERMTYPES = ("vocab", "kanji", "grammar", "sent")

# Hard cap so a termtype that unexpectedly balloons (or a Renshuu bug that
# never advances total_pg) can't run away with the whole day's quota.
MAX_PAGES_PER_TYPE = 200


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _quota_budget() -> int:
    """Remaining calls we're willing to spend on this sync run.

    Renshuu's own counter resets daily; if the last capture is from a
    previous day, treat calls_today as 0. Reserves headroom for the hourly
    poll + live lookups/refreshes the user might trigger meanwhile.
    """
    reserve = SYNC_RESERVE
    usage = db.latest_api_usage()
    if not usage or not usage.get("ts"):
        return 500 - reserve
    ts_day = usage["ts"][:10]
    calls_today = int(usage.get("calls_today") or 0) if ts_day == _today() else 0
    allowance = int(usage.get("daily_allowance") or 500)
    return max(0, allowance - calls_today - reserve)


def _first_def(*candidates):
    for c in candidates:
        if c:
            return c
    return None


def _normalize(term: dict, termtype: str) -> dict | None:
    """Map a raw /list/all/{termtype} term into the `terms` row shape, plus
    the mastery facts extracted from `user_data`. Returns None if the term
    has no usable id."""
    term_id = term.get("id")
    if term_id is None:
        return None
    term_id = str(term_id)

    user_data = term.get("user_data") or {}
    payload = {k: v for k, v in term.items() if k != "user_data"}

    if termtype == "vocab":
        display = term.get("kanji_full") or term.get("hiragana_full")
        reading = term.get("hiragana_full")
        definition = "; ".join(term.get("def") or []) or None
        jlpt = None  # /list/all/vocab doesn't carry JLPT markers (unlike /word/search)
    elif termtype == "kanji":
        display = term.get("kanji")
        reading = ", ".join(filter(None, [term.get("onyomi"), term.get("kunyomi")])) or None
        definition = term.get("definition")
        raw_jlpt = (term.get("jlpt") or "").strip().lower()
        jlpt = raw_jlpt or None
    elif termtype == "grammar":
        display = term.get("title_japanese") or term.get("title_english")
        reading = None
        meaning = term.get("meaning") or {}
        meaning_long = term.get("meaning_long") or {}
        definition = _first_def(meaning.get("eng"), meaning.get("en"), meaning_long.get("eng"), meaning_long.get("en"))
        jlpt = None
    else:  # sent
        display = term.get("japanese")
        reading = term.get("hiragana")
        meaning = term.get("meaning") or {}
        definition = _first_def(meaning.get("en"), meaning.get("eng"))
        jlpt = None

    try:
        mastery = int(float(user_data.get("mastery_avg_perc") or 0))
    except (TypeError, ValueError):
        mastery = 0

    return {
        "term_id": term_id,
        "display": display,
        "reading": reading,
        "definition": definition,
        "jlpt": jlpt,
        "payload": payload,
        "mastery": mastery,
        "correct": int(user_data.get("correct_count") or 0),
        "missed": int(user_data.get("missed_count") or 0),
        "vectors": user_data.get("study_vectors") or {},
    }


def _sync_termtype(api_key: str, termtype: str, budget: int) -> tuple[int, bool]:
    """Page through one termtype starting from its saved cursor.

    Returns (calls_used, complete). `complete` is True once all pages for
    this termtype have been walked (or the endpoint reports nothing to
    sync), False if it stopped early for lack of budget.
    """
    today = _today()
    state = db.get_sync_state(termtype)
    if state and state.get("day") == today and state.get("completed_at"):
        return 0, True

    page = state["next_page"] if state and state.get("day") == today else 1
    calls_used = 0

    while calls_used < budget and page <= MAX_PAGES_PER_TYPE:
        data, err = get_all_terms_page(api_key, termtype, page)
        calls_used += 1
        if err:
            # Some termtypes (e.g. "sent" with zero studied terms) 500 on an
            # empty list — treat as "nothing to sync" rather than a hard failure.
            log.warning("term sync %s page %d failed: %s", termtype, page, err)
            db.set_sync_state(termtype, today, 1, total_pages=0, completed=True)
            return calls_used, True

        contents = (data or {}).get("contents") or {}
        raw_terms = contents.get("terms") or []
        normalized = [n for n in (_normalize(t, termtype) for t in raw_terms) if n]

        db.upsert_terms(termtype, normalized)
        db.insert_term_mastery_if_changed(termtype, normalized)

        total_pg = int(contents.get("total_pg") or 1)
        if page >= total_pg:
            db.set_sync_state(termtype, today, page + 1, total_pages=total_pg, completed=True)
            return calls_used, True

        page += 1
        db.set_sync_state(termtype, today, page, total_pages=total_pg, completed=False)

    return calls_used, False


def run_sync(max_calls: int | None = None) -> dict:
    """Sync every termtype, resuming from saved cursors. Stops early if the
    quota budget (or `max_calls`, mainly for tests) runs out."""
    api_key = settings.get_api_key()
    if not api_key:
        return {"complete": False, "error": "not configured"}

    budget = _quota_budget()
    if max_calls is not None:
        budget = min(budget, max_calls)

    today = _today()
    calls_used = 0
    all_complete = True

    for termtype in TERMTYPES:
        if budget - calls_used <= 0:
            all_complete = False
            break
        used, complete = _sync_termtype(api_key, termtype, budget - calls_used)
        calls_used += used
        if not complete:
            all_complete = False
            break

    if all_complete:
        db.write_mastery_agg(today)
        log.info("Term sync complete for %s (%d calls)", today, calls_used)
    else:
        log.info("Term sync paused for %s (%d calls used, budget exhausted)", today, calls_used)

    return {"complete": all_complete, "calls_used": calls_used}
