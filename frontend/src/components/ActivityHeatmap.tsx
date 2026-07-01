import { useMemo } from "react";
import { useActivity } from "../api/client";
import { Card } from "./ui";
import { Heatmap } from "./charts";

const WEEKS = 18;
const DAYS = WEEKS * 7;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** GitHub-style calendar heatmap of terms learned per day (last 18 weeks). */
export function ActivityHeatmap({ enabled }: { enabled: boolean }) {
  const { data } = useActivity(DAYS, enabled);

  const { cells, total } = useMemo(() => {
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
    return { cells, total };
  }, [data]);

  return (
    <Card delay={0.2}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-bold">Daily activity · last {WEEKS} weeks</div>
        <span className="text-xs text-fg-faint">{total} terms learned</span>
      </div>
      <Heatmap values={cells} color="var(--amber)" />
    </Card>
  );
}
