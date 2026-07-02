import type { KanaChar } from "../api/client";
import { Card } from "./ui";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--jade)";
  if (score >= 40) return "var(--gold)";
  return "var(--red)";
}

function VectorRow({ name, correct_count, missed_count, mastery_perc, next_quiz }: {
  name: string;
  correct_count: number;
  missed_count: number;
  mastery_perc: number;
  next_quiz: string | null;
}) {
  return (
    <div>
      <div className="text-[11.5px] font-semibold">{name}</div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card-border-strong">
        <div
          className="h-full rounded-full"
          style={{ width: `${mastery_perc}%`, background: scoreColor(mastery_perc) }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10.5px] text-fg-faint">
        <span>
          {correct_count} correct · {missed_count} missed
        </span>
        {next_quiz && <span>next: {next_quiz}</span>}
      </div>
    </div>
  );
}

export function KanaDetail({ selected }: { selected: KanaChar | null }) {
  if (!selected) {
    return (
      <Card className="hidden lg:block">
        <p className="text-sm text-fg-faint">Select a kana tile to see its detailed mastery breakdown.</p>
      </Card>
    );
  }

  const { char, score, detail } = selected;

  return (
    <Card className="lg:sticky lg:top-6">
      <div className="flex items-center gap-3">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[12px] text-[24px] font-bold"
          style={{
            background: `color-mix(in oklch, ${scoreColor(score)} ${Math.max(score, 8)}%, var(--inset))`,
            color: score >= 40 ? "var(--on-accent)" : "var(--fg)",
          }}
        >
          {char}
        </div>
        <div>
          <div className="text-[13px] font-bold">{score}% mastery</div>
          {detail?.def && <div className="text-[12px] text-fg-muted">{detail.def}</div>}
        </div>
      </div>

      {!detail ? (
        <p className="mt-3 text-[12.5px] text-fg-faint">
          Detailed stats arrive after the next daily snapshot.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3 text-[11.5px] text-fg-faint">
            <span>{detail.correct_count} correct</span>
            <span>{detail.missed_count} missed</span>
          </div>

          {(() => {
            // Only study modes actually attempted at least once — modes that
            // don't apply to this term (e.g. Kanji<->X for a plain kana char
            // with no kanji form) sit at 0/0 forever and just add clutter.
            const touched = Object.entries(detail.study_vectors)
              .filter(([, v]) => v.correct_count > 0 || v.missed_count > 0)
              .sort(([, a], [, b]) => b.mastery_perc - a.mastery_perc);
            if (touched.length === 0) {
              return (
                <p className="mt-3 text-[12.5px] text-fg-faint">Not yet studied in any mode.</p>
              );
            }
            return (
              <div className="mt-4 flex flex-col gap-3">
                {touched.map(([name, v]) => (
                  <VectorRow key={name} name={name} {...v} />
                ))}
              </div>
            );
          })()}
        </>
      )}
    </Card>
  );
}
