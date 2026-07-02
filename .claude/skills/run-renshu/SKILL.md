---
name: run-renshu
description: Build, run, and drive the renshu Japanese-study dashboard (FastAPI backend + React SPA, served together on :8000). Use when asked to start renshu, take a screenshot of its UI (dashboard, kana, lists, settings), or interact with the running app.
---

renshu is a FastAPI backend that serves a built React SPA at the same
origin (`http://localhost:8000`). There's no separate frontend dev
server to drive in the agent path — build the SPA, run the backend, and
drive the one URL with the Playwright REPL at `driver.mjs` in this
skill directory.

All paths below are relative to the repo root.

## Prerequisites

Playwright's own Chromium download needs `sudo` for OS deps
(`install-deps`), which isn't available non-interactively in this
container — don't bother running it. A working `chromium-1179`
(non-headless-shell) build was already cached at
`~/.cache/ms-playwright/`; `driver.mjs` finds it automatically (see
Gotchas). If that cache doesn't exist on your box, run
`npx playwright install chromium` first.

## Setup

The driver has its own tiny `node_modules` inside this skill directory
(kept separate from `frontend/`'s deps — this is agent tooling, not
product code):

```bash
cd .claude/skills/run-renshu && npm install   # installs playwright-core from package.json
```

## Build & run the app

Check if it's already running first — the backend container is
frequently left up from manual testing:

```bash
curl -sf http://localhost:8000/ >/dev/null && echo "already running"
```

If not, bring it up with Docker Compose (auth is disabled by default —
`APP_PASSWORD` is commented out in `docker-compose.yml` — so the app
opens straight to the dashboard, no login step needed):

```bash
docker compose up --build -d
timeout 60 bash -c 'until curl -sf http://localhost:8000/ >/dev/null; do sleep 1; done'
```

If the instance you find already running *does* have
`APP_PASSWORD` set (check with `docker exec <container> printenv
APP_PASSWORD` **from an interactive shell, not from a script** — see
Gotchas), export it before driving:

```bash
export APP_PASSWORD=<value from docker exec above>
```

## Run (agent path)

Pipe commands to the driver over stdin — no tmux needed, commands run
serialized in order even when piped as one block:

```bash
cd /home/wmc/BE/renshu
APP_PASSWORD=test node .claude/skills/run-renshu/driver.mjs <<'EOF'
launch
login
nav kana
ss kana
quit
EOF
```

Screenshots land in `/tmp/shots/` (override: `SCREENSHOT_DIR`).

### Commands

| command | what it does |
|---|---|
| `launch` | launch headless Chromium |
| `login [password]` | go to `/`, fill+submit the password gate if one is shown (no-op if auth is disabled). Falls back to `$APP_PASSWORD` if no arg given. |
| `nav <dashboard\|kana\|lists\|settings>` | click the matching bottom-nav tab |
| `ss [name]` | screenshot → `/tmp/shots/<name>.png` |
| `click <css-sel>` | Playwright `.click()` |
| `fill <css-sel> <value>` | Playwright `.fill()` |
| `wait <css-sel>` | wait up to 10s for a selector |
| `text [css-sel]` | print `innerText` (whole page if no selector) |
| `url` | print current URL |
| `quit` | close browser, exit |

For iterative debugging, run the same heredoc under `tmux send-keys` /
`capture-pane` if tmux is available on your box — it wasn't in this
container, so the piped-heredoc path above is what was actually
verified.

## Run (human path)

```bash
docker compose up --build   # http://localhost:8000, Ctrl-C to stop
```

## Test

No test suite exists in this repo (`frontend/package.json` has no
`test` script; no `tests/` in `backend/`). Nothing to run here beyond
the driver flow above.

## Gotchas

- **`chromium.launch()` fails looking for `chromium_headless_shell-1228`.**
  The `playwright-core` version resolved by `npm install` wants a newer
  headless-shell build than what's cached on this box
  (`chromium_headless_shell-1148`/`1179`), and `npx playwright install`
  needs `sudo` for `install-deps` which isn't available
  non-interactively here. Fix: point `executablePath` at the cached
  **full** Chromium build instead (`chromium-1179/chrome-linux/chrome`)
  — it launches headless fine via the normal `headless: true` default,
  no headless-shell binary required. `driver.mjs`'s `findChromium()`
  does this automatically by scanning `~/.cache/ms-playwright/` for
  `chromium-*` dirs; override with `CHROMIUM_PATH` if yours differs.

- **`docker exec`/`docker ps --filter` silently fail (or return empty)
  when invoked from a Node `child_process`, but work fine typed
  directly into an interactive shell.** This box runs snap Docker,
  which is prone to an AppArmor profile mismatch after snap
  auto-refresh (`cannot stop container: permission denied` on
  `stop`/`exec`/`kill` — see the `docker-snap-apparmor-stop-deadlock`
  memory for the full fix). Rather than have the driver silently
  swallow that flakiness, `getPassword()` does **not** shell out to
  Docker at all — it only reads `$APP_PASSWORD`. Fetch the password
  yourself via `docker exec <container> printenv APP_PASSWORD` typed
  into your own shell, then export it before running the driver.

- **`docker ps --filter publish=8000` returns nothing on this box**
  even though the container is genuinely listening on that port. Use
  `docker ps --format '{{.ID}} {{.Ports}}' | grep ':8000->'` instead.

- **Piped heredoc input can race.** `readline`'s `'line'` event fires
  for every buffered line as soon as the chunk arrives, without
  waiting for an earlier `async` handler (e.g. `launch`) to resolve —
  so `login` could run before the browser exists. `driver.mjs`
  serializes command execution through a promise chain
  (`queue = queue.then(...)`) so piped scripts behave the same as
  typing one command at a time.

- **Bottom nav has no route/URL per tab in the DOM sense** — it's
  client-side state (`Page` type in `Sidebar.tsx`), reflected only in
  the `#hash`. `nav <name>` drives it by clicking
  `nav button:has-text("<Label>")`, not by `page.goto()`-ing a path.

## Troubleshooting

- **Password gate never disappears after `login`:** wrong password —
  re-check with `docker exec <container> printenv APP_PASSWORD` in an
  interactive shell (not scripted; see Gotchas).
- **`ERROR: no nav button matching X`:** you're probably still on the
  password gate (bottom nav doesn't render until unlocked) — run
  `login` first, or check `auth_required()` — the app may have
  `APP_PASSWORD` unset, in which case there's no gate at all.
- **Screenshot is blank/white:** check `text` output and the
  `[console.error]`/`[pageerror]` lines the driver prints — the SPA
  shell can render with every data fetch failing silently otherwise.
