import type { Overview } from "../api/client";
import { JLPT_COLORS } from "./tokens";
import { Card } from "./ui";

const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const CATEGORIES = ["vocab", "kanji", "grammar", "sent"];

/** Average coverage % across vocab/kanji/grammar/sentences for one JLPT level. */
function blendedPct(jlpt: Record<string, Record<string, number>>, level: string): number {
  const vals = CATEGORIES.map((c) => Number(jlpt?.[c]?.[level]) || 0);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function JLPTLevelCheck({ data }: { data: Overview }) {
  const blended = LEVELS.map((l) => blendedPct(data.jlpt, l));
  const firstIncomplete = blended.findIndex((p) => p < 90);
  const current = firstIncomplete === -1 ? LEVELS.length - 1 : firstIncomplete;

  return (
    <Card delay={0.1}>
      <div className="mb-3.5 flex items-center justify-between">
        <div className="text-[13px] font-bold">JLPT level check</div>
        <span className="rounded-full bg-jade-soft px-2.5 py-1 text-[11px] font-bold text-jade">
          Currently {LEVELS[current].toUpperCase()}
        </span>
      </div>
      {LEVELS.map((l, i) => (
        <div key={l} className="mb-2 flex items-center gap-2.5 last:mb-0">
          <span
            className={
              "w-7 text-[11px] font-bold " + (i === current ? "text-fg" : "text-fg-muted")
            }
          >
            {l.toUpperCase()}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-inset">
            <div
              className="h-full rounded-full"
              style={{ width: `${blended[i]}%`, background: JLPT_COLORS[i] }}
            />
          </div>
          <span className="w-9 text-right text-[11px] text-fg-faint">{blended[i]}%</span>
        </div>
      ))}
    </Card>
  );
}
