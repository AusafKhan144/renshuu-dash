import { useState } from "react";
import type { PaceLevel, Termtype } from "../api/client";
import { useJlptHistory } from "../api/client";
import { Card } from "./ui";
import { LineChart } from "./charts";

const TERMTYPES: { key: Termtype; label: string }[] = [
  { key: "vocab", label: "Vocab" },
  { key: "kanji", label: "Kanji" },
  { key: "grammar", label: "Grammar" },
  { key: "sent", label: "Sent." },
];

function fmtEta(iso: string | null): string {
  if (!iso) return "Not enough data yet";
  const d = new Date(iso);
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "Any day now";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Per-JLPT-level pace forecast: studied/target, learning pace, and a
    projected completion date — with a trend line for the selected level. */
export function PaceCard({ data }: { data: Record<Termtype, PaceLevel[]> }) {
  const [termtype, setTermtype] = useState<Termtype>("vocab");
  const [level, setLevel] = useState("n5");
  const levels = data[termtype] ?? [];
  const trend = useJlptHistory(termtype, level, 60, true);

  return (
    <Card delay={0.16}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13px] font-bold">JLPT pace forecast</div>
        <div className="flex gap-1">
          {TERMTYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTermtype(t.key)}
              className={
                "rounded-lg px-2.5 py-1.5 text-[11px] font-bold " +
                (termtype === t.key ? "bg-teal text-on-accent" : "bg-inset text-fg-muted hover:text-fg")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2 flex flex-col divide-y divide-card-border">
        {levels.map((l) => (
          <button
            key={l.level}
            onClick={() => setLevel(l.level)}
            className={
              "flex items-center justify-between gap-3 py-2 text-left first:pt-0 " +
              (level === l.level ? "opacity-100" : "opacity-70 hover:opacity-100")
            }
          >
            <div className="flex items-center gap-2.5">
              <span className="w-7 text-[11px] font-bold text-fg-muted">{l.level.toUpperCase()}</span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-inset">
                <div className="h-full rounded-full bg-teal" style={{ width: `${l.pct}%` }} />
              </div>
              <span className="text-[11px] text-fg-faint">
                {l.studied}/{l.target}
              </span>
            </div>
            <div className="text-right text-[11px]">
              <div className="font-semibold">{fmtEta(l.eta_date)}</div>
              {l.pace_per_day != null && (
                <div className="text-fg-faint">
                  {l.pace_per_day}/day{l.pace_source === "fallback" ? " (rough)" : ""}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-fg-muted">
          {level.toUpperCase()} {termtype} coverage over time
        </div>
        <LineChart
          series={[
            {
              values: (trend.data ?? []).map((p) => p.value ?? 0),
              color: "var(--teal)",
            },
          ]}
          height={110}
        />
      </div>
    </Card>
  );
}
