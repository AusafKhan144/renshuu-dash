import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RefreshCw, Settings, Sun, Moon } from "lucide-react";
import {
  useAuthStatus,
  useSetupStatus,
  useOverview,
  useSchedules,
  onUnauthorized,
  api,
} from "./api/client";
import { LoginScreen } from "./auth/LoginScreen";
import { SetupWizard } from "./setup/SetupWizard";
import { SettingsPanel } from "./settings/SettingsPanel";
import { OverviewCards } from "./components/OverviewCards";
import { DailyGoalRing } from "./components/DailyGoalRing";
import { LevelCard } from "./components/LevelCard";
import { InsightsCard } from "./components/InsightsCard";
import { JLPTCoverage } from "./components/JLPTCoverage";
import { TrendCard } from "./components/TrendCard";
import { ForecastCard } from "./components/ForecastCard";
import { ActivityHeatmap } from "./components/ActivityHeatmap";
import { AchievementsShelf } from "./components/AchievementsShelf";
import { ScheduleList } from "./components/ScheduleList";
import type { Theme } from "./theme";

interface ThemeProps {
  theme: Theme;
  onToggleTheme: () => void;
}

/** Highest streak value across categories (Renshuu tracks one per category). */
function pickStreak(streaks: Record<string, unknown>, field: string): number | null {
  const vals = Object.values(streaks ?? {})
    .map((cat) =>
      typeof cat === "object" && cat
        ? Number((cat as Record<string, unknown>)[field])
        : NaN
    )
    .filter((n) => Number.isFinite(n));
  return vals.length ? Math.max(...vals) : null;
}

export default function App({ theme, onToggleTheme }: ThemeProps) {
  const qc = useQueryClient();
  const auth = useAuthStatus();

  const needsLogin = !!auth.data?.auth_required && !auth.data?.authenticated;

  // A 401 from any request means the session lapsed — re-check auth status so
  // the app falls back to the login screen.
  useEffect(
    () => onUnauthorized(() => qc.invalidateQueries({ queryKey: ["auth-status"] })),
    [qc]
  );

  // Only fetch setup status once we know we're allowed in.
  const status = useSetupStatus(auth.data != null && !needsLogin);

  if (auth.isLoading) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-fg-muted" />
      </div>
    );
  }

  if (needsLogin) return <LoginScreen />;

  if (status.isLoading || !status.data) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-fg-muted" />
      </div>
    );
  }

  if (!status.data.configured) return <SetupWizard />;

  return <Dashboard theme={theme} onToggleTheme={onToggleTheme} />;
}

function Dashboard({ theme, onToggleTheme }: ThemeProps) {
  const qc = useQueryClient();
  const overview = useOverview(true);
  const schedules = useSchedules(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // In-app toast when reviews are due (while the tab is open).
  useEffect(() => {
    const due = schedules.data?.total_review_due ?? 0;
    if (due > 0) toast(`🔔 ${due} reviews ready to study!`);
  }, [schedules.data?.total_review_due]);

  async function refresh() {
    await api.post("/refresh");
    await qc.invalidateQueries();
    toast.success("Refreshed from Renshuu");
  }

  const ov = overview.data;
  const streak = ov ? pickStreak(ov.streaks, "days_studied_in_a_row") : null;

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-[1180px] px-4 py-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-[32px] font-bold leading-none tracking-tight">
                練習
              </span>
              <span className="text-[15px] font-medium text-fg-muted">Command Deck</span>
            </div>
            <div className="mt-1.5 text-[12.5px] text-fg-faint">
              {ov?.as_of ? `Updated ${new Date(ov.as_of).toLocaleString()}` : "Your Japanese progress"}
              {ov ? ` · Level ${ov.level} · ${ov.level_title}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {streak != null && streak > 0 && (
              <div className="flex items-center gap-2 rounded-full bg-amber-soft px-3.5 py-2 text-[13px] font-bold text-amber">
                <span className="h-2 w-2 rounded-full bg-amber" />
                {streak}-day streak
              </div>
            )}
            <button
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-card-border text-fg-muted hover:text-fg"
            >
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button
              onClick={refresh}
              aria-label="Refresh"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-card-border text-fg-muted hover:text-fg"
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-card-border text-fg-muted hover:text-fg"
            >
              <Settings size={15} />
            </button>
          </div>
        </header>

        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

        <div className="flex flex-col gap-4">
          {/* Top row: daily goal · level · insights */}
          {ov && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[250px_250px_1fr]">
              <DailyGoalRing data={ov} />
              <LevelCard data={ov} />
              <InsightsCard insights={ov.insights} />
            </div>
          )}

          {/* Stat cards */}
          {ov && <OverviewCards data={ov} />}

          {/* JLPT coverage */}
          {ov && <JLPTCoverage data={ov} />}

          {/* Trends + forecast */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TrendCard enabled={true} />
            {schedules.data && <ForecastCard data={schedules.data} />}
          </div>

          {/* Activity heatmap */}
          <ActivityHeatmap enabled={true} />

          {/* Achievements */}
          <AchievementsShelf enabled={true} />

          {/* Schedules */}
          {schedules.data && <ScheduleList data={schedules.data} />}
        </div>

        <footer className="mt-10 text-center text-xs text-fg-faint">
          Self-hosted · data from the Renshuu API · levels &amp; achievements are
          computed from your real progress
        </footer>
      </div>
    </div>
  );
}
