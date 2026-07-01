import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Bell, CheckCircle2, Loader2, ExternalLink } from "lucide-react";
import { api } from "../api/client";
import { Card } from "../components/ui";

export function SetupWizard() {
  const qc = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [webhook, setWebhook] = useState("");
  const [account, setAccount] = useState<{ name?: string } | null>(null);
  const [validating, setValidating] = useState(false);
  const [savingHook, setSavingHook] = useState(false);

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

  async function saveWebhook() {
    setSavingHook(true);
    try {
      await api.post("/setup/webhook", { webhook: webhook.trim() });
      await api.post("/setup/test-notify");
      toast.success("Test message sent — check Google Chat!");
    } catch {
      toast.error("Couldn't send a test message. Is the webhook URL correct?");
    } finally {
      setSavingHook(false);
    }
  }

  async function finish() {
    await qc.invalidateQueries();
  }

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg"
      >
        <div className="mb-6 text-center">
          <div className="text-4xl font-bold tracking-tight">練習</div>
          <p className="mt-1 text-fg/60">Your personal Renshuu progress dashboard</p>
        </div>

        <Card>
          {/* Step 1: API key */}
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
            <KeyRound size={16} /> Step 1 · Connect your Renshuu account
          </div>
          <p className="mt-2 text-sm text-fg/60">
            Get a read API key from{" "}
            <a
              className="text-sky-400 underline"
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
              className="flex-1 rounded-lg border border-fg/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            <button
              onClick={saveKey}
              disabled={!apiKey.trim() || validating}
              className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {validating ? <Loader2 size={16} className="animate-spin" /> : "Connect"}
            </button>
          </div>
          {account && (
            <div className="mt-2 flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 size={16} /> Connected as {account.name}
            </div>
          )}

          {/* Step 2: webhook (optional) */}
          <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-pink-300">
            <Bell size={16} /> Step 2 · Phone reminders via Google Chat (optional)
          </div>
          <p className="mt-2 text-sm text-fg/60">
            In a Google Chat space: <em>Apps &amp; integrations → Webhooks → Create</em>,
            then paste the URL here.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={webhook}
              onChange={(e) => setWebhook(e.target.value)}
              placeholder="https://chat.googleapis.com/v1/spaces/..."
              className="flex-1 rounded-lg border border-fg/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-pink-400"
            />
            <button
              onClick={saveWebhook}
              disabled={!webhook.trim() || savingHook || !account}
              className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {savingHook ? <Loader2 size={16} className="animate-spin" /> : "Test"}
            </button>
          </div>

          <button
            onClick={finish}
            disabled={!account}
            className="mt-6 w-full rounded-lg bg-fg/10 py-2.5 text-sm font-semibold hover:bg-fg/15 disabled:opacity-40"
          >
            {account ? "Open my dashboard →" : "Connect your account to continue"}
          </button>
        </Card>
      </motion.div>
    </div>
  );
}
