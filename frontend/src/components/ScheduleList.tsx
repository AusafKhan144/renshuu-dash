import { CheckCircle2, Clock, Sparkles } from "lucide-react";
import type { SchedulesResponse } from "../api/client";
import { Card } from "./ui";

export function ScheduleList({ data }: { data: SchedulesResponse }) {
  return (
    <Card delay={0.25} className="lg:col-span-2">
      <h3 className="text-sm font-semibold text-fg/80">Your schedules</h3>
      <div className="mt-3 space-y-2">
        {data.schedules.map((s) => {
          const total = s.terms?.total_count ?? 0;
          const studied = s.terms?.studied_count ?? 0;
          const pct = total ? Math.round((studied / total) * 100) : 0;
          return (
            <div
              key={s.id}
              className="rounded-xl border border-fg/5 bg-black/20 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="flex items-center gap-2 text-xs">
                  {s.new_available > 0 && (
                    <span className="flex items-center gap-1 text-sky-300">
                      <Sparkles size={14} /> +{s.new_available} new
                    </span>
                  )}
                  {s.review_due > 0 ? (
                    <span className="flex items-center gap-1 text-orange-300">
                      <Clock size={14} /> {s.review_due} due
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 size={14} /> done
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-fg/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-violet-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-fg/50">
                {studied}/{total} terms · {s.booktype}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
