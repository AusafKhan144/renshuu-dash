"""Configuration for the dashboard backend.

Defaults can be overridden by environment variables (handy for Docker), but the
Renshuu API key and Google Chat webhook are normally set at runtime via the
in-app setup wizard and stored in the database (see settings.py).
"""

import os

# Where the SQLite database lives. Override with RENSHU_DB_PATH (Docker volume).
DB_PATH = os.environ.get(
    "RENSHU_DB_PATH",
    os.path.join(os.path.dirname(__file__), "renshuu_progress.db"),
)

# Directory of the built frontend (frontend/dist), served as static files in prod.
FRONTEND_DIST = os.environ.get(
    "RENSHU_FRONTEND_DIST",
    os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"),
)

# Poller cadence.
SCHEDULE_POLL_MINUTES = int(os.environ.get("RENSHU_SCHEDULE_POLL_MINUTES", "60"))
PROFILE_SNAPSHOT_HOUR = int(os.environ.get("RENSHU_PROFILE_SNAPSHOT_HOUR", "6"))

# CORS origins allowed in dev (Vite dev server).
DEV_ORIGINS = os.environ.get(
    "RENSHU_DEV_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

# Optional bootstrap: if these env vars are set and the DB has no value yet,
# they seed the settings table on startup (lets power users skip the wizard).
ENV_API_KEY = os.environ.get("RENSHUU_API_KEY")
ENV_WEBHOOK = os.environ.get("GOOGLE_CHAT_WEBHOOK")

# --- Auth (for public hosting) --------------------------------------------
# Single shared password that gates the whole app. If unset, auth is DISABLED
# (fine for a local instance on your own machine). On a public host (Railway)
# you MUST set this, or anyone with the URL can read your data and key.
APP_PASSWORD = os.environ.get("APP_PASSWORD") or None

# Secret used to sign the session cookie. If unset, a random one is generated at
# startup — which means sessions are dropped whenever the process restarts. Set
# a stable value in production so logins survive redeploys.
APP_SECRET = os.environ.get("APP_SECRET") or None

# Whether to mark the session cookie Secure (HTTPS-only). Default true. Set to
# "false"/"0" for local http development so the cookie is accepted over http.
APP_COOKIE_SECURE = os.environ.get("APP_COOKIE_SECURE", "true").lower() not in (
    "false", "0", "no",
)

# How long a login lasts.
SESSION_MAX_AGE_DAYS = int(os.environ.get("APP_SESSION_MAX_AGE_DAYS", "30"))
