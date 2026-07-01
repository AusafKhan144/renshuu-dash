import type { Overview } from "../api/client";
import { Card } from "./ui";
import { Ring } from "./charts";

/** Today's-goal ring + a start-reviewing CTA (top-left of the Command Deck). */
export function DailyGoalRing({ data }: { data: Overview }) {
  const { goal, progress, reviews_due } = data.daily;
  const frac = goal ? progress / goal : 0;

  return (
    <Card delay={0.04} className="flex flex-col items-center gap-3">
      <div className="self-start text-[11.5px] font-bold uppercase tracking-wide text-fg-muted">
        Today's goal
      </div>
      <Ring size={100} stroke={9} frac={frac} color="var(--amber)">
        <div className="font-display text-2xl font-bold">
          {progress}
          <span className="text-[13px] text-fg-faint">/{goal}</span>
        </div>
      </Ring>
      <a
        href="https://www.renshuu.org/index.php?page=mistakes"
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-[10px] bg-amber py-2.5 text-center text-[12.5px] font-bold text-bg"
      >
        {reviews_due > 0 ? `Start reviewing · ${reviews_due} due` : "All caught up 🎉"}
      </a>
    </Card>
  );
}
