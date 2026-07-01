import type { SchedulesResponse } from "../api/client";
import { Card } from "./ui";

export function ScheduleList({ data }: { data: SchedulesResponse }) {
  return (
    <Card delay={0.24}>
      <div className="mb-3 text-[13px] font-bold">Your schedules</div>
      <div className="flex flex-col gap-2">
        {data.schedules.map((s) => {
          const total = s.terms?.total_count ?? 0;
          const studied = s.terms?.studied_count ?? 0;
          const pct = total ? Math.round((studied / total) * 100) : 0;
          return (
            <div key={s.id} className="rounded-[14px] bg-inset p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">{s.name}</span>
                <span className="flex items-center gap-3 text-[11.5px] font-bold">
                  {s.new_available > 0 && (
                    <span className="text-teal">+{s.new_available} new</span>
                  )}
                  {s.review_due > 0 ? (
                    <span className="text-amber">{s.review_due} due</span>
                  ) : (
                    <span className="text-success">done</span>
                  )}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-card-border-strong">
                <div
                  className="h-full rounded-full bg-amber"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-fg-faint">
                {studied}/{total} terms · {s.booktype}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
