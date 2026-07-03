import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Loader2, Moon, RefreshCw, Settings as SettingsIcon, Sun } from "lucide-react";
import { api, useOverview, useUsage } from "../api/client";
import { DashboardPage } from "../pages/DashboardPage";
import { InsightsPage } from "../pages/InsightsPage";
import { KanaPage } from "../pages/KanaPage";
import { ListsPage } from "../pages/ListsPage";
import { SettingsPage } from "../pages/SettingsPage";
import type { Theme } from "../theme";
import { BottomNav } from "./BottomNav";
import { Sidebar, type Page } from "./Sidebar";

const PAGES: Page[] = ["dashboard", "kana", "insights", "lists", "settings"];

function pageFromHash(): Page {
  const h = window.location.hash.replace("#", "") as Page;
  return PAGES.includes(h) ? h : "dashboard";
}

export function Shell({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const qc = useQueryClient();
  const [page, setPage] = useState<Page>(pageFromHash);
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const overview = useOverview(true);
  const usage = useUsage(true);

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    window.location.hash = page;
  }, [page]);

  async function doRefresh() {
    setRefreshing(true);
    try {
      await api.post("/refresh");
      await qc.invalidateQueries();
      toast.success("Refreshed from Renshuu");
      setConfirmOpen(false);
    } catch {
      toast.error("Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  const contentMarginLeft = isDesktop ? 240 : 0;
  const contentPaddingBottom = isDesktop ? 0 : 76;

  return (
    <div className="app-bg min-h-screen">
      {isDesktop ? (
        <Sidebar
          page={page}
          onNavigate={setPage}
          overview={overview.data}
          usage={usage.data}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onRefresh={() => setConfirmOpen(true)}
        />
      ) : (
        <TopBar
          kaoUrl={overview.data?.kao_url ?? null}
          onSettings={() => setPage("settings")}
          onRefresh={() => setConfirmOpen(true)}
          theme={theme}
          onToggleTheme={onToggleTheme}
        />
      )}

      <main style={{ marginLeft: contentMarginLeft, paddingBottom: contentPaddingBottom }}>
        <div className="mx-auto max-w-[1180px] px-4 py-6 sm:py-8">
          {page === "dashboard" && <DashboardPage />}
          {page === "kana" && <KanaPage />}
          {page === "insights" && <InsightsPage />}
          {page === "lists" && <ListsPage />}
          {page === "settings" && <SettingsPage />}
        </div>
      </main>

      {!isDesktop && <BottomNav page={page} onNavigate={setPage} />}

      {confirmOpen && (
        <RefreshDialog
          remaining={usage.data?.remaining ?? null}
          busy={refreshing}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={doRefresh}
        />
      )}
    </div>
  );
}

function TopBar({
  kaoUrl,
  onSettings,
  onRefresh,
  theme,
  onToggleTheme,
}: {
  kaoUrl: string | null;
  onSettings: () => void;
  onRefresh: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-card-border bg-surface px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-inset text-[13px]">
          {kaoUrl ? <img src={kaoUrl} alt="Kao" className="h-full w-full object-cover" /> : <span>🙂</span>}
        </div>
        <span className="font-display text-[19px] font-bold leading-none">Renshu</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-card-border text-fg-muted"
        >
          {theme === "light" ? <Moon size={13} /> : <Sun size={13} />}
        </button>
        <button
          onClick={onRefresh}
          aria-label="Refresh from Renshuu"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-card-border text-fg-muted"
        >
          <RefreshCw size={13} />
        </button>
        <button
          onClick={onSettings}
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-card-border text-fg-muted"
        >
          <SettingsIcon size={13} />
        </button>
      </div>
    </header>
  );
}

function RefreshDialog({
  remaining,
  busy,
  onCancel,
  onConfirm,
}: {
  remaining: number | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[18px] border border-card-border bg-card p-6 card-shadow"
      >
        <div className="flex items-center gap-2 text-[15px] font-bold">
          <RefreshCw size={16} className="text-gold" /> Refresh from Renshuu?
        </div>
        <p className="mt-2.5 text-sm text-fg-muted">
          Refreshing pulls live data from Renshuu and uses part of your daily quota.
          {remaining != null && (
            <>
              {" "}
              You have <span className="font-bold text-fg">{remaining} / 500</span> calls left
              today.
            </>
          )}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-[10px] border border-card-border-strong px-3.5 py-2 text-[12.5px] font-bold text-fg-muted hover:text-fg"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex items-center gap-2 rounded-[10px] bg-gold px-3.5 py-2 text-[12.5px] font-bold text-on-accent disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
}
