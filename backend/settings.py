"""Runtime settings: the Renshuu API key and the daily study goal.

Stored server-side in the SQLite settings table (set via the in-app wizard).
On a self-hosted single-user instance this is the user's own machine, so the
key is kept in plaintext in their own DB; the README documents this and the
.gitignore keeps the DB out of version control.
"""

import sys
from pathlib import Path

# Make the shared client (one directory up) importable.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from renshuu_client import validate_key  # noqa: E402

import db  # noqa: E402
from config import ENV_API_KEY  # noqa: E402

KEY_SETTING = "renshuu_api_key"
ACCOUNT_NAME_SETTING = "renshuu_account_name"
DAILY_GOAL_SETTING = "daily_goal"
DEFAULT_DAILY_GOAL = 30


def bootstrap_from_env():
    """Seed settings from env vars if present and not already configured."""
    if ENV_API_KEY and not db.get_setting(KEY_SETTING):
        db.set_setting(KEY_SETTING, ENV_API_KEY.strip().strip("\"'"))


def get_api_key():
    return db.get_setting(KEY_SETTING)


def get_daily_goal() -> int:
    raw = db.get_setting(DAILY_GOAL_SETTING)
    try:
        return int(raw) if raw is not None else DEFAULT_DAILY_GOAL
    except (TypeError, ValueError):
        return DEFAULT_DAILY_GOAL


def set_daily_goal(goal: int):
    goal = max(1, min(500, int(goal)))
    db.set_setting(DAILY_GOAL_SETTING, str(goal))


def is_configured() -> bool:
    return bool(get_api_key())


def save_api_key(api_key: str):
    """Validate the key against Renshuu, save it if valid, return the profile.

    Returns (ok, profile_or_none).
    """
    profile = validate_key(api_key)
    if not profile:
        return False, None
    db.set_setting(KEY_SETTING, api_key.strip())
    if profile.get("real_name"):
        db.set_setting(ACCOUNT_NAME_SETTING, profile["real_name"])
    return True, profile


def account_summary():
    """Account name captured at key-setup time (for the settings page)."""
    if not is_configured():
        return None
    return {"name": db.get_setting(ACCOUNT_NAME_SETTING)}
