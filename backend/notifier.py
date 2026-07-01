"""Review reminders, delivered as Web Push (PWA) notifications.

The forker installs the dashboard as a PWA and enables notifications; the
background poller calls in here once a day when reviews are due. Delivery and
subscription handling live in push.py.
"""

import push

# Tapping a notification should take you straight to your Renshuu mistakes queue.
REVIEW_URL = "https://www.renshuu.org/index.php?page=mistakes"


def send_text(text: str, kind: str = "manual") -> bool:
    """Send a simple notification to all subscribed devices."""
    return push.send_push("練習 Renshuu Dashboard", text, REVIEW_URL, kind=kind)


def send_review_reminder(total_due: int, schedules: list) -> bool:
    """Push a reminder that reviews are ready, with a per-schedule breakdown."""
    breakdown = ", ".join(
        f"{s['name']} ({s['review_due']})"
        for s in schedules
        if s.get("review_due", 0) > 0
    )
    body = breakdown or f"{total_due} terms waiting"
    return push.send_push(
        f"🔔 {total_due} reviews ready on Renshuu!",
        body,
        REVIEW_URL,
        kind="review",
    )
