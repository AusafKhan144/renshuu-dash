/* Lightweight inline-SVG charts ported from the design canvas — a progress ring,
   an area sparkline, a bar chart, and a GitHub-style heatmap. No chart library:
   these draw exactly the flat shapes the design specifies and theme via the
   runtime color CSS variables (var(--amber), var(--teal), var(--inset), …). */

import type { ReactNode } from "react";

// --- math helpers (verbatim from the design script) -----------------------

/** Stroke-dasharray for a ring of radius `r` filled to fraction `frac` (0..1). */
export function ringDash(frac: number, r: number): string {
  const p = Math.max(0, Math.min(1, frac || 0));
  const c = 2 * Math.PI * r;
  const dash = p * c;
  return `${dash.toFixed(1)} ${(c - dash).toFixed(1)}`;
}

export function makeArea(values: number[], w: number, h: number, pad: number) {
  const n = values.length;
  if (n < 2) return { line: "", area: "" };
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const stepX = (w - pad * 2) / (n - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts
    .map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1))
    .join(" ");
  const last = pts[pts.length - 1];
  const area =
    line + ` L${last[0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  return { line, area };
}

export function makeBars(values: number[], w: number, h: number, pad: number, gap: number) {
  const n = values.length;
  const max = Math.max(...values, 1);
  const bw = (w - pad * 2 - gap * (n - 1)) / n;
  return values.map((v, i) => {
    const bh = Math.max(3, (v / max) * (h - pad * 2 - 16));
    return {
      x: pad + i * (bw + gap),
      y: h - pad - bh,
      w: bw,
      h: bh,
    };
  });
}

/** Intensity buckets → cell opacity for the activity heatmap. */
export function levelOpacity(v: number): number {
  if (v <= 0) return 0.12;
  if (v <= 2) return 0.32;
  if (v <= 5) return 0.52;
  if (v <= 9) return 0.74;
  return 1;
}

// --- components -----------------------------------------------------------

export function Ring({
  size,
  stroke,
  frac,
  color = "var(--amber)",
  track = "var(--inset)",
  children,
}: {
  size: number;
  stroke: number;
  frac: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = size / 2 - stroke;
  const c = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={ringDash(frac, r)}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

let areaId = 0;

export function AreaSparkline({
  values,
  height = 170,
  color = "var(--amber)",
}: {
  values: number[];
  height?: number;
  color?: string;
}) {
  const W = 520;
  const { line, area } = makeArea(values, W, height, 6);
  const id = `area-fill-${(areaId += 1)}`;
  if (!line) {
    return (
      <p className="py-6 text-sm text-fg-faint">
        Charting starts now — your trend fills in as daily snapshots accumulate.
      </p>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} />
    </svg>
  );
}

export function BarChart({
  values,
  height = 170,
  color = "var(--teal)",
}: {
  values: number[];
  height?: number;
  color?: string;
}) {
  const W = 520;
  if (values.length === 0) {
    return <p className="py-6 text-sm text-fg-faint">No upcoming reviews scheduled.</p>;
  }
  const bars = makeBars(values, W, height, 6, 10);
  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={4} fill={color} />
      ))}
    </svg>
  );
}

/** Multi-series line chart (no fill), reusing the AreaSparkline point math so
    every series shares one x/y scale. Each series can have its own color. */
export function LineChart({
  series,
  height = 170,
  showDots = false,
}: {
  series: { values: number[]; color: string }[];
  height?: number;
  showDots?: boolean;
}) {
  const W = 520;
  const pad = 6;
  const allValues = series.flatMap((s) => s.values);
  if (allValues.length < 2) {
    return (
      <p className="py-6 text-sm text-fg-faint">
        Charting starts now — your trend fills in as daily snapshots accumulate.
      </p>
    );
  }
  const max = Math.max(...allValues);
  const min = Math.min(...allValues, 0);
  const range = Math.max(max - min, 1);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {series.map((s, i) => {
        const n = s.values.length;
        if (n < 2) return null;
        const stepX = (W - pad * 2) / (n - 1);
        const pts = s.values.map((v, j) => {
          const x = pad + j * stepX;
          const y = pad + (1 - (v - min) / range) * (height - pad * 2);
          return [x, y] as const;
        });
        const line = pts
          .map((p, j) => (j === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1))
          .join(" ");
        return (
          <g key={i}>
            <path d={line} fill="none" stroke={s.color} strokeWidth={2.25} />
            {showDots &&
              pts.map((p, j) => (
                <circle key={j} cx={p[0]} cy={p[1]} r={2.25} fill={s.color} />
              ))}
          </g>
        );
      })}
    </svg>
  );
}

export function Heatmap({
  values,
  cell = 11,
  gap = 3,
  color = "var(--amber)",
}: {
  values: { day: string; learned: number }[];
  cell?: number;
  gap?: number;
  color?: string;
}) {
  return (
    <div
      className="grid grid-flow-col overflow-x-auto pb-1"
      style={{ gridTemplateRows: `repeat(7, ${cell}px)`, gap }}
    >
      {values.map((v) => (
        <div
          key={v.day}
          title={`${v.day}: ${v.learned} learned`}
          style={{
            width: cell,
            height: cell,
            borderRadius: 3,
            background: color,
            opacity: levelOpacity(v.learned),
          }}
        />
      ))}
    </div>
  );
}
