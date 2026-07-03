import { AlertTriangle, Clock } from "lucide-react";
import type { RiskEntry, RiskResponse } from "../api/client";
import { Card } from "./ui";

function Row({
  entry,
  onSelect,
  tone,
}: {
  entry: RiskEntry;
  onSelect: (termtype: RiskEntry["termtype"], termId: string) => void;
  tone: "rose" | "gold";
}) {
  return (
    <button
      onClick={() => onSelect(entry.termtype, entry.term_id)}
      className="flex w-full items-center justify-between gap-3 py-2 text-left hover:opacity-80"
    >
      <div className="min-w-0">
        <span className="truncate font-display text-[13.5px] font-bold">{entry.display}</span>
        {entry.jlpt && (
          <span className="ml-2 rounded-md bg-inset px-1.5 py-0.5 text-[10px] font-bold uppercase text-fg-faint">
            {entry.jlpt}
          </span>
        )}
      </div>
      <span className={"shrink-0 text-[11px] font-semibold " + (tone === "rose" ? "text-rose" : "text-gold")}>
        {entry.next_quiz}
      </span>
    </button>
  );
}

/** Forgetting-risk: terms overdue for review (next_quiz already passed) and
    terms due soon, from the synced study_vectors. */
export function RiskCard({
  data,
  onSelect,
}: {
  data: RiskResponse;
  onSelect: (termtype: RiskEntry["termtype"], termId: string) => void;
}) {
  return (
    <Card delay={0.18}>
      <div className="mb-3 flex items-center gap-4">
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <AlertTriangle size={15} className="text-rose" /> {data.overdue_count} overdue
        </div>
        <div className="flex items-center gap-2 text-[13px] font-bold">
          <Clock size={15} className="text-gold" /> {data.due_soon_count} due soon
        </div>
      </div>

      {data.overdue.length === 0 && data.due_soon.length === 0 ? (
        <p className="py-4 text-sm text-fg-faint">Nothing overdue or due soon — you're all caught up.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Overdue</div>
            <div className="flex flex-col divide-y divide-card-border">
              {data.overdue.slice(0, 8).map((e) => (
                <Row key={`${e.termtype}:${e.term_id}`} entry={e} onSelect={onSelect} tone="rose" />
              ))}
              {data.overdue.length === 0 && <p className="text-[11.5px] text-fg-faint">None.</p>}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-fg-muted">Due soon</div>
            <div className="flex flex-col divide-y divide-card-border">
              {data.due_soon.slice(0, 8).map((e) => (
                <Row key={`${e.termtype}:${e.term_id}`} entry={e} onSelect={onSelect} tone="gold" />
              ))}
              {data.due_soon.length === 0 && <p className="text-[11.5px] text-fg-faint">None.</p>}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
