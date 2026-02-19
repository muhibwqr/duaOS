"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Github, ShoppingBag } from "lucide-react";

const GITHUB_REPO_URL = "https://github.com/muhibwqr/duaOS";

type HeaderProps = {
  /** When set, shows a cart icon for favorites; count is the badge number. */
  favoritesCount?: number;
  onCartClick?: () => void;
};

export function Header({ favoritesCount = 0, onCartClick }: HeaderProps) {
  const [totalDuasCount, setTotalDuasCount] = useState<number | null>(null);

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
      <div className="w-full bg-emerald-600 py-2 text-center font-github text-sm text-white">
        Currently showing completed updates only. Shipping more updates soon 🚀
      </div>
      <div className="px-4 pt-3">
      <div
        className="mx-auto flex max-w-4xl items-center justify-between gap-6 rounded-full border border-white/10 bg-slate-900/40 px-6 py-3 backdrop-blur-xl shadow-[0_0_32px_rgba(255,255,255,0.08),0_0_48px_rgba(5,150,105,0.06)] hover:shadow-[0_0_40px_rgba(255,255,255,0.1),0_0_60px_rgba(5,150,105,0.08)] transition-shadow duration-300"
      >
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/" className="font-github text-lg font-semibold text-slate-100 hover:text-white transition-colors" aria-label="du'aOS home">
            Du'aOS
          </Link>
          {totalDuasCount != null && (
            <span className="font-github text-sm text-slate-400">
              {totalDuasCount.toLocaleString()} du&apos;as made using du&apos;aOS
            </span>
          )}
        </div>
        <nav className="hidden sm:flex items-center gap-8 font-github text-sm text-slate-300">
          <Link href="/why" className="hover:text-white transition-colors">
            why we're doing this
          </Link>
          <Link href="/how" className="hover:text-white transition-colors">
            how it works
          </Link>
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-600/90 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-500/90 hover:border-emerald-400/40 backdrop-blur-xl transition-all duration-300 font-github shadow-[0_0_20px_rgba(5,150,105,0.2)] hover:shadow-[0_0_28px_rgba(5,150,105,0.3)]"
          >
            <Github className="size-4" />
            Star on GitHub
          </a>
          {onCartClick != null && (
            <button
              type="button"
              onClick={onCartClick}
              className="relative inline-flex items-center justify-center rounded-full border border-slate-500/40 bg-slate-800/60 p-2.5 text-slate-300 hover:text-slate-100 hover:bg-slate-700/60 hover:border-slate-400/50 transition-colors"
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
