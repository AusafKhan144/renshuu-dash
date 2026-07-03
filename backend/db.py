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

            -- Earned/claimed state for gamification achievements. Rows only
            -- exist for achievements the user has earned; claimed_at is set once
            -- they tap "Claim" (which fires the celebration in the UI).
            CREATE TABLE IF NOT EXISTS achievements (
                id         TEXT PRIMARY KEY,
                earned_at  TEXT,
                claimed_at TEXT
            );

            -- Web Push subscriptions (one row per browser/device that opted in).
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                endpoint   TEXT PRIMARY KEY,
                p256dh     TEXT NOT NULL,
                auth       TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            -- Renshuu's own daily usage counter (single row, overwritten on
            -- every capture from a live response's api_usage field).
            CREATE TABLE IF NOT EXISTS api_usage (
                id             INTEGER PRIMARY KEY CHECK (id = 1),
                calls_today    INTEGER,
                daily_allowance INTEGER,
                ts             TEXT NOT NULL
            );

            -- A handful of vocab terms captured during the daily poll, shown
            -- as "Word Spotlight" on the dashboard (no live call per page load).
            CREATE TABLE IF NOT EXISTS spotlight (
                day          TEXT NOT NULL,
                word_id      TEXT,
                kanji_full   TEXT,
                hiragana_full TEXT,
                def          TEXT,
                mastery      INTEGER
            );

            -- Per-kana/kanji mastery captured during the daily poll (hiragana/
            -- katakana/kanji schedules), for the read-only Kana Mastery grid.
            CREATE TABLE IF NOT EXISTS kana_mastery (
                day     TEXT NOT NULL,
                section TEXT NOT NULL,
                char    TEXT NOT NULL,
                score   INTEGER,
                detail  TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_profile_ts ON profile_snapshots(ts);
            CREATE INDEX IF NOT EXISTS idx_schedule_ts ON schedule_snapshots(ts);
            CREATE INDEX IF NOT EXISTS idx_notif_ts ON notifications_log(ts);
            CREATE INDEX IF NOT EXISTS idx_spotlight_day ON spotlight(day);
            CREATE INDEX IF NOT EXISTS idx_kana_mastery_day ON kana_mastery(day, section);

            -- One row per term ever seen, across a full /list/all/{termtype} sync.
            CREATE TABLE IF NOT EXISTS terms (
                termtype   TEXT NOT NULL,
                term_id    TEXT NOT NULL,
                display    TEXT,
                reading    TEXT,
                definition TEXT,
                jlpt       TEXT,
                payload    TEXT,
                first_seen TEXT NOT NULL,
                last_seen  TEXT NOT NULL,
                PRIMARY KEY (termtype, term_id)
            );

            -- Change-only daily mastery facts: one row per term per day its
            -- mastery/counts actually changed (idempotent re-sync same day).
            CREATE TABLE IF NOT EXISTS term_mastery_daily (
                day          TEXT NOT NULL,
                termtype     TEXT NOT NULL,
                term_id      TEXT NOT NULL,
                mastery      INTEGER,
                correct      INTEGER,
                missed       INTEGER,
                vectors_json TEXT,
                PRIMARY KEY (day, termtype, term_id)
            );
            CREATE INDEX IF NOT EXISTS idx_tmd_term ON term_mastery_daily(termtype, term_id, day);

            -- Daily aggregate per termtype, written once a sync fully completes.
            CREATE TABLE IF NOT EXISTS mastery_daily_agg (
                day          TEXT NOT NULL,
                termtype     TEXT NOT NULL,
                total        INTEGER,
                avg_mastery  REAL,
                b0           INTEGER,
                b20          INTEGER,
                b40          INTEGER,
                b60          INTEGER,
                b80          INTEGER,
                PRIMARY KEY (day, termtype)
            );

            -- Resumable cursor for the nightly term sync, one row per termtype.
            CREATE TABLE IF NOT EXISTS sync_state (
                termtype     TEXT PRIMARY KEY,
                day          TEXT,
                next_page    INTEGER DEFAULT 1,
                total_pages  INTEGER,
                completed_at TEXT
            );

            -- Historical review-workload forecast, captured free from /schedule.
            CREATE TABLE IF NOT EXISTS schedule_upcoming (
                day             TEXT NOT NULL,
                schedule_id     TEXT NOT NULL,
                due_date        TEXT NOT NULL,
                terms_to_review INTEGER,
                PRIMARY KEY (day, schedule_id, due_date)
            );

            -- TTL cache for live reibun/grammar lookups (avoid re-spending quota).
            CREATE TABLE IF NOT EXISTS api_cache (
                key        TEXT PRIMARY KEY,
                payload    TEXT,
                fetched_at TEXT NOT NULL
            );
            """
        )
        # Lightweight column migration: add adventure_level to existing DBs.
        cols = {r["name"] for r in c.execute("PRAGMA table_info(profile_snapshots)")}
        if "adventure_level" not in cols:
            c.execute("ALTER TABLE profile_snapshots ADD COLUMN adventure_level INTEGER")
        if "kao_url" not in cols:
            c.execute("ALTER TABLE profile_snapshots ADD COLUMN kao_url TEXT")
        # Lightweight column migration: add detail to existing kana_mastery tables.
        cols = {r["name"] for r in c.execute("PRAGMA table_info(kana_mastery)")}
        if "detail" not in cols:
            c.execute("ALTER TABLE kana_mastery ADD COLUMN detail TEXT")


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
                streak_json, level_percs_json, adventure_level, kao_url)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                _now(),
                studied.get("total"),
                studied.get("total_vocab"),
                studied.get("total_kanji"),
                studied.get("total_grammar"),
                studied.get("total_sent"),
                json.dumps(profile.get("streaks", {})),
                json.dumps(profile.get("level_progress_percs", {})),
                profile.get("adventure_level"),
                profile.get("kao"),
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


def profile_level_history(days: int = 90) -> list:
    """One point per day (last snapshot) of the raw level_progress_percs JSON,
    for pace forecasting (Phase 3) and the JLPT trend chart."""
    with _conn() as c:
        rows = c.execute(
            """
            SELECT date(ts) AS day, level_percs_json
            FROM profile_snapshots p
            WHERE ts >= datetime('now', ?)
              AND ts = (SELECT MAX(ts) FROM profile_snapshots WHERE date(ts) = date(p.ts))
            ORDER BY day
            """,
            (f"-{int(days)} days",),
        ).fetchall()
        out = []
        for r in rows:
            try:
                percs = json.loads(r["level_percs_json"] or "{}")
            except (TypeError, ValueError):
                percs = {}
            out.append({"day": r["day"], "percs": percs})
        return out


def jlpt_history(cat: str, level: str, days: int = 90) -> list:
    """[{day, value}] trend of one JLPT category/level's coverage %."""
    hist = profile_level_history(days)
    return [{"day": h["day"], "value": (h["percs"].get(cat) or {}).get(level)} for h in hist]


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


def latest_total_review_due() -> int:
    """Sum of review_due from the most recent snapshot of each schedule."""
    with _conn() as c:
        rows = c.execute(
            """SELECT review_due FROM schedule_snapshots s
               WHERE ts = (SELECT MAX(ts) FROM schedule_snapshots
                           WHERE schedule_id = s.schedule_id)"""
        ).fetchall()
        return sum((r["review_due"] or 0) for r in rows)


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


# --- achievements ---------------------------------------------------------

def earned_achievements() -> dict:
    """Map of achievement id -> {earned_at, claimed_at} for earned achievements."""
    with _conn() as c:
        rows = c.execute("SELECT id, earned_at, claimed_at FROM achievements").fetchall()
        return {r["id"]: {"earned_at": r["earned_at"], "claimed_at": r["claimed_at"]} for r in rows}


def mark_earned(achievement_id: str):
    """Record an achievement as earned (no-op if already recorded)."""
    with _conn() as c:
        c.execute(
            "INSERT INTO achievements(id, earned_at) VALUES(?, ?) "
            "ON CONFLICT(id) DO NOTHING",
            (achievement_id, _now()),
        )


def mark_claimed(achievement_id: str) -> bool:
    """Mark an earned achievement as claimed. Returns False if not yet earned."""
    with _conn() as c:
        row = c.execute(
            "SELECT 1 FROM achievements WHERE id = ?", (achievement_id,)
        ).fetchone()
        if not row:
            return False
        c.execute(
            "UPDATE achievements SET claimed_at = ? WHERE id = ? AND claimed_at IS NULL",
            (_now(), achievement_id),
        )
        return True


def learned_today() -> int:
    """Terms learned so far today (UTC), from the schedule-snapshot diff."""
    for p in reversed(daily_activity(1)):
        if p["day"] == datetime.now(timezone.utc).date().isoformat():
            return p["learned"]
    return 0


# --- push subscriptions ---------------------------------------------------

def save_push_subscription(endpoint: str, p256dh: str, auth: str):
    with _conn() as c:
        c.execute(
            "INSERT INTO push_subscriptions(endpoint, p256dh, auth, created_at) "
            "VALUES(?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET "
            "p256dh = excluded.p256dh, auth = excluded.auth",
            (endpoint, p256dh, auth, _now()),
        )


def list_push_subscriptions() -> list:
    with _conn() as c:
        rows = c.execute(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions"
        ).fetchall()
        return [dict(r) for r in rows]


def delete_push_subscription(endpoint: str):
    with _conn() as c:
        c.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (endpoint,))


def count_push_subscriptions() -> int:
    with _conn() as c:
        row = c.execute("SELECT COUNT(*) AS n FROM push_subscriptions").fetchone()
        return row["n"] if row else 0


# --- api usage --------------------------------------------------------------

def upsert_api_usage(calls_today: int, daily_allowance: int):
    with _conn() as c:
        c.execute(
            "INSERT INTO api_usage(id, calls_today, daily_allowance, ts) VALUES(1, ?, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET calls_today = excluded.calls_today, "
            "daily_allowance = excluded.daily_allowance, ts = excluded.ts",
            (calls_today, daily_allowance, _now()),
        )


def latest_api_usage():
    with _conn() as c:
        row = c.execute(
            "SELECT calls_today, daily_allowance, ts FROM api_usage WHERE id = 1"
        ).fetchone()
        return dict(row) if row else None


# --- spotlight ---------------------------------------------------------------

def replace_spotlight(words: list):
    """Overwrite today's spotlight words (called once per daily poll)."""
    day = datetime.now(timezone.utc).date().isoformat()
    with _conn() as c:
        c.execute("DELETE FROM spotlight WHERE day = ?", (day,))
        c.executemany(
            "INSERT INTO spotlight(day, word_id, kanji_full, hiragana_full, def, mastery) "
            "VALUES (?,?,?,?,?,?)",
            [
                (day, w.get("word_id"), w.get("kanji_full"), w.get("hiragana_full"),
                 w.get("def"), w.get("mastery"))
                for w in words
            ],
        )


def latest_spotlight() -> list:
    with _conn() as c:
        row = c.execute("SELECT MAX(day) AS day FROM spotlight").fetchone()
        if not row or not row["day"]:
            return []
        rows = c.execute(
            "SELECT word_id, kanji_full, hiragana_full, def, mastery "
            "FROM spotlight WHERE day = ?",
            (row["day"],),
        ).fetchall()
        return [dict(r) for r in rows]


# --- kana mastery -------------------------------------------------------------

def replace_kana_mastery(section: str, rows: list):
    """Overwrite today's mastery rows for one section (hiragana/katakana/kanji)."""
    day = datetime.now(timezone.utc).date().isoformat()
    with _conn() as c:
        c.execute("DELETE FROM kana_mastery WHERE day = ? AND section = ?", (day, section))
        c.executemany(
            "INSERT INTO kana_mastery(day, section, char, score, detail) VALUES (?,?,?,?,?)",
            [
                (day, section, r["char"], r["score"], json.dumps(r["detail"]) if r.get("detail") else None)
                for r in rows
            ],
        )


def latest_kana_mastery() -> dict:
    """{section: {char: {"score": int, "detail": dict|None}}} from the most recent captured day."""
    with _conn() as c:
        row = c.execute("SELECT MAX(day) AS day FROM kana_mastery").fetchone()
        if not row or not row["day"]:
            return {}
        rows = c.execute(
            "SELECT section, char, score, detail FROM kana_mastery WHERE day = ?",
            (row["day"],),
        ).fetchall()
        out: dict = {}
        for r in rows:
            out.setdefault(r["section"], {})[r["char"]] = {
                "score": r["score"],
                "detail": json.loads(r["detail"]) if r["detail"] else None,
            }
        return out


def kana_mastery_n_days_ago(days: int) -> dict:
    """{section: {char: score}} from the closest captured day >= `days` ago."""
    with _conn() as c:
        row = c.execute(
            "SELECT MAX(day) AS day FROM kana_mastery WHERE day <= date('now', ?)",
            (f"-{int(days)} days",),
        ).fetchone()
        if not row or not row["day"]:
            return {}
        rows = c.execute(
            "SELECT section, char, score FROM kana_mastery WHERE day = ?",
            (row["day"],),
        ).fetchall()
        out: dict = {}
        for r in rows:
            out.setdefault(r["section"], {})[r["char"]] = r["score"]
        return out


# --- Kao mascot history ----------------------------------------------------

def kao_history() -> list:
    """Distinct Kao image URLs over time: [{kao_url, first_seen, adventure_level}]."""
    with _conn() as c:
        rows = c.execute(
            """
            SELECT kao_url, MIN(date(ts)) AS first_seen,
                   (SELECT adventure_level FROM profile_snapshots p2
                    WHERE p2.kao_url = p.kao_url ORDER BY ts ASC LIMIT 1) AS adventure_level
            FROM profile_snapshots p
            WHERE kao_url IS NOT NULL AND kao_url != ''
            GROUP BY kao_url
            ORDER BY first_seen ASC
            """
        ).fetchall()
        return [dict(r) for r in rows]


# --- term sync (Phase 1) ---------------------------------------------------

def upsert_terms(termtype: str, terms: list):
    """Insert/update term rows; `first_seen` sticks, `last_seen` always advances."""
    if not terms:
        return
    now = _now()
    with _conn() as c:
        c.executemany(
            """
            INSERT INTO terms (termtype, term_id, display, reading, definition, jlpt, payload, first_seen, last_seen)
            VALUES (?,?,?,?,?,?,?,?,?)
            ON CONFLICT(termtype, term_id) DO UPDATE SET
                display = excluded.display,
                reading = excluded.reading,
                definition = excluded.definition,
                jlpt = excluded.jlpt,
                payload = excluded.payload,
                last_seen = excluded.last_seen
            """,
            [
                (
                    termtype, t["term_id"], t.get("display"), t.get("reading"),
                    t.get("definition"), t.get("jlpt"), json.dumps(t.get("payload") or {}),
                    now, now,
                )
                for t in terms
            ],
        )


def insert_term_mastery_if_changed(termtype: str, rows: list) -> int:
    """INSERT OR REPLACE mastery facts, skipping any unchanged from the latest
    known row for that term. Idempotent for a same-day re-sync. Returns the
    number of rows actually written."""
    if not rows:
        return 0
    with _conn() as c:
        latest = {
            r["term_id"]: (r["mastery"], r["correct"], r["missed"])
            for r in c.execute(
                """
                SELECT term_id, mastery, correct, missed FROM term_mastery_daily t
                WHERE termtype = ? AND day = (
                    SELECT MAX(day) FROM term_mastery_daily
                    WHERE termtype = t.termtype AND term_id = t.term_id
                )
                """,
                (termtype,),
            )
        }
        today = datetime.now(timezone.utc).date().isoformat()
        to_write = []
        for r in rows:
            key = (r["mastery"], r["correct"], r["missed"])
            if latest.get(r["term_id"]) == key:
                continue
            to_write.append(
                (today, termtype, r["term_id"], r["mastery"], r["correct"], r["missed"],
                 json.dumps(r.get("vectors") or {}))
            )
        if to_write:
            c.executemany(
                """INSERT INTO term_mastery_daily
                   (day, termtype, term_id, mastery, correct, missed, vectors_json)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(day, termtype, term_id) DO UPDATE SET
                       mastery = excluded.mastery, correct = excluded.correct,
                       missed = excluded.missed, vectors_json = excluded.vectors_json""",
                to_write,
            )
        return len(to_write)


def latest_term_mastery(termtype: str | None = None) -> list:
    """Latest known mastery row per term, joined to `terms` for display info.
    Filters by termtype if given, else all termtypes."""
    with _conn() as c:
        where = "WHERE te.termtype = ?" if termtype else ""
        params = (termtype,) if termtype else ()
        rows = c.execute(
            f"""
            SELECT te.termtype, te.term_id, te.display, te.reading, te.definition, te.jlpt,
                   tmd.day, tmd.mastery, tmd.correct, tmd.missed, tmd.vectors_json
            FROM terms te
            LEFT JOIN term_mastery_daily tmd
                ON tmd.termtype = te.termtype AND tmd.term_id = te.term_id
                AND tmd.day = (
                    SELECT MAX(day) FROM term_mastery_daily
                    WHERE termtype = te.termtype AND term_id = te.term_id
                )
            {where}
            """,
            params,
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["vectors"] = json.loads(d.pop("vectors_json") or "null") or {}
            out.append(d)
        return out


def get_term(termtype: str, term_id: str):
    """Full `terms` row (incl. raw payload) joined to its latest mastery fact."""
    with _conn() as c:
        row = c.execute(
            """
            SELECT te.termtype, te.term_id, te.display, te.reading, te.definition, te.jlpt, te.payload,
                   tmd.day, tmd.mastery, tmd.correct, tmd.missed, tmd.vectors_json
            FROM terms te
            LEFT JOIN term_mastery_daily tmd
                ON tmd.termtype = te.termtype AND tmd.term_id = te.term_id
                AND tmd.day = (
                    SELECT MAX(day) FROM term_mastery_daily
                    WHERE termtype = te.termtype AND term_id = te.term_id
                )
            WHERE te.termtype = ? AND te.term_id = ?
            """,
            (termtype, term_id),
        ).fetchone()
        if not row:
            return None
        d = dict(row)
        d["vectors"] = json.loads(d.pop("vectors_json") or "null") or {}
        d["payload"] = json.loads(d.pop("payload") or "null") or {}
        return d


def term_mastery_history(termtype: str, term_id: str, days: int = 90) -> list:
    with _conn() as c:
        rows = c.execute(
            """SELECT day, mastery, correct, missed FROM term_mastery_daily
               WHERE termtype = ? AND term_id = ? AND day >= date('now', ?)
               ORDER BY day""",
            (termtype, term_id, f"-{int(days)} days"),
        ).fetchall()
        return [dict(r) for r in rows]


def get_sync_state(termtype: str):
    with _conn() as c:
        row = c.execute(
            "SELECT termtype, day, next_page, total_pages, completed_at FROM sync_state WHERE termtype = ?",
            (termtype,),
        ).fetchone()
        return dict(row) if row else None


def set_sync_state(termtype: str, day: str, next_page: int, total_pages: int | None = None, completed: bool = False):
    with _conn() as c:
        c.execute(
            """INSERT INTO sync_state (termtype, day, next_page, total_pages, completed_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(termtype) DO UPDATE SET
                   day = excluded.day, next_page = excluded.next_page,
                   total_pages = excluded.total_pages,
                   completed_at = excluded.completed_at""",
            (termtype, day, next_page, total_pages, _now() if completed else None),
        )


def write_mastery_agg(day: str):
    """Recompute the mastery_daily_agg row for `day` from the latest per-term mastery."""
    with _conn() as c:
        termtypes = [r["termtype"] for r in c.execute("SELECT DISTINCT termtype FROM terms")]
        for termtype in termtypes:
            rows = c.execute(
                """
                SELECT tmd.mastery FROM terms te
                JOIN term_mastery_daily tmd
                    ON tmd.termtype = te.termtype AND tmd.term_id = te.term_id
                    AND tmd.day = (
                        SELECT MAX(day) FROM term_mastery_daily
                        WHERE termtype = te.termtype AND term_id = te.term_id
                    )
                WHERE te.termtype = ?
                """,
                (termtype,),
            ).fetchall()
            masteries = [r["mastery"] or 0 for r in rows]
            total = len(masteries)
            avg_mastery = sum(masteries) / total if total else 0.0
            buckets = {"b0": 0, "b20": 0, "b40": 0, "b60": 0, "b80": 0}
            for m in masteries:
                if m < 20:
                    buckets["b0"] += 1
                elif m < 40:
                    buckets["b20"] += 1
                elif m < 60:
                    buckets["b40"] += 1
                elif m < 80:
                    buckets["b60"] += 1
                else:
                    buckets["b80"] += 1
            c.execute(
                """INSERT INTO mastery_daily_agg (day, termtype, total, avg_mastery, b0, b20, b40, b60, b80)
                   VALUES (?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(day, termtype) DO UPDATE SET
                       total = excluded.total, avg_mastery = excluded.avg_mastery,
                       b0 = excluded.b0, b20 = excluded.b20, b40 = excluded.b40,
                       b60 = excluded.b60, b80 = excluded.b80""",
                (day, termtype, total, avg_mastery, buckets["b0"], buckets["b20"],
                 buckets["b40"], buckets["b60"], buckets["b80"]),
            )


def mastery_agg_history(termtype: str, days: int = 60) -> list:
    with _conn() as c:
        rows = c.execute(
            """SELECT day, total, avg_mastery, b0, b20, b40, b60, b80
               FROM mastery_daily_agg WHERE termtype = ? AND day >= date('now', ?)
               ORDER BY day""",
            (termtype, f"-{int(days)} days"),
        ).fetchall()
        return [dict(r) for r in rows]


def latest_mastery_agg(termtype: str):
    with _conn() as c:
        row = c.execute(
            """SELECT day, total, avg_mastery, b0, b20, b40, b60, b80
               FROM mastery_daily_agg WHERE termtype = ? ORDER BY day DESC LIMIT 1""",
            (termtype,),
        ).fetchone()
        return dict(row) if row else None


def insert_schedule_upcoming(schedule_id: str, upcoming: list):
    day = datetime.now(timezone.utc).date().isoformat()
    with _conn() as c:
        c.executemany(
            """INSERT INTO schedule_upcoming (day, schedule_id, due_date, terms_to_review)
               VALUES (?,?,?,?)
               ON CONFLICT(day, schedule_id, due_date) DO UPDATE SET
                   terms_to_review = excluded.terms_to_review""",
            [
                (day, schedule_id, str(u.get("days_in_future")), int(float(u.get("terms_to_review") or 0)))
                for u in upcoming
            ],
        )


def latest_schedule_upcoming() -> list:
    """Most recently captured upcoming-review rows, across all schedules."""
    with _conn() as c:
        row = c.execute("SELECT MAX(day) AS day FROM schedule_upcoming").fetchone()
        if not row or not row["day"]:
            return []
        rows = c.execute(
            "SELECT schedule_id, due_date, terms_to_review FROM schedule_upcoming WHERE day = ?",
            (row["day"],),
        ).fetchall()
        return [dict(r) for r in rows]


def cache_get(key: str, ttl_days: int = 30):
    with _conn() as c:
        row = c.execute(
            "SELECT payload, fetched_at FROM api_cache WHERE key = ? AND fetched_at >= datetime('now', ?)",
            (key, f"-{int(ttl_days)} days"),
        ).fetchone()
        if not row:
            return None
        try:
            return json.loads(row["payload"])
        except (TypeError, ValueError):
            return None


def cache_put(key: str, payload):
    with _conn() as c:
        c.execute(
            """INSERT INTO api_cache (key, payload, fetched_at) VALUES (?,?,?)
               ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at""",
            (key, json.dumps(payload), _now()),
        )
