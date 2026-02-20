"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "duaos-theme";

export type Theme = "light" | "dark" | "system";

function getStored(): Theme {
  if (typeof window === "undefined") return "light";
  const v = localStorage.getItem(STORAGE_KEY);
  if (v === "dark" || v === "light" || v === "system") return v;
  return "system";
}

function getEffectiveDark(supportsDark: boolean): boolean {
  const t = getStored();
  if (t === "dark") return true;
  if (t === "light") return false;
  return supportsDark;
}

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
}

export const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedDark: boolean;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always start with light/false so server and client first render match (avoids hydration error).
  // The inline script in layout sets .dark on <html> before paint; we sync theme from localStorage in useEffect.
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedDark, setResolvedDark] = useState(false);

  useEffect(() => {
    const stored = getStored();
    setThemeState(stored);
    const dark =
      stored === "dark" ||
      (stored === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setResolvedDark(dark);
    applyTheme(dark);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    const dark =
      next === "dark" ||
      (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setResolvedDark(dark);
    applyTheme(dark);
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      setResolvedDark(mq.matches);
      applyTheme(mq.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
