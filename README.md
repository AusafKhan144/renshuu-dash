# 練習 · Renshuu Progress Dashboard

A prettier, self-hosted dashboard for your [Renshuu](https://www.renshuu.org)
Japanese studies — progress graphs over time, a JLPT coverage view, an upcoming
review forecast, and **"time to review" push notifications to your phone via
Google Chat**.

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
2. *(Optional)* **Paste a Google Chat webhook** for phone reminders, then hit
   **Test** to confirm a message arrives. Create one in a Chat space via
   *Apps & integrations → Webhooks → Create*.

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
   | `RENSHUU_API_KEY` / `GOOGLE_CHAT_WEBHOOK` | optional | Seed these to skip the in-app wizard. |

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

- **Overview cards** — vocab / kanji / grammar totals with weekly deltas + streak.
- **Progress over time** — area charts that fill in as daily snapshots accumulate.
- **JLPT coverage** — radial breakdown N5→N1.
- **Review forecast** — bar chart of upcoming reviews across all schedules.
- **Schedules** — per-schedule progress bars and what's due now.
- **Notifications** — Google Chat message when reviews are ready (once per day,
  no spam), plus in-app toasts while the dashboard is open.
- **Activity heatmap** — GitHub-style calendar of terms learned per day.
- **Adjustable ranges** — switch the trend and activity charts between 7/30/90 days.
- **Settings panel** — update your API key / webhook or log out without touching
  the DB (gear icon, top right).
- **Light/dark theme** — toggle in the header, remembered per browser.
- **Installable PWA** — add it to your phone's home screen or install on desktop.

## How it works

```
renshuu_client.py     Shared Renshuu API client (rate-limit aware, 429 backoff)
backend/              FastAPI: setup + data API, serves the SPA, runs the poller
  poller.py           Snapshots schedules hourly + profile daily; fires reminders
  notifier.py         Google Chat webhook sender
  db.py               SQLite: settings, snapshots, notification log
frontend/             React 19 + Vite + Tailwind v4 + Recharts SPA
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
- Your API key + webhook are stored in the local SQLite DB (`.gitignore`d).
  On your own machine that's fine; don't commit the `.db` file.
- **Data persistence (Docker):** the SQLite DB is bind-mounted to `./data` on the
  host, so your snapshot history survives container restarts, `up --build`, and
  even `docker compose down -v`. Back it up by copying the `./data` folder.
- Bonus: `renshuu_import.py` is a CLI to bulk-import a 2-column CSV
  (`Japanese,English`) into a Renshuu list — `python renshuu_import.py --list-lists`.
