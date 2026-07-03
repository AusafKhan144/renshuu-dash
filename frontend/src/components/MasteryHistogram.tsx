import { useState } from "react";
import type { RetentionResponse, Termtype } from "../api/client";
import { Card } from "./ui";

const TERMTYPES: { key: Termtype; label: string }[] = [
  { key: "vocab", label: "Vocab" },
  { key: "kanji", label: "Kanji" },
  { key: "grammar", label: "Grammar" },
  { key: "sent", label: "Sent." },
];

const BUCKETS = [
  { key: "0-19", color: "var(--red)" },
  { key: "20-39", color: "var(--rose)" },
  { key: "40-59", color: "var(--gold)" },
  { key: "60-79", color: "var(--teal)" },
  { key: "80-100", color: "var(--jade)" },
];

/** Mastery histogram (5 buckets) per termtype, with an avg-mastery headline. */
export function MasteryHistogram({ data }: { data: RetentionResponse }) {
  const [termtype, setTermtype] = useState<Termtype>("vocab");
  const stats = data[termtype];
  const hist = stats?.histogram;
  const maxCount = hist ? Math.max(...Object.values(hist), 1) : 1;

  return (
    <Card delay={0.06}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13px] font-bold">Mastery distribution</div>
        <div className="flex gap-1">
          {TERMTYPES.map((t) => (
            <button
              key={t.key}
              onClick={() => setTermtype(t.key)}
              className={
                "rounded-lg px-2.5 py-1.5 text-[11px] font-bold " +
                (termtype === t.key ? "bg-amber text-bg" : "bg-inset text-fg-muted hover:text-fg")
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {!stats || !stats.total ? (
        <p className="py-6 text-sm text-fg-faint">
          No {termtype} terms synced yet — run a full sync from Settings to populate this.
        </p>
      ) : (
        <>
          <div className="mb-3 text-[11.5px] text-fg-faint">
            {stats.total.toLocaleString()} terms · {stats.avg_mastery}% avg mastery
          </div>
          <div className="flex h-[120px] items-end gap-2.5">
            {BUCKETS.map((b) => {
              const count = hist?.[b.key] ?? 0;
              const h = Math.max(3, (count / maxCount) * 100);
              return (
                <div key={b.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-[92px] w-full items-end">
                    <div
                      className="w-full rounded-t-[6px]"
                      style={{ height: `${h}%`, background: b.color }}
                      title={`${count} terms`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-fg-faint">{count}</span>
                  <span className="text-[9.5px] text-fg-faint">{b.key}%</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
