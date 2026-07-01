import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Bell, X, LogOut, Loader2 } from "lucide-react";
import { api, logout, useAuthStatus, useSetupStatus } from "../api/client";

/** Settings modal: re-edit the Renshuu key & Chat webhook after setup, send a
 *  test notification, and log out. Reuses the same /api/setup/* endpoints the
 *  first-run wizard uses. */
export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const status = useSetupStatus(true);
  const auth = useAuthStatus();
  const [apiKey, setApiKey] = useState("");
  const [webhook, setWebhook] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [savingHook, setSavingHook] = useState(false);

  const accountName = status.data?.account?.name;
  const webhookSet = status.data?.webhook_set;

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

  async function saveWebhook() {
    setSavingHook(true);
    try {
      await api.post("/setup/webhook", { webhook: webhook.trim() });
      if (webhook.trim()) await api.post("/setup/test-notify");
      toast.success(
        webhook.trim() ? "Saved — test message sent to Google Chat!" : "Webhook cleared."
      );
      setWebhook("");
      await qc.invalidateQueries({ queryKey: ["setup-status"] });
    } catch {
      toast.error("Couldn't send a test message. Is the webhook URL correct?");
    } finally {
      setSavingHook(false);
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
        className="w-full max-w-lg rounded-2xl border border-fg/10 bg-card p-6 shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-muted hover:bg-fg/10"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Renshuu API key */}
        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
            <KeyRound size={15} /> Renshuu API key
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {accountName ? `Connected as ${accountName}.` : "Connected."} Paste a
            new key to replace it.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="New API key"
              className="flex-1 rounded-lg border border-fg/10 bg-fg/5 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <button
              onClick={saveKey}
              disabled={savingKey || !apiKey.trim()}
              className="flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {savingKey ? <Loader2 size={15} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>

        {/* Google Chat webhook */}
        <div className="mt-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
            <Bell size={15} /> Google Chat webhook
          </div>
          <p className="mt-1 text-sm text-fg-muted">
            {webhookSet ? "A webhook is configured." : "No webhook set."} Save a
            new URL (sends a test), or save empty to clear.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              type="url"
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://chat.googleapis.com/..."
              className="flex-1 rounded-lg border border-fg/10 bg-fg/5 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <button
              onClick={saveWebhook}
              disabled={savingHook}
              className="flex items-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {savingHook ? <Loader2 size={15} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>

        {/* Logout (only when the instance is password-protected) */}
        {auth.data?.auth_required && (
          <div className="mt-6 border-t border-fg/10 pt-4">
            <button
              onClick={doLogout}
              className="flex items-center gap-2 rounded-lg border border-fg/10 bg-fg/5 px-3 py-2 text-sm hover:bg-fg/10"
            >
              <LogOut size={15} /> Log out
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
