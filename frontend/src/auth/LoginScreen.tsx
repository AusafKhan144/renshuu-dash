import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Loader2 } from "lucide-react";
import { login } from "../api/client";
import { Card } from "../components/ui";

/** Password gate shown when the instance is protected and the user has no
 *  valid session. On success we invalidate queries so the app re-fetches as an
 *  authenticated user. */
export function LoginScreen() {
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await login(password);
      await qc.invalidateQueries();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <div className="app-bg min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="mb-6 text-center">
          <div className="text-4xl font-bold tracking-tight">練習</div>
          <p className="mt-1 text-fg-muted">Enter your password to continue</p>
        </div>

        <Card>
          <div className="flex items-center gap-2 text-sm font-semibold text-sky-300">
            <Lock size={16} /> Protected dashboard
          </div>
          <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="rounded-lg border border-fg/10 bg-fg/5 px-3 py-2 text-sm outline-none focus:border-sky-400"
            />
            {error && (
              <p className="text-sm text-rose-400">Incorrect password.</p>
            )}
            <button
              type="submit"
              disabled={busy || !password}
              className="flex items-center justify-center gap-2 rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              Unlock
            </button>
          </form>
        </Card>
      </motion.div>
    </div>
  );
}
