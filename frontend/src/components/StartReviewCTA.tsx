import { motion } from "framer-motion";
import { Play, Sparkles } from "lucide-react";

export function StartReviewCTA({ due, newAvailable = 0 }: { due: number; newAvailable?: number }) {
  if (due <= 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-4 text-emerald-300">
        <Sparkles size={18} /> All caught up — no reviews due right now. Nice work!
        {newAvailable > 0 && (
          <span className="text-emerald-200/80">
            · {newAvailable} new term{newAvailable === 1 ? "" : "s"} ready to learn
          </span>
        )}
      </div>
    );
  }
  return (
    <motion.a
      href="https://www.renshuu.org/index.php?page=mistakes"
      target="_blank"
      rel="noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-sky-500 to-violet-500 px-5 py-4 font-semibold text-white shadow-lg"
    >
      <span className="flex items-center gap-2">
        <Play size={18} /> {due} reviews ready — start now
      </span>
      <span className="text-sm opacity-90">Open Renshuu →</span>
    </motion.a>
  );
}
