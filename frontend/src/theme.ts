import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "renshu-theme";

function preferred(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Apply the theme by toggling the `light` class on <html>. Call once at
 *  startup (in main.tsx) to avoid a flash of the wrong theme. */
export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("light", theme === "light");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(preferred);

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    toggle: () => setTheme((t) => (t === "light" ? "dark" : "light")),
  };
}
