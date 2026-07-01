"""Google Chat notifications via an incoming webhook.

A Chat webhook is the simplest possible push channel: POST JSON to a URL, no
OAuth. The forker creates one in a Chat space (Apps & integrations > Webhooks)
and pastes the URL into the setup wizard.
"""

import requests

import db
import settings


def _post(webhook: str, payload: dict) -> bool:
    try:
        resp = requests.post(webhook, json=payload, timeout=15)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def send_text(text: str, kind: str = "manual") -> bool:
    """Send a plain-text Chat message. Returns True on success."""
    webhook = settings.get_webhook()
    if not webhook:
        db.log_notification(kind, text, False)
        return False
    ok = _post(webhook, {"text": text})
    db.log_notification(kind, text, ok)
    return ok


def send_review_reminder(total_due: int, schedules: list) -> bool:
    """Rich-ish reminder that reviews are ready, with a button to open Renshuu."""
    webhook = settings.get_webhook()
    if not webhook:
        db.log_notification("review", f"{total_due} reviews due", False)
        return False

    breakdown = ", ".join(
        f"{s['name']} ({s['review_due']})"
        for s in schedules
        if s.get("review_due", 0) > 0
    )
    text = f"🔔 *{total_due} reviews ready on Renshuu!*\n{breakdown}"
    card = {
        "cardsV2": [
            {
                "cardId": "review-reminder",
                "card": {
                    "header": {
                        "title": "Time to review! 🇯🇵",
                        "subtitle": f"{total_due} terms waiting",
                    },
                    "sections": [
                        {
                            "widgets": [
                                {"textParagraph": {"text": breakdown or "Reviews are due."}},
                                {
                                    "buttonList": {
                                        "buttons": [
                                            {
                                                "text": "Open Renshuu",
                                                "onClick": {
                                                    "openLink": {
                                                        "url": "https://www.renshuu.org/index.php?page=mistakes"
                                                    }
                                                },
                                            }
                                        ]
                                    }
                                },
                            ]
                        }
                    ],
                },
            }
        ]
    }
    ok = _post(webhook, card)
    db.log_notification("review", text, ok)
    return ok
