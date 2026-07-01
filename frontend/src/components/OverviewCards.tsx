import { BookText, Languages, GraduationCap, Flame, MessageSquareText } from "lucide-react";
import type { Overview } from "../api/client";
import { Card, AnimatedNumber, Delta } from "./ui";

// Renshuu returns streaks as { vocab: { days_studied_in_a_row, ... }, kanji: {...}, ... }.
// The user's day streak is the highest current `days_studied_in_a_row` across
// categories; the all-time best lives in `days_studied_in_a_row_alltime`.
function pickStreak(
  streaks: Record<string, unknown>,
  field: "days_studied_in_a_row" | "days_studied_in_a_row_alltime"
): number | null {
  const vals = Object.values(streaks ?? {})
    .map((cat) =>
      typeof cat === "object" && cat
        ? Number((cat as Record<string, unknown>)[field])
        : NaN
    )
    .filter((n) => Number.isFinite(n));
  return vals.length ? Math.max(...vals) : null;
}

export function OverviewCards({ data }: { data: Overview }) {
  const bestStreak = pickStreak(data.streaks, "days_studied_in_a_row_alltime");
  const cards = [
    {
      label: "Vocabulary",
      value: data.totals.vocab,
      delta: data.weekly_delta.vocab,
      subtitle: null as string | null,
      icon: BookText,
      color: "text-sky-400",
    },
    {
      label: "Kanji",
      value: data.totals.kanji,
      delta: data.weekly_delta.kanji,
      subtitle: null,
      icon: Languages,
      color: "text-violet-400",
    },
    {
      label: "Grammar",
      value: data.totals.grammar,
      delta: data.weekly_delta.grammar,
      subtitle: null,
      icon: GraduationCap,
      color: "text-emerald-400",
    },
    {
      label: "Sentences",
      value: data.totals.sentences,
      delta: data.weekly_delta.sentences,
      subtitle: null,
      icon: MessageSquareText,
      color: "text-amber-400",
    },
    {
      label: "Day streak",
      value: pickStreak(data.streaks, "days_studied_in_a_row"),
      delta: null,
      subtitle: bestStreak ? `best ${bestStreak}` : null,
      icon: Flame,
      color: "text-orange-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} delay={i * 0.06}>
            <div className="flex items-center justify-between">
              <span className="text-sm text-fg/60">{c.label}</span>
              <Icon size={18} className={c.color} />
            </div>
            <div className="mt-2 text-3xl font-bold">
              <AnimatedNumber value={c.value} />
            </div>
            {c.subtitle ? (
              <span className="ml-0.5 text-sm font-medium text-fg/40">
                {c.subtitle}
              </span>
            ) : (
              <Delta value={c.delta} />
            )}
          </Card>
        );
      })}
    </div>
  );
}
