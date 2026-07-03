import { motion } from "framer-motion";
import type { Overview } from "../api/client";
import { pickStreak } from "../api/client";
import { Card } from "./ui";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "夜更かし ですね — burning the midnight oil";
  if (h < 11) return "おはよう!";
  if (h < 17) return "こんにちは!";
  return "こんばんは!";
}

function kaoMessage(data: Overview): string {
  const streak = pickStreak(data.streaks) ?? 0;
  const { goal, progress, reviews_due } = data.daily;
  if (progress >= goal && goal > 0) {
    return streak > 0
      ? `Kao is so proud of your ${streak}-day streak — today's goal is already done! 🌱`
      : "Kao is proud of you — today's goal is already done! 🌱";
  }
  if (reviews_due > 30) {
    return `${reviews_due} reviews are piling up — Kao believes in you. Even a few now helps. 🍵`;
  }
  if (reviews_due > 0) {
    return `${reviews_due} reviews are waiting whenever you're ready. No rush. ☕`;
  }
  if (streak > 0) {
    return `${streak}-day streak and all caught up — Kao is cheering for you! ✨`;
  }
  return "Kao is happy to see you. Ready for a little practice today?";
}

/** Kao the mascot: a portrait (grown from the renshuu profile's own `kao`
    image, which evolves as adventure_level rises) fronting the dashboard
    with a soft idle bob and a state-aware, wholesome greeting. */
export function KaoCard({ data }: { data: Overview }) {
  return (
    <Card delay={0.02} className="flex items-center gap-4">
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-inset text-3xl"
      >
        {data.kao_url ? (
          <img src={data.kao_url} alt="Kao" className="h-full w-full object-cover" />
        ) : (
          <span>🙂</span>
        )}
      </motion.div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-display text-[14px] font-bold">{greeting()}</span>
          {data.adventure_level != null && (
            <span className="rounded-md bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-gold">
              Adventure Lv.{data.adventure_level}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-fg-muted">{kaoMessage(data)}</p>
      </div>
    </Card>
  );
}
