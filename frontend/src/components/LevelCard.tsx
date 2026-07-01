import type { Overview } from "../api/client";
import { Card } from "./ui";
import { Ring } from "./charts";

/** Level progress: a teal ring with the level number, title, and XP to next. */
export function LevelCard({ data }: { data: Overview }) {
  const { level, level_title, xp } = data;
  return (
    <Card delay={0.08} className="flex flex-col gap-2.5">
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-fg-muted">
        Level progress
      </div>
      <div className="flex items-center gap-3">
        <Ring size={60} stroke={7} frac={xp.pct / 100} color="var(--teal)">
          <span className="font-display text-base font-bold">{level}</span>
        </Ring>
        <div>
          <div className="text-sm font-bold">{level_title}</div>
          <div className="mt-0.5 text-[11.5px] text-fg-faint">
            {xp.pct}% to Level {level + 1}
          </div>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-inset">
        <div
          className="h-full rounded-full bg-teal"
          style={{ width: `${xp.pct}%` }}
        />
      </div>
      <div className="text-[10.5px] text-fg-faint">
        {xp.current.toLocaleString()} / {xp.next.toLocaleString()} XP
      </div>
    </Card>
  );
}
