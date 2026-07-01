import { useState } from "react";
import type { Overview } from "../api/client";
import { JLPT_COLORS } from "./tokens";
import { Card } from "./ui";

const CATEGORIES = [
  { key: "vocab", label: "Vocab" },
  { key: "kanji", label: "Kanji" },
  { key: "grammar", label: "Grammar" },
  { key: "sent", label: "Sent." },
];

const LEVELS = ["n5", "n4", "n3", "n2", "n1"];

/** JLPT coverage as horizontal bars, one row per level, with a category toggle. */
export function JLPTCoverage({ data }: { data: Overview }) {
  const [category, setCategory] = useState("vocab");
  const percs = data.jlpt?.[category] ?? {};

  return (
    <Card delay={0.14}>
      <div className="mb-3.5 flex items-center justify-between">
        <div className="text-[13px] font-bold">JLPT coverage</div>
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={
                "rounded-lg px-2.5 py-1.5 text-[11px] font-bold " +
                (category === c.key
                  ? "bg-amber text-bg"
                  : "bg-inset text-fg-muted hover:text-fg")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {LEVELS.map((l, i) => {
        const value = Math.round(Number(percs[l]) || 0);
        return (
          <div key={l} className="mb-2 flex items-center gap-2.5">
            <span className="w-7 text-[11px] font-bold text-fg-muted">
              {l.toUpperCase()}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-inset">
              <div
                className="h-full rounded-full"
                style={{ width: `${value}%`, background: JLPT_COLORS[i] }}
              />
            </div>
            <span className="w-9 text-right text-[11px] text-fg-faint">{value}%</span>
          </div>
        );
      })}
    </Card>
  );
}
