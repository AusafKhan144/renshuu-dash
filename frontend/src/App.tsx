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
import { JLPTRadial } from "./components/JLPTRadial";
import { ReviewForecastChart } from "./components/ReviewForecastChart";
import { ProgressOverTimeChart } from "./components/ProgressOverTimeChart";
import { ActivityChart } from "./components/ActivityChart";
import { ActivityHeatmap } from "./components/ActivityHeatmap";
import { ScheduleList } from "./components/ScheduleList";
import { StartReviewCTA } from "./components/StartReviewCTA";
import type { Theme } from "./theme";

interface ThemeProps {
  theme: Theme;
  onToggleTheme: () => void;
}

export default function App({ theme, onToggleTheme }: ThemeProps) {
  const qc = useQueryClient();
  const auth = useAuthStatus();

  const needsLogin =
    !!auth.data?.auth_required && !auth.data?.authenticated;

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

  if (needsLogin) {
    return <LoginScreen />;
  }

  if (status.isLoading || !status.data) {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-fg-muted" />
      </div>
    );
  }

  if (!status.data.configured) {
    return <SetupWizard />;
  }

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

  return (
    <div className="app-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">練習 Dashboard</h1>
            <p className="text-sm text-fg/50">
              {overview.data?.as_of
                ? `Updated ${new Date(overview.data.as_of).toLocaleString()}`
                : "Your Japanese progress"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="rounded-lg border border-fg/10 bg-fg/5 p-2 hover:bg-fg/10"
            >
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              aria-label="Settings"
              className="rounded-lg border border-fg/10 bg-fg/5 p-2 hover:bg-fg/10"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={refresh}
              className="flex items-center gap-2 rounded-lg border border-fg/10 bg-fg/5 px-3 py-2 text-sm hover:bg-fg/10"
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </header>

        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

        {schedules.data && (
          <div className="mb-6">
            <StartReviewCTA
              due={schedules.data.total_review_due}
              newAvailable={schedules.data.schedules.reduce(
                (sum, s) => sum + (s.new_available ?? 0),
                0
              )}
            />
          </div>
        )}

        {overview.data && (
          <div className="mb-6">
            <OverviewCards data={overview.data} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ProgressOverTimeChart enabled={true} />
          {overview.data && <JLPTRadial data={overview.data} />}
          <ActivityChart enabled={true} />
          <ActivityHeatmap enabled={true} />
          {schedules.data && <ReviewForecastChart data={schedules.data} />}
          {schedules.data && <ScheduleList data={schedules.data} />}
        </div>

        <footer className="mt-10 text-center text-xs text-fg/30">
          Self-hosted · data from the Renshuu API · history grows over time
        </footer>
      </div>
    </div>
  );
}
