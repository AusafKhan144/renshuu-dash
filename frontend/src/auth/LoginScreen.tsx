import { useState } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { login } from "../api/client";

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
    <div className="app-bg flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex w-full max-w-sm flex-col items-center"
      >
        <div className="font-display text-4xl font-bold">Renshu</div>
        <p className="mt-2 text-center text-sm leading-relaxed text-fg-muted">
          Your streak is waiting.
          <br />
          Sign in to keep it alive.
        </p>

        <div className="mt-6 w-full rounded-[18px] border border-card-border bg-card p-5 card-shadow">
          <div className="mb-3 text-[12.5px] font-bold text-amber">Protected dashboard</div>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="rounded-[10px] border border-card-border-strong bg-inset px-3 py-2.5 text-sm outline-none focus:border-amber"
            />
            {error && <p className="text-sm text-rose">Incorrect password.</p>}
            <button
              type="submit"
              disabled={busy || !password}
              className="flex items-center justify-center gap-2 rounded-[10px] bg-amber py-2.5 text-sm font-bold text-bg disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : null}
              Unlock
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
