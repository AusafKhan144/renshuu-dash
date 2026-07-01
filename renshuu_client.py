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
