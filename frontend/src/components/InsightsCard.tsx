import { Card } from "./ui";

/** Bulleted, data-driven insights (right of the Command Deck top row). */
export function InsightsCard({ insights }: { insights: string[] }) {
  return (
    <Card delay={0.12} className="flex flex-col justify-center gap-2">
      <div className="text-[11.5px] font-bold uppercase tracking-wide text-fg-muted">
        Insights
      </div>
      {insights.length === 0 ? (
        <p className="text-xs text-fg-faint">
          Insights appear as your progress builds up.
        </p>
      ) : (
        insights.map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-2.5 border-t border-card-border py-1.5"
          >
            <span className="mt-1.5 h-[5px] w-[5px] flex-none rounded-full bg-amber" />
            <span className="text-xs leading-relaxed text-fg-muted">{tip}</span>
          </div>
        ))
      )}
    </Card>
  );
}
