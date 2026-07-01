import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAchievements, claimAchievement, type Achievement } from "../api/client";
import { HUE, HUE_SOFT, type Hue } from "./tokens";
import { Card } from "./ui";

const CONFETTI_HUES: Hue[] = ["amber", "teal", "violet", "rose"];
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i % 6) * 0.08).toFixed(2),
  rot: (i * 53) % 360,
  hue: CONFETTI_HUES[i % 4],
}));

/** Achievement shelf: earned badges, claimable ones fire a confetti burst. */
export function AchievementsShelf({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const { data: achievements } = useAchievements(enabled);
  const [celebrate, setCelebrate] = useState(false);

  if (!achievements || achievements.length === 0) return null;

  async function claim(id: string) {
    try {
      await claimAchievement(id);
      setCelebrate(true);
      window.setTimeout(() => setCelebrate(false), 1500);
      await qc.invalidateQueries({ queryKey: ["achievements"] });
    } catch {
      toast.error("Couldn't claim that one — try again.");
    }
  }

  return (
    <Card delay={0.22} className="relative overflow-hidden">
      <div className="mb-3.5 text-[13px] font-bold">Achievements</div>
      <div className="flex flex-wrap gap-4">
        {achievements.map((b) => (
          <Badge key={b.id} badge={b} onClaim={() => claim(b.id)} />
        ))}
      </div>
      {celebrate && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="animate-confetti absolute top-[30%] h-[7px] w-[7px] rounded-[2px]"
              style={{
                left: `${p.left}%`,
                background: HUE[p.hue],
                animationDelay: `${p.delay}s`,
                transform: `rotate(${p.rot}deg)`,
              }}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function Badge({ badge, onClaim }: { badge: Achievement; onClaim: () => void }) {
  const color = HUE[badge.hue];
  const soft = HUE_SOFT[badge.hue];
  const locked = !badge.earned;
  return (
    <div className="flex w-28 flex-col items-center gap-1.5 text-center">
      <div
        className="flex h-[54px] w-[54px] items-center justify-center rounded-full font-display text-lg font-bold"
        style={{
          background: soft,
          color,
          border: `2px solid ${color}`,
          opacity: locked ? 0.5 : 1,
        }}
      >
        {badge.name.charAt(0)}
      </div>
      <div className="text-[11px] font-semibold leading-tight">{badge.name}</div>
      {badge.fresh && (
        <button
          onClick={onClaim}
          className="rounded-full px-2.5 py-1 text-[10px] font-bold text-bg"
          style={{ background: color }}
        >
          Claim
        </button>
      )}
      {badge.claimed && (
        <span className="text-[10px] font-bold text-success">Claimed ✓</span>
      )}
      {locked && (
        <div className="h-1 w-4/5 overflow-hidden rounded-full bg-inset">
          <div
            className="h-full"
            style={{ width: `${badge.progress}%`, background: color, opacity: 0.55 }}
          />
        </div>
      )}
    </div>
  );
}
