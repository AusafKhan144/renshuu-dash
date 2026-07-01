"""Password gate for public hosting: a single shared password backed by a
signed, HttpOnly session cookie.

Why this exists: the dashboard holds your Renshuu API key and personal study
data, and is meant to be exposed on the public internet (Railway). Without a
gate, anyone with the URL could read it all. This is deliberately the simplest
thing that works for a single-user instance — one password, a signed cookie, a
logout. No user accounts, no DB rows.

If ``APP_PASSWORD`` is not set, auth is disabled entirely (``require_auth`` is a
no-op) so a local instance on your own machine still works with zero config.
"""

import logging
import secrets

from fastapi import Cookie, HTTPException, Response
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from config import (
    APP_COOKIE_SECURE,
    APP_PASSWORD,
    APP_SECRET,
    SESSION_MAX_AGE_DAYS,
)

log = logging.getLogger("renshu.auth")

COOKIE_NAME = "renshu_session"
_MAX_AGE = SESSION_MAX_AGE_DAYS * 24 * 60 * 60  # seconds
_SESSION_VALUE = "ok"  # opaque payload; presence of a valid cookie == logged in

# A stable secret keeps logins alive across restarts; a random fallback means
# sessions reset on restart (fine, just less convenient) and is loudly logged.
if APP_SECRET:
    _secret = APP_SECRET
else:
    _secret = secrets.token_urlsafe(32)
    if APP_PASSWORD:
        log.warning(
            "APP_SECRET not set — using an ephemeral secret; logins will reset "
            "on restart. Set APP_SECRET in production."
        )

_serializer = URLSafeTimedSerializer(_secret, salt="renshu-session")


def auth_required() -> bool:
    """True when a password is configured (so the app is gated)."""
    return APP_PASSWORD is not None


def check_password(password: str) -> bool:
    if not auth_required():
        return True
    # Constant-time compare to avoid leaking the password via timing.
    return secrets.compare_digest(password or "", APP_PASSWORD)


def is_valid_session(token: str | None) -> bool:
    if not auth_required():
        return True
    if not token:
        return False
    try:
        value = _serializer.loads(token, max_age=_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return False
    return value == _SESSION_VALUE


def set_session_cookie(response: Response) -> None:
    token = _serializer.dumps(_SESSION_VALUE)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=_MAX_AGE,
        httponly=True,
        secure=APP_COOKIE_SECURE,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE_NAME, path="/")


def require_auth(renshu_session: str | None = Cookie(default=None)) -> None:
    """FastAPI dependency: raises 401 unless a valid session cookie is present.

    No-op when auth is disabled (no APP_PASSWORD).
    """
    if not auth_required():
        return
    if not is_valid_session(renshu_session):
        raise HTTPException(status_code=401, detail="Not authenticated.")
