import { NAV } from "./Sidebar";
import type { Page } from "./Sidebar";

export function BottomNav({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[60px] border-t border-card-border bg-surface">
      {NAV.map(({ id, shortLabel, icon: Icon }) => (
        <button
          key={id}
          onClick={() => onNavigate(id)}
          className={
            "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold " +
            (page === id ? "text-gold" : "text-fg-faint")
          }
        >
          <Icon size={18} />
          {shortLabel}
        </button>
      ))}
    </nav>
  );
}
