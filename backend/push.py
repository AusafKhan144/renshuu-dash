"""Web Push (VAPID) — the app's only notification channel.

Replaces the old Google Chat webhook. VAPID keys are generated once and stored
in the settings table (so subscriptions survive restarts); browsers subscribe
via the service worker and we deliver with pywebpush from the background poller.
"""

import base64
import json
import logging

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    NoEncryption,
    PrivateFormat,
    PublicFormat,
)
from pywebpush import WebPushException, webpush

import db
from config import VAPID_SUBJECT

log = logging.getLogger("renshu.push")

_PRIVATE_PEM_SETTING = "vapid_private_pem"
_PUBLIC_KEY_SETTING = "vapid_public_key"


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _ensure_keys() -> tuple[str, str]:
    """Return (private_pem, application_server_key), generating them once."""
    priv_pem = db.get_setting(_PRIVATE_PEM_SETTING)
    pub_key = db.get_setting(_PUBLIC_KEY_SETTING)
    if priv_pem and pub_key:
        return priv_pem, pub_key

    priv = ec.generate_private_key(ec.SECP256R1())
    priv_pem = priv.private_bytes(
        Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
    ).decode()
    raw_pub = priv.public_key().public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    pub_key = _b64url(raw_pub)

    db.set_setting(_PRIVATE_PEM_SETTING, priv_pem)
    db.set_setting(_PUBLIC_KEY_SETTING, pub_key)
    log.info("Generated a new VAPID key pair for Web Push")
    return priv_pem, pub_key


def public_key() -> str:
    """The base64url application server key the browser subscribes with."""
    return _ensure_keys()[1]


def save_subscription(sub: dict) -> bool:
    """Store a PushSubscription JSON ({endpoint, keys:{p256dh, auth}})."""
    endpoint = (sub or {}).get("endpoint")
    keys = (sub or {}).get("keys") or {}
    p256dh, auth = keys.get("p256dh"), keys.get("auth")
    if not (endpoint and p256dh and auth):
        return False
    db.save_push_subscription(endpoint, p256dh, auth)
    return True


def remove_subscription(endpoint: str):
    db.delete_push_subscription(endpoint)


def enabled() -> bool:
    return db.count_push_subscriptions() > 0


def send_push(title: str, body: str, url: str, kind: str = "manual") -> bool:
    """Push a notification to every stored subscription. Prunes dead ones.

    Returns True if at least one push was accepted.
    """
    subs = db.list_push_subscriptions()
    if not subs:
        db.log_notification(kind, body, False)
        return False

    priv_pem, _ = _ensure_keys()
    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0
    for s in subs:
        subscription_info = {
            "endpoint": s["endpoint"],
            "keys": {"p256dh": s["p256dh"], "auth": s["auth"]},
        }
        try:
            webpush(
                subscription_info=subscription_info,
                data=payload,
                vapid_private_key=priv_pem,
                vapid_claims={"sub": VAPID_SUBJECT},
                timeout=15,
            )
            sent += 1
        except WebPushException as e:
            status = getattr(e.response, "status_code", None)
            if status in (404, 410):
                # Subscription is gone — drop it so we stop trying.
                db.delete_push_subscription(s["endpoint"])
                log.info("Pruned expired push subscription")
            else:
                log.warning("Push failed (%s): %s", status, e)
        except Exception as e:  # noqa: BLE001 - never let a bad sub break the poller
            log.warning("Push error: %s", e)

    ok = sent > 0
    db.log_notification(kind, body, ok)
    return ok
