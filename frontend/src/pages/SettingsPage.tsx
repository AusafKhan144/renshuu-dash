import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, KeyRound, Loader2, LogOut, RefreshCw, Sparkles, Target } from "lucide-react";
import {
  api,
  logout,
  setDailyGoal,
  setDigestEnabled,
  setStreakCheckEnabled,
  syncTerms,
  useAuthStatus,
  useOverview,
  useSetupStatus,
  useUsage,
} from "../api/client";
import { Ring } from "../components/charts";
import { enablePush, disablePush, pushEnabledLocally, pushSupported } from "../push";

export function SettingsPage() {
  const qc = useQueryClient();
  const status = useSetupStatus(true);
  const auth = useAuthStatus();
  const overview = useOverview(true);
  const usage = useUsage(true);
  const [apiKey, setApiKey] = useState("");
  const [savingKey, setSavingKey] = useState(false);

  const accountName = status.data?.account?.name;
  const ov = overview.data;

  async function saveKey() {
    if (!apiKey.trim()) return;
    setSavingKey(true);
    try {
      const res = await api.post("/setup/key", { api_key: apiKey.trim() });
      toast.success(`Updated — connected as ${res.data.account?.name ?? "your account"}!`);
      setApiKey("");
      await qc.invalidateQueries();
    } catch {
      toast.error("That key was rejected by Renshuu. Double-check and retry.");
    } finally {
      setSavingKey(false);
    }
  }

  async function doLogout() {
    await logout();
    await qc.invalidateQueries();
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-[22px] font-bold">Settings</h1>

      <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-inset p-3.5">
        {ov ? (
          <Ring size={46} stroke={5} frac={ov.xp.pct / 100} color="var(--jade)">
            <span className="font-display text-[13px] font-bold">{ov.level}</span>
          </Ring>
        ) : (
          <div className="h-[46px] w-[46px]" />
        )}
        <div>
          <div className="text-[13.5px] font-bold">
            {accountName ? `Connected as ${accountName}` : "Connected"}
          </div>
          {ov && <div className="text-[11.5px] text-fg-faint">{ov.level_title}</div>}
        </div>
      </div>

      <Section icon={<KeyRound size={15} />} title="Renshuu API key">
        <p className="mb-2 text-sm text-fg-muted">
          {accountName ? `Connected as ${accountName}.` : "Connected."} Paste a new key to
          replace it.
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="New API key"
            className="min-w-0 flex-1 rounded-[10px] border border-card-border-strong bg-inset px-3 py-2 text-sm outline-none focus:border-gold"
          />
          <PillButton onClick={saveKey} disabled={savingKey || !apiKey.trim()} busy={savingKey}>
            Save
          </PillButton>
        </div>
      </Section>

      <Section icon={<Target size={15} />} title="Daily goal">
        <DailyGoalRow
          initial={status.data?.daily_goal ?? 30}
          onSaved={() => qc.invalidateQueries()}
        />
      </Section>

      <Section icon={<Bell size={15} />} title="Phone notifications">
        <PushRow onChanged={() => qc.invalidateQueries({ queryKey: ["setup-status"] })} />
      </Section>

      <Section icon={<Sparkles size={15} />} title="Kao's coaching">
        <p className="mb-2.5 text-sm text-fg-muted">
          Kao can check in once a day with a friendly digest, and again in the evening if a streak
          is about to slip. Both need notifications enabled above.
        </p>
        <div className="flex flex-col gap-2">
          <ToggleRow
            label="Morning digest"
            hint="Reviews due, weak spots, and pace — one note each morning."
            initial={status.data?.digest_enabled ?? true}
            onChange={setDigestEnabled}
          />
          <ToggleRow
            label="Streak-risk nudge"
            hint="An evening nudge from Kao if a streak hasn't been studied yet today."
            initial={status.data?.streak_check_enabled ?? true}
            onChange={setStreakCheckEnabled}
          />
        </div>
      </Section>

      <Section icon={<RefreshCw size={15} />} title="Full term sync">
        <SyncTermsRow remaining={usage.data?.remaining ?? null} onDone={() => qc.invalidateQueries()} />
      </Section>

      {auth.data?.auth_required && (
        <div className="mt-6 border-t border-card-border pt-4">
          <button
            onClick={doLogout}
            className="flex items-center gap-2 rounded-[10px] border border-card-border-strong bg-inset px-3 py-2 text-sm hover:text-fg"
          >
            <LogOut size={15} /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-gold">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

function PillButton({
  children,
  onClick,
  disabled,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-[10px] bg-gold px-3.5 py-2 text-[12.5px] font-bold text-on-accent disabled:opacity-50"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

function DailyGoalRow({ initial, onSaved }: { initial: number; onSaved: () => void }) {
  const [goal, setGoal] = useState(String(initial));
  const [saving, setSaving] = useState(false);

  useEffect(() => setGoal(String(initial)), [initial]);

  async function save() {
    const n = Number(goal);
    if (!Number.isFinite(n) || n < 1) return;
    setSaving(true);
    try {
      await setDailyGoal(n);
      toast.success("Daily goal updated.");
      onSaved();
    } catch {
      toast.error("Couldn't save the goal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={1}
        max={500}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        className="w-24 rounded-[10px] border border-card-border-strong bg-inset px-3 py-2 text-sm outline-none focus:border-gold"
      />
      <span className="text-sm text-fg-muted">terms / day</span>
      <PillButton onClick={save} disabled={saving} busy={saving}>
        Save
      </PillButton>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  initial,
  onChange,
}: {
  label: string;
  hint: string;
  initial: boolean;
  onChange: (on: boolean) => Promise<void>;
}) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  useEffect(() => setOn(initial), [initial]);

  async function toggle() {
    const next = !on;
    setOn(next);
    setBusy(true);
    try {
      await onChange(next);
    } catch {
      setOn(!next);
      toast.error("Couldn't save that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[10px] bg-inset px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[12.5px] font-bold">{label}</div>
        <div className="text-[11px] text-fg-faint">{hint}</div>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        aria-pressed={on}
        aria-label={label}
        className={"relative h-6 w-11 shrink-0 rounded-full transition-colors " + (on ? "bg-gold" : "bg-card-border-strong")}
      >
        <span
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: on ? "translateX(20px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

function SyncTermsRow({ remaining, onDone }: { remaining: number | null; onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const result = await syncTerms();
      if (result.complete) {
        toast.success("Full sync complete — every term you've studied is now indexed.");
      } else {
        toast(
          `Synced ${result.calls_used ?? 0} pages — paused for today's quota. It'll resume automatically.`
        );
      }
      onDone();
    } catch {
      toast.error("Sync failed. Try again in a bit.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm text-fg-muted">
        Walk your entire study history (vocab, kanji, grammar, sentences) into the Insights page.
        Runs nightly on its own — use this to kick off (or resume) a sync right now.
      </p>
      {!confirming ? (
        <PillButton onClick={() => setConfirming(true)}>Full term sync</PillButton>
      ) : (
        <div className="rounded-[12px] border border-card-border-strong bg-inset p-3">
          <p className="mb-2 text-[12.5px] text-fg-muted">
            This can use a large chunk of today's Renshuu API quota.
            {remaining != null && (
              <>
                {" "}
                You have <span className="font-bold text-fg">{remaining} / 500</span> calls left today.
              </>
            )}{" "}
            It's resumable, so it's safe to run even if it doesn't finish.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              className="rounded-[10px] border border-card-border-strong px-3.5 py-2 text-[12.5px] font-bold text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
            <PillButton onClick={run} disabled={busy} busy={busy}>
              Start sync
            </PillButton>
          </div>
        </div>
      )}
    </div>
  );
}

function PushRow({ onChanged }: { onChanged: () => void }) {
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = pushSupported();

  useEffect(() => {
    pushEnabledLocally().then(setOn);
  }, []);

  async function toggle() {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        toast("Notifications turned off on this device.");
      } else {
        await enablePush();
        setOn(true);
        toast.success("Notifications enabled on this device.");
      }
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update notifications.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    try {
      await api.post("/push/test");
      toast.success("Test sent — check your device.");
    } catch {
      toast.error("Couldn't send. Enable notifications on this device first.");
    }
  }

  if (!supported) {
    return (
      <p className="text-sm text-fg-muted">
        This browser doesn't support push notifications. Install the app to your home screen
        (iOS 16.4+) and try again.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-fg-muted">
        Get a nudge on this device when reviews are due — even when the app is closed.
      </p>
      <div className="flex gap-2">
        <button
          onClick={toggle}
          disabled={busy}
          className={
            "flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold disabled:opacity-50 " +
            (on
              ? "border border-card-border-strong bg-inset text-fg"
              : "bg-gold text-on-accent")
          }
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {on ? "Turn off" : "Enable notifications"}
        </button>
        {on && (
          <button
            onClick={sendTest}
            className="rounded-[10px] border border-card-border-strong bg-inset px-3.5 py-2 text-[12.5px] font-bold text-fg"
          >
            Send test
          </button>
        )}
      </div>
    </div>
  );
}
