import type { JlptBreakdownResponse, Termtype } from "../api/client";
import { Card } from "./ui";

const LEVELS = ["n5", "n4", "n3", "n2", "n1"];
const LABELS: Record<Termtype, string> = { vocab: "Vocab", kanji: "Kanji", grammar: "Grammar", sent: "Sentences" };

/** Term-level JLPT breakdown — finer than the profile's overall percs, since
    it's built from every synced term rather than a coarse server-side stat.
    Renshuu only tags JLPT level on kanji terms in the bulk sync endpoint, so
    termtypes with no tagged terms are simply omitted. */
export function JlptBreakdown({ data }: { data: JlptBreakdownResponse }) {
  const termtypes = Object.keys(data) as Termtype[];

  return (
    <Card delay={0.2}>
      <div className="mb-1 text-[13px] font-bold">JLPT breakdown by term</div>
      {termtypes.length === 0 ? (
        <p className="py-4 text-sm text-fg-faint">
          No JLPT-tagged terms synced yet — kanji terms carry the tag once synced.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-4">
          {termtypes.map((tt) => (
            <div key={tt}>
              <div className="mb-1.5 text-[11.5px] font-bold text-fg-muted">{LABELS[tt]}</div>
              <div className="grid grid-cols-5 gap-2">
                {LEVELS.map((lvl) => {
                  const cell = data[tt]?.[lvl];
                  return (
                    <div key={lvl} className="rounded-[10px] bg-inset p-2 text-center">
                      <div className="text-[10px] font-bold uppercase text-fg-faint">{lvl}</div>
                      {cell ? (
                        <>
                          <div className="mt-0.5 text-[15px] font-bold">{cell.avg_mastery}%</div>
                          <div className="text-[9.5px] text-fg-faint">{cell.studied} studied</div>
                          <div className="text-[9.5px] text-fg-faint">
                            {cell.mastered} mastered · {cell.weak} weak
                          </div>
                        </>
                      ) : (
                        <div className="mt-0.5 text-[11px] text-fg-faint">—</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
