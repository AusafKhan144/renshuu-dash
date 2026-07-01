/* Map the design's accent "hue" names to the runtime color CSS variables, so
   components can pick a themed color/soft-fill by name (badges, stat dots, …). */
export type Hue = "amber" | "teal" | "violet" | "rose" | "success";

export const HUE: Record<Hue, string> = {
  amber: "var(--amber)",
  teal: "var(--teal)",
  violet: "var(--violet)",
  rose: "var(--rose)",
  success: "var(--success)",
};

export const HUE_SOFT: Record<Hue, string> = {
  amber: "var(--amber-soft)",
  teal: "var(--teal-soft)",
  violet: "var(--violet-soft)",
  rose: "var(--rose-soft)",
  success: "var(--success-soft)",
};

// JLPT level → accent, from N5 (easiest) to N1 (hardest).
export const JLPT_COLORS = [
  "var(--success)",
  "var(--teal)",
  "var(--violet)",
  "var(--amber)",
  "var(--rose)",
];
