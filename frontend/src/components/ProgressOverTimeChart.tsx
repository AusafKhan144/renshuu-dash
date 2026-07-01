import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useHistory } from "../api/client";
import { Card } from "./ui";

const METRICS = [
  { key: "total_vocab", label: "Vocab" },
  { key: "total_kanji", label: "Kanji" },
  { key: "total_grammar", label: "Grammar" },
  { key: "total", label: "All" },
];

const RANGES = [7, 30, 90];

export function ProgressOverTimeChart({ enabled }: { enabled: boolean }) {
  const [metric, setMetric] = useState("total_vocab");
  const [days, setDays] = useState(30);
  const { data } = useHistory(metric, days, enabled);
  const points = data?.points ?? [];

  return (
    <Card delay={0.2} className="lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-fg/80">
          Progress over time ({days}d)
        </h3>
        <div className="flex flex-wrap gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={
                "rounded-md px-2 py-1 text-xs " +
                (metric === m.key
                  ? "bg-sky-500 text-white"
                  : "bg-fg/5 text-fg/60 hover:bg-fg/10")
              }
            >
              {m.label}
            </button>
          ))}
          <span className="mx-1 w-px self-stretch bg-fg/10" />
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

      {points.length <= 1 ? (
        <p className="mt-6 text-sm text-fg/40">
          Charting starts now — your trend line fills in over the coming days as
          daily snapshots accumulate.
        </p>
      ) : (
        <div className="mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-accent)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="day" stroke="var(--chart-axis)" fontSize={11} />
              <YAxis stroke="var(--chart-axis)" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--tooltip-bg)",
                  border: "1px solid var(--tooltip-border)",
                  borderRadius: 8,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--chart-accent)"
                fill="url(#g)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
