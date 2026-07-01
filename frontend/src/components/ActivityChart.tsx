import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useState } from "react";
import { useActivity } from "../api/client";
import { Card } from "./ui";

const RANGES = [7, 30, 90];

export function ActivityChart({ enabled }: { enabled: boolean }) {
  const [days, setDays] = useState(30);
  const { data } = useActivity(days, enabled);
  const points = (data?.points ?? []).map((p) => ({
    label: p.day.slice(5), // MM-DD
    learned: p.learned,
  }));

  return (
    <Card delay={0.18} className="lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg/80">
          Terms learned per day ({days}d)
        </h3>
        <div className="flex gap-1">
          {RANGES.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={
                "rounded-md px-2 py-1 text-xs " +
                (days === d
                  ? "bg-sky-500 text-white"
                  : "bg-fg/5 text-fg/60 hover:bg-fg/10")
              }
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      {points.length === 0 ? (
        <p className="mt-6 text-sm text-fg/40">
          Daily activity fills in as snapshots accumulate — newly learned terms
          show up here each day.
        </p>
      ) : (
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points}>
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
              <Bar dataKey="learned" fill="var(--chart-accent-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
