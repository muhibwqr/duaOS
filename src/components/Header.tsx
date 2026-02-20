"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Github, ShoppingBag, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

const GITHUB_REPO_URL = "https://github.com/muhibwqr/duaOS";

type HeaderProps = {
  favoritesCount?: number;
  onCartClick?: () => void;
};

export function Header({ favoritesCount = 0, onCartClick }: HeaderProps) {
  const [totalDuasCount, setTotalDuasCount] = useState<number | null>(null);
  const { theme, setTheme, resolvedDark } = useTheme();

  useEffect(() => {
    fetch("/api/duas/count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number } | null) => {
        if (data != null && typeof data.count === "number") setTotalDuasCount(data.count);
      })
      .catch(() => {});
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-10">
      <div className="w-full border-b border-emerald-500/20 bg-white/50 dark:bg-slate-900/50 dark:border-slate-600/30 py-2 text-center font-github text-sm text-slate-600 dark:text-slate-300 backdrop-blur-md">
        Shipping more updates soon
      </div>
      <div className="px-4 pt-3">
        <div
          className="mx-auto flex max-w-4xl items-center justify-between gap-6 rounded-2xl border border-slate-200/60 dark:border-slate-600/40 bg-white/50 dark:bg-slate-900/50 px-6 py-3 backdrop-blur-xl shadow-[0_2px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_20px_rgba(0,0,0,0.3)] transition-shadow duration-200"
        >
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              className="font-github text-lg font-semibold text-slate-800 dark:text-slate-100 hover:text-slate-900 dark:hover:text-white transition-colors"
              aria-label="Du'aOS home"
            >
              Du'aOS
            </Link>
            {totalDuasCount != null && (
              <span className="font-github text-sm text-slate-500 dark:text-slate-400">
                {totalDuasCount.toLocaleString()} du&apos;as made using du&apos;aOS
              </span>
            )}
          </div>
          <nav className="hidden sm:flex items-center gap-8 font-github text-sm text-slate-600 dark:text-slate-400">
            <Link href="/why" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              why we're doing this
            </Link>
            <Link href="/how" className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
              how it works
            </Link>
          </nav>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setTheme(resolvedDark ? "light" : "dark")}
              className="rounded-xl border border-slate-200/80 dark:border-slate-600/50 bg-slate-100/80 dark:bg-slate-800/80 p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
              aria-label={resolvedDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {resolvedDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 hover:border-emerald-500/60 font-github shadow-[0_2px_12px_rgba(5,150,105,0.25)] transition-colors duration-200"
            >
              <Github className="size-4" />
              Star on GitHub
            </a>
            {onCartClick != null && (
              <button
                type="button"
                onClick={onCartClick}
                className="relative inline-flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-600/50 bg-slate-100/80 dark:bg-slate-800/80 p-2.5 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors"
                aria-label={favoritesCount > 0 ? `${favoritesCount} favorites` : "Favorites"}
              >
                <ShoppingBag className="size-5" />
                {favoritesCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-medium text-white">
                    {favoritesCount > 99 ? "99+" : favoritesCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
