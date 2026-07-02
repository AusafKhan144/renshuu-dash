import type { SchedulesResponse } from "../api/client";
import { Card } from "./ui";

export function ScheduleCards({ data }: { data: SchedulesResponse }) {
  return (
    <div>
      <div className="mb-3 text-[13px] font-bold">Schedules</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {data.schedules.map((s, i) => {
          const total = s.terms?.total_count ?? 0;
          const studied = s.terms?.studied_count ?? 0;
          const pct = total ? Math.round((studied / total) * 100) : 0;
          return (
            <Card key={s.id} delay={0.02 * i}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold">{s.name}</span>
                {s.review_due > 0 ? (
                  <span className="whitespace-nowrap rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-bold text-red">
                    {s.review_due} due
                  </span>
                ) : (
                  <span className="whitespace-nowrap rounded-full bg-jade-soft px-2 py-0.5 text-[11px] font-bold text-jade">
                    done
                  </span>
                )}
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-card-border-strong">
                <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-fg-faint">
                <span>
                  {studied}/{total} terms · {s.booktype}
                </span>
                {s.new_available > 0 && (
                  <span className="font-semibold text-jade">+{s.new_available} new</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
