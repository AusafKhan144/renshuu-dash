import type { KaoHistoryEntry } from "../api/client";
import { Card } from "./ui";

/** "Kao's journey" — a horizontal strip of every distinct Kao portrait
    captured across daily snapshots, each labeled with the date and adventure
    level it first appeared. Grows on its own as the profile is snapshotted. */
export function KaoTimeline({ history }: { history: KaoHistoryEntry[] }) {
  return (
    <Card delay={0.24}>
      <div className="mb-1 text-[13px] font-bold">Kao's journey</div>
      <p className="mb-3 text-[11.5px] text-fg-faint">
        Kao grows alongside you — a new portrait for every adventure level you reach.
      </p>
      {history.length === 0 ? (
        <p className="py-4 text-sm text-fg-faint">
          Kao's timeline starts filling in after tomorrow's snapshot.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {history.map((h) => (
            <div key={h.kao_url} className="flex shrink-0 flex-col items-center gap-1.5">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-card-border bg-inset">
                <img src={h.kao_url} alt="Kao" className="h-full w-full object-cover" />
              </div>
              <div className="text-center text-[10px] text-fg-faint">
                {h.adventure_level != null && <div className="font-bold text-fg">Lv.{h.adventure_level}</div>}
                <div>{h.first_seen}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
