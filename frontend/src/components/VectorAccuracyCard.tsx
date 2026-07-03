import type { VectorAccuracy } from "../api/client";
import { Card } from "./ui";

function accuracyColor(pct: number): string {
  if (pct >= 80) return "var(--jade)";
  if (pct >= 60) return "var(--gold)";
  return "var(--red)";
}

/** Per-study-mode accuracy, worst first — surfaces "Kana → Kanji is your
    weakest mode" style signal directly from the synced study_vectors. */
export function VectorAccuracyCard({ vectors }: { vectors: VectorAccuracy[] }) {
  const worst = vectors[0];

  return (
    <Card delay={0.1}>
      <div className="mb-1 text-[13px] font-bold">Study-mode accuracy</div>
      {worst && (
        <p className="mb-3 text-[11.5px] text-fg-faint">
          <span className="font-semibold text-fg">{worst.name}</span> is your weakest mode at{" "}
          {worst.accuracy_pct}% accuracy.
        </p>
      )}
      {vectors.length === 0 ? (
        <p className="py-4 text-sm text-fg-faint">No study-mode data yet.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {vectors.slice(0, 9).map((v) => (
            <div key={v.name}>
              <div className="mb-1 flex items-center justify-between text-[11.5px]">
                <span className="font-semibold">{v.name}</span>
                <span className="text-fg-faint">{v.accuracy_pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-inset">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${v.accuracy_pct}%`, background: accuracyColor(v.accuracy_pct) }}
                />
              </div>
              <div className="mt-1 text-[10px] text-fg-faint">
                {v.correct} correct · {v.missed} missed
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
