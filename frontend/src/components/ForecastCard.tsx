import type { SchedulesResponse } from "../api/client";
import { Card } from "./ui";
import { BarChart } from "./charts";

/** Upcoming reviews per day, merged across schedules (inline SVG bars). */
export function ForecastCard({ data }: { data: SchedulesResponse }) {
  const byDay = new Map<number, number>();
  for (const s of data.schedules) {
    for (const u of s.upcoming ?? []) {
      const d = Number(u.days_in_future);
      const n = Number(u.terms_to_review);
      if (Number.isFinite(d) && Number.isFinite(n)) {
        byDay.set(d, (byDay.get(d) ?? 0) + n);
      }
    }
  }
  const values = Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, n]) => n);

  return (
    <Card delay={0.18}>
      <div className="mb-2.5 text-[13px] font-bold">Upcoming reviews</div>
      <BarChart values={values} color="var(--teal)" />
    </Card>
  );
}
