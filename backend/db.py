"""SQLite persistence: settings, snapshots, and a notification log.

Uses the stdlib sqlite3 (no ORM). All access goes through short-lived
connections so the module is safe to call from both FastAPI request handlers
and the background poller thread.
"""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from config import DB_PATH


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH, timeout=30)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with _conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS profile_snapshots (
                ts             TEXT NOT NULL,
                total          INTEGER,
                total_vocab    INTEGER,
                total_kanji    INTEGER,
                total_grammar  INTEGER,
                total_sent     INTEGER,
                streak_json    TEXT,
                level_percs_json TEXT
            );

            CREATE TABLE IF NOT EXISTS schedule_snapshots (
                ts            TEXT NOT NULL,
                schedule_id   TEXT,
                name          TEXT,
                booktype      TEXT,
                review_due    INTEGER,
                new_avail     INTEGER,
                terms_total   INTEGER,
                studied_count INTEGER
            );

            CREATE TABLE IF NOT EXISTS notifications_log (
                ts      TEXT NOT NULL,
                kind    TEXT,
                message TEXT,
                ok      INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_profile_ts ON profile_snapshots(ts);
            CREATE INDEX IF NOT EXISTS idx_schedule_ts ON schedule_snapshots(ts);
            CREATE INDEX IF NOT EXISTS idx_notif_ts ON notifications_log(ts);
            """
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# --- settings -------------------------------------------------------------

def get_setting(key: str):
    with _conn() as c:
        row = c.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        return row["value"] if row else None


def set_setting(key: str, value: str):
    with _conn() as c:
        c.execute(
            "INSERT INTO settings(key, value) VALUES(?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            (key, value),
        )


# --- snapshots ------------------------------------------------------------

def insert_profile_snapshot(profile: dict):
    studied = profile.get("studied", {}) or {}
    with _conn() as c:
        c.execute(
            """INSERT INTO profile_snapshots
               (ts, total, total_vocab, total_kanji, total_grammar, total_sent,
                streak_json, level_percs_json)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                _now(),
                studied.get("total"),
                studied.get("total_vocab"),
                studied.get("total_kanji"),
                studied.get("total_grammar"),
                studied.get("total_sent"),
                json.dumps(profile.get("streaks", {})),
                json.dumps(profile.get("level_progress_percs", {})),
            ),
        )


def insert_schedule_snapshots(schedules: list):
    ts = _now()
    rows = []
    for s in schedules:
        today = s.get("today", {}) or {}
        terms = s.get("terms", {}) or {}
        rows.append(
            (
                ts,
                str(s.get("id")),
                s.get("name"),
                s.get("booktype"),
                int(today.get("review", 0) or 0),
                int(today.get("new", 0) or 0),
                terms.get("total_count"),
                terms.get("studied_count"),
            )
        )
    with _conn() as c:
        c.executemany(
            """INSERT INTO schedule_snapshots
               (ts, schedule_id, name, booktype, review_due, new_avail,
                terms_total, studied_count)
               VALUES (?,?,?,?,?,?,?,?)""",
            rows,
        )


# --- history queries (for charts) -----------------------------------------

PROFILE_METRICS = {
    "total", "total_vocab", "total_kanji", "total_grammar", "total_sent",
}


def profile_history(metric: str, days: int):
    """Return one point per day (the last snapshot of each day) for a metric."""
    if metric not in PROFILE_METRICS:
        raise ValueError(f"unknown metric: {metric}")
    with _conn() as c:
        rows = c.execute(
            f"""
            SELECT date(ts) AS day, {metric} AS value
            FROM profile_snapshots p
            WHERE ts >= datetime('now', ?)
              AND ts = (SELECT MAX(ts) FROM profile_snapshots
                        WHERE date(ts) = date(p.ts))
            ORDER BY day
            """,
            (f"-{int(days)} days",),
        ).fetchall()
        return [{"day": r["day"], "value": r["value"]} for r in rows]


def daily_activity(days: int):
    """Return newly-learned terms per day, derived from schedule snapshots.

    `studied_count` is the cumulative number of unique terms studied per
    schedule. For each day we take the last snapshot of each schedule, sum the
    studied counts into a daily total, then diff consecutive days to get how
    many new terms were learned that day. Negative diffs (e.g. a schedule was
    deleted) are clamped to 0. One extra day of history is read so the first
    visible day has a baseline to diff against.

    Returns [{day, learned}].
    """
    with _conn() as c:
        rows = c.execute(
            """
            SELECT day, SUM(studied_count) AS total
            FROM (
                SELECT date(ts) AS day, schedule_id,
                       studied_count,
                       ROW_NUMBER() OVER (
                           PARTITION BY date(ts), schedule_id ORDER BY ts DESC
                       ) AS rn
                FROM schedule_snapshots
                WHERE ts >= datetime('now', ?)
            )
            WHERE rn = 1
            GROUP BY day
            ORDER BY day
            """,
            (f"-{int(days) + 1} days",),
        ).fetchall()

    out = []
    prev = None
    for r in rows:
        total = r["total"] or 0
        if prev is not None:
            out.append({"day": r["day"], "learned": max(0, total - prev)})
        prev = total
    return out


def latest_profile_snapshot():
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM profile_snapshots ORDER BY ts DESC LIMIT 1"
        ).fetchone()
        return dict(row) if row else None


def profile_snapshot_n_days_ago(days: int):
    with _conn() as c:
        row = c.execute(
            "SELECT * FROM profile_snapshots WHERE ts <= datetime('now', ?) "
            "ORDER BY ts DESC LIMIT 1",
            (f"-{int(days)} days",),
        ).fetchone()
        return dict(row) if row else None


# --- notifications --------------------------------------------------------

def log_notification(kind: str, message: str, ok: bool):
    with _conn() as c:
        c.execute(
            "INSERT INTO notifications_log(ts, kind, message, ok) VALUES (?,?,?,?)",
            (_now(), kind, message, 1 if ok else 0),
        )


def notified_today(kind: str) -> bool:
    """True if a notification of this kind was already sent (ok) today (UTC)."""
    with _conn() as c:
        row = c.execute(
            "SELECT 1 FROM notifications_log "
            "WHERE kind = ? AND ok = 1 AND date(ts) = date('now') LIMIT 1",
            (kind,),
        ).fetchone()
        return row is not None
