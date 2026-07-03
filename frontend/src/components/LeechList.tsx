import { Bug } from "lucide-react";
import type { Leech } from "../api/client";
import { Card } from "./ui";

/** Persistently-missed terms ("leeches"): high missed count, low mastery,
    attempted often enough to matter. Click a row to drill in. */
export function LeechList({
  leeches,
  onSelect,
}: {
  leeches: Leech[];
  onSelect: (termtype: Leech["termtype"], termId: string) => void;
}) {
  return (
    <Card delay={0.14}>
      <div className="mb-1 flex items-center gap-2 text-[13px] font-bold">
        <Bug size={15} className="text-rose" /> Leeches
      </div>
      <p className="mb-3 text-[11.5px] text-fg-faint">
        Terms you keep missing — worth a focused review session.
      </p>
      {leeches.length === 0 ? (
        <p className="py-4 text-sm text-fg-faint">
          No leeches right now — nothing is being persistently missed. Nicely done.
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-card-border">
          {leeches.map((l) => (
            <button
              key={`${l.termtype}:${l.term_id}`}
              onClick={() => onSelect(l.termtype, l.term_id)}
              className="flex items-center justify-between gap-3 py-2.5 text-left first:pt-0 last:pb-0 hover:opacity-80"
            >
              <div className="min-w-0">
                <div className="truncate font-display text-[14px] font-bold">
                  {l.display}
                  {l.jlpt && (
                    <span className="ml-2 rounded-md bg-inset px-1.5 py-0.5 text-[10px] font-bold uppercase text-fg-faint">
                      {l.jlpt}
                    </span>
                  )}
                </div>
                {l.definition && (
                  <div className="truncate text-[11.5px] text-fg-faint">{l.definition}</div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-[11px]">
                <span className="text-rose">{l.missed} missed</span>
                <span className="text-fg-faint">{l.mastery}% mastery</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
