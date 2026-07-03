import type { LucideIcon } from "lucide-react";
import { BarChart3, Grid3x3, LayoutDashboard, ListChecks, Moon, RefreshCw, Settings as SettingsIcon, Sun } from "lucide-react";
import type { Overview, UsageResponse } from "../api/client";
import { pickStreak } from "../api/client";
import type { Theme } from "../theme";
import { Ring } from "./charts";

export type Page = "dashboard" | "kana" | "lists" | "insights" | "settings";

export const NAV: { id: Page; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
  { id: "kana", label: "Kana Mastery", shortLabel: "Kana", icon: Grid3x3 },
  { id: "insights", label: "Insights", shortLabel: "Insights", icon: BarChart3 },
  { id: "lists", label: "My Lists", shortLabel: "Lists", icon: ListChecks },
  { id: "settings", label: "Settings", shortLabel: "Settings", icon: SettingsIcon },
];

export function Sidebar({
  page,
  onNavigate,
  overview,
  usage,
  theme,
  onToggleTheme,
  onRefresh,
}: {
  page: Page;
  onNavigate: (p: Page) => void;
  overview?: Overview;
  usage?: UsageResponse;
  theme: Theme;
  onToggleTheme: () => void;
  onRefresh: () => void;
}) {
  const streak = overview ? pickStreak(overview.streaks) : null;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-[240px] flex-col border-r border-card-border bg-surface px-4 py-5">
      <div className="flex items-center gap-2.5 px-1">
        <span className="font-display text-[22px] font-bold leading-none">Renshu</span>
        <span className="text-[12px] font-medium text-fg-muted">Renshuu</span>
      </div>

      {overview && (
        <div className="mt-5 flex items-center gap-3 rounded-[14px] bg-inset p-3">
          <div className="relative shrink-0">
            <Ring size={42} stroke={4} frac={overview.xp.pct / 100} color="var(--gold)">
              <span className="font-display text-[12px] font-bold">{overview.level}</span>
            </Ring>
            <div className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center overflow-hidden rounded-full border-2 border-surface bg-inset text-[10px]">
              {overview.kao_url ? (
                <img src={overview.kao_url} alt="Kao" className="h-full w-full object-cover" />
              ) : (
                <span>🙂</span>
              )}
            </div>
          </div>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-bold">
              {overview.account_name ?? "Studying"}
            </div>
            <div className="truncate text-[11px] text-fg-faint">{overview.level_title}</div>
          </div>
        </div>
      )}

      {streak != null && streak > 0 && (
        <div className="mt-2.5 flex items-center gap-2 self-start rounded-full bg-gold-soft px-3 py-1.5 text-[12px] font-bold text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          {streak}-day streak
        </div>
      )}

      <nav className="mt-6 flex flex-1 flex-col gap-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={
              "flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-left text-[13px] font-semibold transition-colors " +
              (page === id
                ? "bg-gold text-on-accent"
                : "text-fg-muted hover:bg-inset hover:text-fg")
            }
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-card-border text-fg-muted hover:text-fg"
        >
          {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
        </button>
        <button
          onClick={onRefresh}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border border-card-border text-[12px] font-bold text-fg-muted hover:text-fg"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="mt-3 text-center text-[11px] text-fg-faint">
        {usage?.calls_today != null
          ? `${usage.calls_today} / ${usage.daily_allowance} API calls today`
          : "API usage —"}
      </div>
    </aside>
  );
}
