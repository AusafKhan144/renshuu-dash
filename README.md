# 練習 · Renshuu Progress Dashboard

A prettier, self-hosted dashboard for your [Renshuu](https://www.renshuu.org)
Japanese studies — a warm "Command Deck" with progress graphs over time, a JLPT
coverage view, an upcoming review forecast, computed levels & achievements, and
**"time to review" push notifications to your phone as a PWA**.

**Fork it, plug in your own API key, get your own insights.** Each person runs
their own instance, so your key never leaves your machine.

![single-user · self-hosted · Renshuu API](https://img.shields.io/badge/self--hosted-single--user-blue)

---

## Quick start (Docker — recommended)

```bash
git clone <your-fork-url> renshu
cd renshu
docker compose up --build
```

Then open **http://localhost:8000** and follow the **setup wizard**:

1. **Paste your Renshuu API key** — get it from *Renshuu → Resources → API*.
   It's validated live (you'll see your account name on success).
2. *(Optional)* **Enable phone notifications** — install the dashboard to your
   home screen (Add to Home Screen; iOS needs 16.4+), then tap **Enable
   notifications** in the wizard or Settings. Reminders arrive via Web Push even
   when the app is closed. Requires HTTPS in production.

That's it — no file editing required. The background poller starts capturing
daily snapshots immediately.

## Quick start (manual / no Docker)

```bash
# Backend (API + poller)
pip install -r backend/requirements.txt
cd backend && uvicorn app:app --reload --port 8000

# Frontend (in another terminal)
cd frontend && npm install && npm run dev
# open http://localhost:5173  (dev server proxies /api to the backend)
```

For production, `cd frontend && npm run build` and the backend will serve the
built SPA from `frontend/dist` at http://localhost:8000.

## Deploy to Railway (use it on your phone, anywhere)

The repo ships a single combined image (root `Dockerfile`) that builds the SPA
and serves it + the API on one port, plus a `railway.toml` that pins that
builder. Steps:

1. Push this repo to GitHub, then in Railway **New Project → Deploy from GitHub
   repo** (or run `railway up` from this folder with the Railway CLI).
2. Add a **Volume** mounted at **`/data`** so your SQLite snapshot history
   survives every redeploy. *(Without it, your trend graphs reset on each
   deploy.)*
3. Set these **Variables**:
   | Variable | Required | Notes |
   |---|---|---|
   | `APP_PASSWORD` | **yes** | Password that gates the whole site. **You must set this** — without it the app is wide open to anyone with the URL. |
   | `APP_SECRET` | recommended | Random string used to sign the login cookie. Set a stable value so logins survive redeploys. |
   | `RENSHU_DB_PATH` | yes | `/data/renshuu_progress.db` (points SQLite at the volume). |
   | `RENSHUU_API_KEY` | optional | Seed this to skip the in-app wizard. |
   | `VAPID_SUBJECT` | optional | `mailto:` used as the push "sub" claim. VAPID keys themselves are auto-generated and stored in the DB. |

Railway serves everything over HTTPS, so the secure session cookie just works.
Open the URL, log in, then **Add to Home Screen** (mobile) or **Install**
(desktop) — it's a PWA, so it runs like a native app.

> **Security model:** a single shared password protects all data and setup
> routes; the session is an `HttpOnly`, `Secure`, signed cookie. This is the
> right level for a single-user instance. The Renshuu API key is still stored in
> the (now volume-backed, non-public) SQLite DB.

### Running the combined image locally

```bash
docker build -t renshu .
docker run -p 8000:8000 \
  -e APP_PASSWORD=test -e APP_SECRET=dev -e APP_COOKIE_SECURE=false \
  -v "$PWD/data:/data" renshu
```

`APP_COOKIE_SECURE=false` lets the cookie work over plain http locally. If
`APP_PASSWORD` is unset, auth is disabled entirely (convenient for a private,
local-only instance).

---

## What you get

- **Command Deck** — a warm, dense dashboard: daily-goal ring, level progress,
  data-driven insights, stat cards, JLPT coverage, trends, forecast, heatmap,
  achievements, and schedules on one screen.
- **Levels & XP** — a level and title computed from your real studied-term totals,
  with progress to the next level. (Renshuu's own adventure level is kept too.)
- **Achievements** — streak, term-count, and JLPT-coverage milestones evaluated
  from your snapshots; claim newly-earned ones for a little confetti.
- **Progress over time / forecast / heatmap** — lightweight inline-SVG charts that
  fill in as daily snapshots accumulate.
- **Push notifications** — a phone reminder when reviews are ready (once per day,
  no spam) via Web Push, plus in-app toasts while the dashboard is open.
- **Settings panel** — update your API key, set a daily goal, manage notifications,
  or log out (gear icon, top right).
- **Light/dark theme** — toggle in the header, remembered per browser.
- **Installable PWA** — add it to your phone's home screen or install on desktop.

## How it works

```
renshuu_client.py     Shared Renshuu API client (rate-limit aware, 429 backoff)
backend/              FastAPI: setup + data API, serves the SPA, runs the poller
  poller.py           Snapshots schedules hourly + profile daily; fires reminders
  gamification.py     XP/levels, achievements, and insights from snapshots
  push.py             Web Push (VAPID) delivery + subscription storage
  notifier.py         Builds review reminders and sends them via push
  db.py               SQLite: settings, snapshots, achievements, subs, notif log
frontend/             React 19 + Vite + Tailwind v4 SPA (inline-SVG charts)
```

**Why a backend?** The Renshuu API key can't safely live in a browser, and the
Renshuu API only returns *current* state. So the backend holds the key and
**persists daily snapshots** — which is how you get history/trend graphs that
Renshuu itself doesn't offer. **Trends therefore start from the day you begin
running this.**

## Rate limits

Renshuu's free tier allows 500 calls/day and has a tighter per-minute burst
limit. The poller's budget is tiny (~25 calls/day) and the shared client spaces
calls out and backs off on HTTP 429, so you stay well clear of both.

## Notes

- **Single-user-per-instance** by design; multi-tenant hosting is out of scope.
- Your API key and VAPID push keys are stored in the local SQLite DB
  (`.gitignore`d). On your own machine that's fine; don't commit the `.db` file.
- **Data persistence (Docker):** the SQLite DB is bind-mounted to `./data` on the
  host, so your snapshot history survives container restarts, `up --build`, and
  even `docker compose down -v`. Back it up by copying the `./data` folder.
- Bonus: `renshuu_import.py` is a CLI to bulk-import a 2-column CSV
  (`Japanese,English`) into a Renshuu list — `python renshuu_import.py --list-lists`.
