// REPL driver for the renshu dashboard (FastAPI + React SPA, served together
// at http://localhost:8000 by the `backend` container).
// Uses playwright-core against the Chromium binary Playwright's own installer
// cached on this box (see Gotchas in SKILL.md re: version mismatch).
// Designed for agents: wrap in tmux, send-keys commands, capture-pane output.
import { chromium } from 'playwright-core';
import * as readline from 'node:readline';
import * as fs from 'node:fs';
import * as path from 'node:path';

const BASE_URL = process.env.RENSHU_URL || 'http://localhost:8000';
const SHOT_DIR = process.env.SCREENSHOT_DIR || '/tmp/shots';
fs.mkdirSync(SHOT_DIR, { recursive: true });

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cacheDir = path.join(process.env.HOME, '.cache/ms-playwright');
  const dirs = fs.existsSync(cacheDir)
    ? fs.readdirSync(cacheDir).filter(d => /^chromium-\d+$/.test(d)).sort().reverse()
    : [];
  for (const d of dirs) {
    const p = path.join(cacheDir, d, 'chrome-linux/chrome');
    if (fs.existsSync(p)) return p;
  }
  return undefined; // let Playwright try its own default and fail loudly
}

let browser = null;
let page = null;

// Not auto-detected via `docker exec` into the running container: on this
// box's snap Docker install, `docker exec`/`stop` intermittently fail with
// "permission denied" from an AppArmor profile mismatch (see SKILL.md
// Gotchas) — a subprocess spawned from node hits this far more reliably
// than an interactive shell does. Cheaper to just require the caller to
// export APP_PASSWORD (or pass it to `login`) than to paper over that.
function getPassword() {
  return process.env.APP_PASSWORD || null;
}

const COMMANDS = {
  async launch() {
    if (browser) return console.log('already launched');
    browser = await chromium.launch({
      args: ['--no-sandbox'],
      executablePath: findChromium(),
    });
    page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    page.on('console', msg => { if (msg.type() === 'error') console.log('[console.error]', msg.text()); });
    page.on('pageerror', err => console.log('[pageerror]', String(err)));
    console.log('launched.');
  },

  async login(pw) {
    if (!page) return console.log('ERROR: launch first');
    const password = pw || getPassword();
    if (!password) return console.log('ERROR: no password — pass one, set APP_PASSWORD, or run the backend container');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const gate = await page.locator('input[type="password"]').count();
    if (gate === 0) return console.log('no password gate shown (already unlocked, or auth disabled)');
    await page.fill('input[type="password"]', password);
    await page.click('button:has-text("Unlock")');
    await page.waitForTimeout(1000);
    console.log('login submitted. url:', page.url());
  },

  async nav(dest) {
    // dest: dashboard | kana | lists | settings (matches BottomNav labels)
    if (!page) return console.log('ERROR: launch first');
    if (!dest || dest === 'dashboard' || dest === 'home') {
      await page.goto(BASE_URL, { waitUntil: 'networkidle' });
      return console.log('nav → dashboard, url:', page.url());
    }
    const label = dest[0].toUpperCase() + dest.slice(1);
    const btn = page.locator(`nav button:has-text("${label}")`).first();
    const n = await btn.count();
    if (n === 0) return console.log('ERROR: no nav button matching', label);
    await btn.click();
    await page.waitForTimeout(800);
    console.log('nav →', dest, 'url:', page.url());
  },

  async ss(name) {
    if (!page) return console.log('ERROR: launch first');
    const f = path.join(SHOT_DIR, (name || `ss-${Date.now()}`) + '.png');
    await page.screenshot({ path: f });
    console.log('screenshot:', f);
  },

  async click(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.click(sel, { timeout: 5000 }); console.log('clicked:', sel); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async fill(args) {
    if (!page) return console.log('ERROR: launch first');
    const sp = args.indexOf(' ');
    const sel = sp === -1 ? args : args.slice(0, sp);
    const value = sp === -1 ? '' : args.slice(sp + 1);
    try { await page.fill(sel, value); console.log('filled:', sel); }
    catch (e) { console.log('ERROR:', e.message); }
  },

  async wait(sel) {
    if (!page) return console.log('ERROR: launch first');
    try { await page.waitForSelector(sel, { timeout: 10_000 }); console.log('found:', sel); }
    catch { console.log('TIMEOUT:', sel); }
  },

  async text(sel) {
    if (!page) return console.log('ERROR: launch first');
    console.log(await page.evaluate(
      s => (s ? document.querySelector(s) : document.body)?.innerText ?? '(null)',
      sel || null));
  },

  async url() {
    if (!page) return console.log('ERROR: launch first');
    console.log(page.url());
  },

  async quit() { if (browser) await browser.close().catch(() => {}); browser = null; page = null; },
  help() { console.log('commands:', Object.keys(COMMANDS).join(', ')); },
};

const stdin = fs.createReadStream(null, { fd: fs.openSync('/dev/stdin', 'r') });
const rl = readline.createInterface({ input: stdin, output: process.stdout, prompt: 'driver> ' });

// Piped/heredoc input arrives as one buffered chunk, so readline can emit
// several 'line' events before an earlier async handler (e.g. `launch`)
// resolves. Serialize through a promise chain so piped scripts run in order
// same as typed-interactively input would.
let queue = Promise.resolve();

async function runLine(line) {
  const trimmed = line.trim();
  const sp = trimmed.indexOf(' ');
  const cmd = sp === -1 ? trimmed : trimmed.slice(0, sp);
  const rest = sp === -1 ? '' : trimmed.slice(sp + 1);
  if (!cmd) return rl.prompt();
  const fn = COMMANDS[cmd];
  if (!fn) { console.log('unknown:', cmd, '— try: help'); return rl.prompt(); }
  try { await fn(rest); } catch (e) { console.log('ERROR:', e.message); }
  if (cmd === 'quit') { rl.close(); process.exit(0); }
  rl.prompt();
}

rl.on('line', line => { queue = queue.then(() => runLine(line)); });
rl.on('close', async () => { await queue; await COMMANDS.quit(); process.exit(0); });

console.log('renshu driver — "help" for commands, "launch" then "login" to start');
rl.prompt();
