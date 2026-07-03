"""
Shared Renshuu API client.

Used by both the bulk-import CLI (renshuu_import.py) and the dashboard backend.
Every function takes the API key explicitly (no globals), and all HTTP goes
through `_request()`, which:
  - spaces calls out (Renshuu has a tight per-minute *burst* limit on top of the
    500/day free-tier limit), and
  - backs off + retries on HTTP 429, honouring any Retry-After header.

Verified endpoint behaviour (live):
  GET  /profile                -> account stats (also used to validate a key)
  GET  /schedule               -> study schedules incl. today's due + forecast
  GET  /lists                  -> the user's lists with list_id
  GET  /word/search?value=     -> dictionary search (must be GET, not POST)
  PUT  /word/{id} {list_id}    -> add a word to a list
"""

import os
import threading
import time

import requests

API_BASE = "https://www.renshuu.org/api/v1"

# Minimum gap between any two API calls, process-wide. Renshuu's burst limit is
# tight; 1s keeps us comfortably clear while staying responsive.
MIN_CALL_SPACING = 1.0
# 429 retry policy.
MAX_RETRIES = 4
BACKOFF_BASE = 2.0

_last_call_at = 0.0
_call_lock = threading.Lock()


def load_dotenv(path: str = ".env"):
    """Load KEY=VALUE pairs from a .env file into the environment, if present.

    Quotes around values are stripped, and existing environment variables are
    not overwritten (an exported shell value wins).
    """
    if not os.path.exists(path):
        return
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"\''))


def get_headers(api_key: str) -> dict:
    return {"Authorization": f"Bearer {api_key}"}


def _request(method: str, path: str, api_key: str, **kwargs) -> requests.Response:
    """Make a rate-limit-aware request to the Renshuu API.

    Enforces a global minimum spacing between calls and retries on 429 with
    exponential backoff. Raises requests exceptions on network errors; returns
    the final Response otherwise (callers inspect status_code).
    """
    global _last_call_at
    url = f"{API_BASE}{path}"
    headers = {**get_headers(api_key), **kwargs.pop("headers", {})}

    last_resp = None
    for attempt in range(MAX_RETRIES + 1):
        # Space calls out across all threads.
        with _call_lock:
            wait = MIN_CALL_SPACING - (time.monotonic() - _last_call_at)
            if wait > 0:
                time.sleep(wait)
            _last_call_at = time.monotonic()

        resp = requests.request(method, url, headers=headers, timeout=30, **kwargs)
        last_resp = resp
        if resp.status_code != 429:
            _capture_usage(resp)
            return resp

        # Rate limited: honour Retry-After if present, else exponential backoff.
        retry_after = resp.headers.get("Retry-After")
        if retry_after and retry_after.isdigit():
            delay = float(retry_after)
        else:
            delay = BACKOFF_BASE ** attempt
        if attempt < MAX_RETRIES:
            time.sleep(delay)

    return last_resp


def _capture_usage(resp: requests.Response):
    """Best-effort: persist Renshuu's own api_usage counter to the dashboard DB.

    Every Renshuu response body carries `api_usage: {calls_today,
    daily_allowance}`. This is a no-op outside the dashboard backend (e.g. the
    CLI importer), where `db` (backend/db.py) isn't on sys.path.
    """
    try:
        usage = resp.json().get("api_usage")
    except (ValueError, AttributeError):
        return
    if not usage:
        return
    try:
        import db  # backend/db.py; only importable when running as the dashboard backend
    except ImportError:
        return
    try:
        db.upsert_api_usage(
            int(usage.get("calls_today") or 0), int(usage.get("daily_allowance") or 500)
        )
    except Exception:  # noqa: BLE001 - usage capture must never break a real call
        pass


# --- Read endpoints -------------------------------------------------------

def get_profile(api_key: str) -> dict:
    resp = _request("GET", "/profile", api_key)
    resp.raise_for_status()
    return resp.json()


def get_schedules(api_key: str) -> list:
    resp = _request("GET", "/schedule", api_key)
    resp.raise_for_status()
    return resp.json().get("schedules", [])


def get_lists(api_key: str) -> dict:
    resp = _request("GET", "/lists", api_key)
    resp.raise_for_status()
    return resp.json()


def get_list_words(api_key: str, list_id: str, page: int = 1):
    """One page of a user list's contents: `(data, error)`.

    Confirmed live: `GET /list/{id}?pg=N` -> {list_id, title, termtype,
    contents: {pg, total_pg, result_count, terms}}. `terms` is None on error
    (unknown list, etc.) rather than raising, so the UI can show an empty state.
    """
    resp = _request("GET", f"/list/{list_id}", api_key, params={"pg": page})
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return resp.json(), None


def get_schedule_terms(api_key: str, schedule_id: str, page: int = 1):
    """One page of a schedule's terms (with per-term mastery): `(data, error)`.

    Confirmed live: `GET /schedule/{id}/list?group=all&pg=N` -> {contents:
    {pg, total_pg, result_count, terms}}, each term carrying
    `user_data.mastery_avg_perc` and `hiragana_full`/`kanji_full`.
    """
    resp = _request(
        "GET", f"/schedule/{schedule_id}/list", api_key,
        params={"group": "all", "pg": page},
    )
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return resp.json(), None


# Hard cap on pages fetched per schedule when walking mastery data, so a
# schedule with an unexpectedly huge term count can't blow the daily budget.
MAX_MASTERY_PAGES = 12


def get_kana_mastery(api_key: str, schedule_id: str):
    """All terms in a schedule, normalized to `[{char, score, detail}]`: `(data, error)`.

    `char` is `kanji_full` if present, else `hiragana_full`. `score` is
    `user_data.mastery_avg_perc` as an int (0-100). `detail` carries the
    richer per-term breakdown (definition, per-study-mode mastery) Renshuu
    exposes on the same term object, for the kana detail panel.
    """
    out = []
    page = 1
    while True:
        data, err = get_schedule_terms(api_key, schedule_id, page)
        if err:
            return (out or None), err
        contents = data.get("contents", {}) or {}
        for t in contents.get("terms", []) or []:
            # Vocab schedules (hiragana/katakana) use kanji_full/hiragana_full;
            # kanji schedules use a plain `kanji` field instead.
            char = t.get("kanji_full") or t.get("hiragana_full") or t.get("kanji")
            if not char:
                continue
            user_data = t.get("user_data") or {}
            try:
                score = int(float(user_data.get("mastery_avg_perc") or 0))
            except (TypeError, ValueError):
                score = 0
            study_vectors = {
                name: {
                    "correct_count": v.get("correct_count", 0),
                    "missed_count": v.get("missed_count", 0),
                    "mastery_perc": v.get("mastery_perc", 0),
                    "last_quizzed": v.get("last_quizzed"),
                    "next_quiz": v.get("next_quiz"),
                }
                for name, v in (user_data.get("study_vectors") or {}).items()
            }
            out.append({
                "char": char,
                "score": score,
                "detail": {
                    "id": t.get("id"),
                    "def": "; ".join(t.get("def") or []),
                    "correct_count": user_data.get("correct_count", 0),
                    "missed_count": user_data.get("missed_count", 0),
                    "study_vectors": study_vectors,
                },
            })
        total_pg = int(contents.get("total_pg") or 1)
        if page >= total_pg or page >= MAX_MASTERY_PAGES:
            break
        page += 1
    return out, None


def discover_kana_schedule_ids(api_key: str):
    """Name-match the hiragana/katakana/kanji schedule IDs (they differ per user).

    Returns `{hiragana: id|None, katakana: id|None, kanji: id|None}`.
    """
    schedules = get_schedules(api_key)
    out = {"hiragana": None, "katakana": None, "kanji": None}
    for s in schedules:
        name = (s.get("name") or "").strip().lower()
        booktype = (s.get("booktype") or "").strip().lower()
        sid = str(s.get("id"))
        if out["hiragana"] is None and "hiragana" in name:
            out["hiragana"] = sid
        elif out["katakana"] is None and "katakana" in name:
            out["katakana"] = sid
        elif out["kanji"] is None and (booktype == "kanji" or "kanji" in name):
            out["kanji"] = sid
    return out


def search_kanji(api_key: str, query: str):
    """Kanji dictionary search: `(data, error)`. `data` is None if unsupported."""
    resp = _request("GET", "/kanji/search", api_key, params={"value": query})
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return resp.json(), None


def search_grammar(api_key: str, query: str, page: int = 1):
    """Grammar dictionary search: `(data, error)`. `data` is None if unsupported."""
    resp = _request(
        "GET", "/grammar/search", api_key, params={"value": query, "pg": page}
    )
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return resp.json(), None


def get_all_terms_page(api_key: str, termtype: str, page: int = 1):
    """One page of every term of `termtype` the user has ever studied: `(data, error)`.

    Confirmed live: `GET /list/all/{termtype}?pg=N` -> {contents: {pg, total_pg,
    result_count, terms}}, each term carrying `user_data` (mastery %, correct/
    missed counts, per-study-mode `study_vectors`). `termtype` is one of
    vocab/kanji/grammar/sent.
    """
    resp = _request("GET", f"/list/all/{termtype}", api_key, params={"pg": page})
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return resp.json(), None


def get_reibun(api_key: str, word_id: str | None = None, value: str | None = None):
    """Example sentences for a word (by id) or free-text search: `(data, error)`."""
    if word_id:
        resp = _request("GET", f"/reibun/search/{word_id}", api_key)
    else:
        resp = _request("GET", "/reibun/search", api_key, params={"value": value or ""})
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return resp.json(), None


def get_grammar_detail(api_key: str, grammar_id: str):
    """Full grammar point detail (construct image, model sentences): `(data, error)`."""
    resp = _request("GET", f"/grammar/{grammar_id}", api_key)
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    return resp.json(), None


def remove_word_from_list(api_key: str, word_id: str, list_id: str):
    """Remove a word from a list. Returns `(ok, status_or_error)`."""
    resp = _request(
        "DELETE", f"/word/{word_id}", api_key, json={"list_id": list_id}
    )
    return resp.status_code == 200, resp.status_code


def validate_key(api_key: str):
    """Return the profile dict if the key is valid, else None.

    Used by the dashboard setup wizard to verify a pasted key before saving.
    """
    if not api_key or not api_key.strip():
        return None
    try:
        resp = _request("GET", "/profile", api_key.strip())
    except requests.RequestException:
        return None
    if resp.status_code != 200:
        return None
    data = resp.json()
    # A valid profile has an id; an auth failure returns an error payload.
    return data if data.get("id") else None


# --- Write / search endpoints (used by the CLI importer) ------------------

def search_word(api_key: str, word: str):
    resp = _request("GET", "/word/search", api_key, params={"value": word})
    if resp.status_code != 200:
        return None, f"HTTP {resp.status_code}"
    words = resp.json().get("words", [])
    if not words:
        return None, "no match"
    # Prefer an exact match on hiragana_full or kanji_full.
    for w in words:
        if w.get("hiragana_full") == word or w.get("kanji_full") == word:
            return w, None
    # Fall back to first result if no exact match.
    return words[0], "fuzzy match (first result used)"


def add_word_to_list(api_key: str, word_id: str, list_id: str):
    resp = _request("PUT", f"/word/{word_id}", api_key, json={"list_id": list_id})
    return resp.status_code == 200, resp.status_code


def resolve_api_key() -> str | None:
    """Convenience: load .env and return a cleaned RENSHUU_API_KEY, or None."""
    load_dotenv()
    key = os.environ.get("RENSHUU_API_KEY")
    return key.strip().strip('"\'') if key else None
