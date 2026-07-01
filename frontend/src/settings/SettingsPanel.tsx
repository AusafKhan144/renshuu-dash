import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Bell, X, LogOut, Loader2, Target } from "lucide-react";
import {
  api,
  logout,
  setDailyGoal,
  useAuthStatus,
  useSetupStatus,
  useOverview,
} from "../api/client";
import { enablePush, disablePush, pushEnabledLocally, pushSupported } from "../push";
import { Ring } from "../components/charts";

/** Settings modal: re-edit the Renshuu key, set a daily goal, manage phone
 *  notifications (Web Push), and log out. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const status = useSetupStatus(true);
  const auth = useAuthStatus();
  const overview = useOverview(true);
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[18px] border border-card-border bg-card p-6 card-shadow"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-faint hover:bg-inset"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Account + level */}
        <div className="mt-4 flex items-center gap-3 rounded-[14px] bg-inset p-3.5">
          {ov ? (
            <Ring size={46} stroke={5} frac={ov.xp.pct / 100} color="var(--teal)">
              <span className="font-display text-[13px] font-bold">{ov.level}</span>
            </Ring>
          ) : (
            <div className="h-[46px] w-[46px]" />
          )}
          <div>
            <div className="text-[13.5px] font-bold">
              {accountName ? `Connected as ${accountName}` : "Connected"}
            </div>
            {ov && (
              <div className="text-[11.5px] text-fg-faint">{ov.level_title}</div>
            )}
          </div>
        </div>

        {/* Renshuu API key */}
        <Section icon={<KeyRound size={15} />} title="Renshuu API key">
          <p className="mb-2 text-sm text-fg-muted">
            {accountName ? `Connected as ${accountName}.` : "Connected."} Paste a new key to replace it.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="New API key"
              className="min-w-0 flex-1 rounded-[10px] border border-card-border-strong bg-inset px-3 py-2 text-sm outline-none focus:border-amber"
            />
            <PillButton onClick={saveKey} disabled={savingKey || !apiKey.trim()} busy={savingKey}>
              Save
            </PillButton>
          </div>
        </Section>

        {/* Daily goal */}
        <Section icon={<Target size={15} />} title="Daily goal">
          <DailyGoalRow initial={status.data?.daily_goal ?? 30} onSaved={() => qc.invalidateQueries()} />
        </Section>

        {/* Phone notifications (Web Push) */}
        <Section icon={<Bell size={15} />} title="Phone notifications">
          <PushRow onChanged={() => qc.invalidateQueries({ queryKey: ["setup-status"] })} />
        </Section>

        {/* Logout (only when the instance is password-protected) */}
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
      </motion.div>
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
      <div className="mb-2 flex items-center gap-2 text-[12.5px] font-bold text-amber">
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
      className="flex items-center gap-2 rounded-[10px] bg-amber px-3.5 py-2 text-[12.5px] font-bold text-bg disabled:opacity-50"
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
        className="w-24 rounded-[10px] border border-card-border-strong bg-inset px-3 py-2 text-sm outline-none focus:border-amber"
      />
      <span className="text-sm text-fg-muted">terms / day</span>
      <PillButton onClick={save} disabled={saving} busy={saving}>
        Save
      </PillButton>
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
        This browser doesn't support push notifications. Install the app to your
        home screen (iOS 16.4+) and try again.
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
              : "bg-amber text-bg")
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
