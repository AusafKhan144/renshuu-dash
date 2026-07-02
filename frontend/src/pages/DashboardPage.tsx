import { useEffect } from "react";
import { toast } from "sonner";
import { useOverview, useSchedules, useSpotlight } from "../api/client";
import { AchievementsShelf } from "../components/AchievementsShelf";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { DailyGoalRing } from "../components/DailyGoalRing";
import { ForecastCard } from "../components/ForecastCard";
import { InsightsCard } from "../components/InsightsCard";
import { JLPTCoverage } from "../components/JLPTCoverage";
import { JLPTLevelCheck } from "../components/JLPTLevelCheck";
import { LevelCard } from "../components/LevelCard";
import { N5Progress } from "../components/N5Progress";
import { OverviewCards } from "../components/OverviewCards";
import { QuickLookup } from "../components/QuickLookup";
import { ScheduleCards } from "../components/ScheduleCards";
import { TodaysFocus } from "../components/TodaysFocus";
import { TrendCard } from "../components/TrendCard";
import { WordSpotlight } from "../components/WordSpotlight";

export function DashboardPage() {
  const overview = useOverview(true);
  const schedules = useSchedules(true);
  const spotlight = useSpotlight(true);

  useEffect(() => {
    const due = schedules.data?.total_review_due ?? 0;
    if (due > 0) toast(`🔔 ${due} reviews ready to study!`);
  }, [schedules.data?.total_review_due]);

  const ov = overview.data;

  return (
    <div className="flex flex-col gap-4">
      {ov && (
        <div className="mb-1">
          <div className="text-[11px] text-fg-faint">
            {ov.as_of ? `Updated ${new Date(ov.as_of).toLocaleString()}` : "Your Japanese progress"}
          </div>
        </div>
      )}

      {schedules.data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TodaysFocus schedules={schedules.data} />
          {ov && <JLPTLevelCheck data={ov} />}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {spotlight.data && <WordSpotlight words={spotlight.data} />}
        <QuickLookup />
      </div>

      {ov && <N5Progress data={ov} />}

      {schedules.data && <ScheduleCards data={schedules.data} />}

      {/* Existing analytics, restyled onto the new palette (no logic changes). */}
      {ov && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_250px_1fr]">
          <DailyGoalRing data={ov} />
          <LevelCard data={ov} />
          <InsightsCard insights={ov.insights} />
        </div>
      )}

      {ov && <OverviewCards data={ov} />}

      {ov && <JLPTCoverage data={ov} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendCard enabled={true} />
        {schedules.data && <ForecastCard data={schedules.data} />}
      </div>

      <ActivityHeatmap enabled={true} />

      <AchievementsShelf enabled={true} />

      <footer className="mt-6 text-center text-xs text-fg-faint">
        Self-hosted · data from the Renshuu API · levels &amp; achievements are computed from
        your real progress
      </footer>
    </div>
  );
}
