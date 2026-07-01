import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { SchedulesResponse } from "../api/client";
import { Card } from "./ui";

export function ReviewForecastChart({ data }: { data: SchedulesResponse }) {
  // Merge each schedule's upcoming forecast into a per-day total.
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
  const chartData = Array.from(byDay.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([d, n]) => ({
      label: d === 0 ? "Today" : d === 1 ? "Tmrw" : `+${d}d`,
      reviews: n,
    }));

  return (
    <Card delay={0.15} className="lg:col-span-2">
      <h3 className="text-sm font-semibold text-fg/80">
        Upcoming reviews forecast
      </h3>
      {chartData.length === 0 ? (
        <p className="mt-6 text-sm text-fg/40">No upcoming reviews scheduled.</p>
      ) : (
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="label" stroke="var(--chart-axis)" fontSize={11} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="reviews" fill="var(--chart-accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
