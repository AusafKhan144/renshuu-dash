import { useState } from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { Overview } from "../api/client";
import { Card } from "./ui";

const COLORS: Record<string, string> = {
  n5: "#34d399",
  n4: "#38bdf8",
  n3: "#a78bfa",
  n2: "#f472b6",
  n1: "#fb7185",
};

const CATEGORIES = [
  { key: "vocab", label: "Vocab" },
  { key: "kanji", label: "Kanji" },
  { key: "grammar", label: "Grammar" },
  { key: "sent", label: "Sent." },
];

export function JLPTRadial({ data }: { data: Overview }) {
  const [category, setCategory] = useState("vocab");
  const percs = data.jlpt?.[category] ?? {};
  const levels = ["n5", "n4", "n3", "n2", "n1"].filter((l) => l in percs);

  const chartData = levels.map((l) => ({
    name: l.toUpperCase(),
    value: Math.round(Number(percs[l]) || 0),
    fill: COLORS[l],
  }));

  return (
    <Card delay={0.1}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-fg/80">JLPT coverage</h3>
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={
                "rounded-md px-2 py-1 text-xs " +
                (category === c.key
                  ? "bg-sky-500 text-white"
                  : "bg-fg/5 text-fg/60 hover:bg-fg/10")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {chartData.length === 0 ? (
        <p className="mt-6 text-sm text-fg/40">No JLPT data yet.</p>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="25%"
              outerRadius="100%"
              data={chartData}
              startAngle={90}
              endAngle={-270}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs">
        {chartData.map((d) => (
          <span key={d.name} className="flex items-center gap-1 text-fg/70">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: d.fill }}
            />
            {d.name} {d.value}%
          </span>
        ))}
      </div>
    </Card>
  );
}
