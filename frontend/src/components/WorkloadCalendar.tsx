import type { WorkloadPoint } from "../api/client";
import { Card } from "./ui";
import { BarChart } from "./charts";

/** Next-N-days review workload, from the nightly-captured /schedule upcoming
    forecast (replaces the old client-computed ForecastCard). */
export function WorkloadCalendar({ points }: { points: WorkloadPoint[] }) {
  const total = points.reduce((sum, p) => sum + p.terms_to_review, 0);

  return (
    <Card delay={0.22}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13px] font-bold">Upcoming review workload</div>
        <span className="text-[11px] text-fg-faint">{total} over {points.length} days</span>
      </div>
      <BarChart values={points.map((p) => p.terms_to_review)} color="var(--teal)" />
      <div className="mt-1.5 flex justify-between text-[10px] text-fg-faint">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </Card>
  );
}
