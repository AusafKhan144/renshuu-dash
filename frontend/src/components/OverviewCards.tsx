import type { Overview } from "../api/client";
import type { Hue } from "./tokens";
import { HUE } from "./tokens";
import { Card, AnimatedNumber, Delta } from "./ui";

const STATS: { key: "vocab" | "kanji" | "grammar" | "sentences"; label: string; hue: Hue }[] = [
  { key: "vocab", label: "Vocabulary", hue: "amber" },
  { key: "kanji", label: "Kanji", hue: "teal" },
  { key: "grammar", label: "Grammar", hue: "violet" },
  { key: "sentences", label: "Sentences", hue: "rose" },
];

/** The four studied-term stat cards (accent dot + weekly delta). */
export function OverviewCards({ data }: { data: Overview }) {
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      {STATS.map((s, i) => (
        <Card key={s.key} delay={i * 0.05} className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-fg-muted">{s.label}</span>
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: HUE[s.hue] }}
            />
          </div>
          <div className="mt-2 font-display text-[28px] font-bold leading-none">
            <AnimatedNumber value={data.totals[s.key]} />
          </div>
          <div className="mt-1">
            <Delta value={data.weekly_delta[s.key]} />
          </div>
        </Card>
      ))}
    </div>
  );
}
