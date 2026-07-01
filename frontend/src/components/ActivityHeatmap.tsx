import { useMemo } from "react";
import { useActivity } from "../api/client";
import { Card } from "./ui";

const WEEKS = 18;
const DAYS = WEEKS * 7;

// Intensity buckets → opacity of the accent color (works in both themes).
function level(learned: number): number {
  if (learned <= 0) return 0;
  if (learned <= 2) return 1;
  if (learned <= 5) return 2;
  if (learned <= 10) return 3;
  return 4;
}

const OPACITY = [0, 0.25, 0.45, 0.7, 1];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** GitHub-style calendar heatmap of terms learned per day, built from the same
 *  /api/activity data the bar chart uses (no backend change). */
export function ActivityHeatmap({ enabled }: { enabled: boolean }) {
  const { data } = useActivity(DAYS, enabled);

  const { weeks, total } = useMemo(() => {
    const byDay = new Map<string, number>();
    let total = 0;
    for (const p of data?.points ?? []) {
      byDay.set(p.day, p.learned);
      total += p.learned;
    }

    // End on the most recent Saturday so columns are full weeks.
    const end = new Date();
    end.setDate(end.getDate() + (6 - end.getDay()));
    const start = new Date(end);
    start.setDate(start.getDate() - (DAYS - 1));

    const cells: { day: string; learned: number }[] = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = isoDay(d);
      cells.push({ day: key, learned: byDay.get(key) ?? 0 });
    }

    const weeks: { day: string; learned: number }[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      weeks.push(cells.slice(w * 7, w * 7 + 7));
    }
    return { weeks, total };
  }, [data]);

  return (
    <Card delay={0.22} className="lg:col-span-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg/80">
          Activity heatmap (last {WEEKS} weeks)
        </h3>
        <span className="text-xs text-fg/40">{total} terms learned</span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.day}
                  title={`${cell.day}: ${cell.learned} learned`}
                  className="h-3 w-3 rounded-[3px]"
                  style={{
                    backgroundColor:
                      cell.learned > 0
                        ? "var(--chart-accent)"
                        : "var(--chart-grid)",
                    opacity:
                      cell.learned > 0 ? OPACITY[level(cell.learned)] : 1,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-1 text-xs text-fg/40">
        <span>Less</span>
        {OPACITY.map((o, i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-[3px]"
            style={{
              backgroundColor:
                i === 0 ? "var(--chart-grid)" : "var(--chart-accent)",
              opacity: i === 0 ? 1 : o,
            }}
          />
        ))}
        <span>More</span>
      </div>
    </Card>
  );
}
