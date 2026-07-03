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


def send_daily_digest(
    reviews_due: int,
    leech_count: int,
    weakest_vector: str | None,
    streak_current: int,
    nearest_eta: tuple[str, str] | None,
) -> bool:
    """A wholesome morning coaching digest, framed as a note from Kao."""
    lines = []
    if reviews_due > 0:
        lines.append(f"{reviews_due} reviews are waiting")
    if leech_count:
        lines.append(f"{leech_count} leech{'es' if leech_count != 1 else ''} to squash")
    if weakest_vector:
        lines.append(f"{weakest_vector} is your weak spot lately")
    if streak_current > 0:
        lines.append(f"{streak_current}-day streak going strong")
    if nearest_eta:
        level, eta = nearest_eta
        lines.append(f"{level.upper()} on pace for {eta}")

    body = "Kao says: " + " · ".join(lines) if lines else "Kao says: all caught up — enjoy a well-earned break!"
    return push.send_push("🍵 Your Renshu morning digest", body, REVIEW_URL, kind="digest")


def send_streak_risk(streak_current: int) -> bool:
    """A gentle nudge, framed as Kao missing you rather than a warning."""
    body = f"Kao misses you! Your {streak_current}-day streak is waiting — a few minutes today keeps it alive."
    return push.send_push("🥺 Kao is missing you", body, REVIEW_URL, kind="streak_risk")
