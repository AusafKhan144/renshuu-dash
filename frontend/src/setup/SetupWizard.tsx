import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Bell, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { api } from "../api/client";
import { enablePush, pushSupported } from "../push";

export function SetupWizard() {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [account, setAccount] = useState<{ name?: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [enabling, setEnabling] = useState(false);

  async function saveKey() {
    setValidating(true);
    try {
      const res = await api.post("/setup/key", { api_key: apiKey.trim() });
      setAccount(res.data.account);
      toast.success(`Connected as ${res.data.account?.name ?? "your account"}!`);
    } catch {
      toast.error("That key was rejected by Renshuu. Double-check and retry.");
    } finally {
      setValidating(false);
    }
  }

  async function turnOnPush() {
    setEnabling(true);
    try {
      await enablePush();
      await api.post("/push/test");
      setPushOn(true);
      toast.success("Notifications on — sent you a test.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't enable notifications.");
    } finally {
      setEnabling(false);
    }
  }

  async function finish() {
    await qc.invalidateQueries();
  }

  return (
    <div className="app-bg flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center">
          <div className="font-display text-[32px] font-bold">練習</div>
          <div className="mt-1.5 text-sm text-fg-muted">
            Your personal Renshuu progress dashboard
          </div>
        </div>

        {/* Step dots */}
        <div className="my-4 flex justify-center gap-1.5">
          <span className="h-[5px] w-6 rounded-full bg-amber" />
          <span
            className={
              "h-[5px] w-6 rounded-full " + (account ? "bg-rose" : "bg-card-border-strong")
            }
          />
        </div>

        <div className="rounded-[18px] border border-card-border bg-card p-5 card-shadow">
          {/* Step 1: API key */}
          <div className="flex items-center gap-2 text-[12.5px] font-bold text-amber">
            <KeyRound size={15} /> Step 1 · Connect your Renshuu account
          </div>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Get a read API key from{" "}
            <a
              className="text-amber underline"
              href="https://www.renshuu.org/index.php?page=api"
              target="_blank"
              rel="noreferrer"
            >
              Renshuu → Resources → API <ExternalLink size={12} className="inline" />
            </a>
            . It stays on your own server.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Renshuu API key"
              className="min-w-0 flex-1 rounded-[10px] border border-card-border-strong bg-inset px-3 py-2 text-sm outline-none focus:border-amber"
            />
            <button
              onClick={saveKey}
              disabled={!apiKey.trim() || validating}
              className="rounded-[10px] bg-amber px-4 py-2 text-sm font-bold text-bg disabled:opacity-40"
            >
              {validating ? <Loader2 size={16} className="animate-spin" /> : "Connect"}
            </button>
          </div>
          {account && (
            <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 size={16} /> Connected as {account.name}
            </div>
          )}

          {/* Step 2: notifications (optional) */}
          <div className="mt-6 flex items-center gap-2 text-[12.5px] font-bold text-rose">
            <Bell size={15} /> Step 2 · Phone reminders (optional)
          </div>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Install this dashboard to your home screen, then enable notifications to
            get a nudge when reviews are due — even when the app is closed.
          </p>
          <div className="mt-3">
            {!pushSupported() ? (
              <p className="text-sm text-fg-faint">
                Add the app to your home screen first (iOS 16.4+), then enable
                notifications from Settings.
              </p>
            ) : pushOn ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 size={16} /> Notifications enabled
              </div>
            ) : (
              <button
                onClick={turnOnPush}
                disabled={!account || enabling}
                className="rounded-[10px] bg-rose px-4 py-2 text-sm font-bold text-bg disabled:opacity-40"
              >
                {enabling ? <Loader2 size={16} className="animate-spin" /> : "Enable notifications"}
              </button>
            )}
          </div>

          <button
            onClick={finish}
            disabled={!account}
            className="mt-6 w-full rounded-[10px] bg-amber py-3 text-sm font-bold text-bg disabled:opacity-40"
          >
            {account ? "Open my dashboard →" : "Connect your account to continue"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
