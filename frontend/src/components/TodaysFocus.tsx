import { Flame } from "lucide-react";
import type { SchedulesResponse } from "../api/client";
import { Card } from "./ui";

export function TodaysFocus({ schedules }: { schedules: SchedulesResponse }) {
  const due = schedules.total_review_due;
  const newAvailable = schedules.schedules.reduce((sum, s) => sum + s.new_available, 0);

  return (
    <Card delay={0}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[12.5px] font-bold uppercase tracking-wide text-fg-faint">
            Today's focus
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[40px] font-bold leading-none text-red">
              {due}
            </span>
            <span className="text-sm text-fg-muted">reviews due</span>
          </div>
          {newAvailable > 0 && (
            <div className="mt-1.5 text-[13px] font-semibold text-jade">
              +{newAvailable} new terms available
            </div>
          )}
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-soft text-red">
          <Flame size={26} />
        </div>
      </div>
    </Card>
  );
}
