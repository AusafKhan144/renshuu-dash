import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useAuthStatus, useSetupStatus, onUnauthorized } from "./api/client";
import { LoginScreen } from "./auth/LoginScreen";
import { SetupWizard } from "./setup/SetupWizard";
import { Shell } from "./components/Shell";
import type { Theme } from "./theme";

interface ThemeProps {
  theme: Theme;
  onToggleTheme: () => void;
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

  return <Shell theme={theme} onToggleTheme={onToggleTheme} />;
}
