import type { Overview } from "../api/client";
import { Card } from "./ui";

const CATS = [
  { key: "vocab", label: "Vocab" },
  { key: "kanji", label: "Kanji" },
  { key: "grammar", label: "Grammar" },
];

export function N5Progress({ data }: { data: Overview }) {
  return (
    <Card delay={0.08}>
      <div className="mb-3.5 text-[13px] font-bold">N5 progress</div>
      <div className="grid grid-cols-3 gap-3">
        {CATS.map((c) => {
          const pct = Math.round(Number(data.jlpt?.[c.key]?.n5) || 0);
          return (
            <div key={c.key} className="rounded-[14px] bg-inset p-3 text-center">
              <div className="font-display text-[22px] font-bold text-jade">{pct}%</div>
              <div className="mt-1 text-[11px] text-fg-faint">{c.label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
