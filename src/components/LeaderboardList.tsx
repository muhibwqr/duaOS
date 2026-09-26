"use client";

import { useEffect, useState } from "react";
import { getLibrary, getFavorites, getRequests } from "@/lib/library-storage";

type LeaderboardEntry = { name: string; total: number };

/** Split "English (Meaning) - العربية" content format into display parts. */
function parseNameContent(content: string): { english: string; meaning: string; arabic: string } {
  const dashIdx = content.lastIndexOf(" - ");
  const arabic = dashIdx >= 0 ? content.slice(dashIdx + 3).trim() : "";
  const head = dashIdx >= 0 ? content.slice(0, dashIdx) : content;
  const parenIdx = head.indexOf(" (");
  const english = (parenIdx >= 0 ? head.slice(0, parenIdx) : head).trim();
  const meaning = parenIdx >= 0 ? head.slice(parenIdx + 2, head.endsWith(")") ? -1 : undefined).trim() : "";
  return { english, meaning, arabic };
}

export function LeaderboardList() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { entries?: LeaderboardEntry[] }) => {
        setEntries(Array.isArray(data.entries) ? data.entries : []);
      })
      .catch(() => setError(true));
  }, []);

  const [stats, setStats] = useState<{ saved: number; top: [string, number][]; fulfilled: number } | null>(null);

  useEffect(() => {
    const library = getLibrary();
    const favorites = getFavorites();
    const nameCounts = new Map<string, number>();
    for (const n of [
      ...library.map((e) => e.name),
      ...favorites.map((f) => f.nameOfAllah),
    ]) {
      if (n) nameCounts.set(n, (nameCounts.get(n) ?? 0) + 1);
    }
    const top = [...nameCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const fulfilled = getRequests().filter((r) => r.madeAt).length;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setStats({ saved: library.length + favorites.length, top, fulfilled });
  }, []);

  const max = entries && entries.length > 0 ? Math.max(...entries.map((e) => e.total)) : 0;

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-4 sm:p-6 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]">
        {entries === null && !error && (
          <ul className="space-y-3" aria-label="Loading leaderboard">
            {Array.from({ length: 8 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 animate-pulse">
                <span className="w-6 h-4 rounded bg-slate-200/70 dark:bg-slate-700/50" />
                <span className="flex-1 h-6 rounded bg-slate-200/70 dark:bg-slate-700/50" />
                <span className="w-12 h-4 rounded bg-slate-200/70 dark:bg-slate-700/50" />
              </li>
            ))}
          </ul>
        )}
        {error && (
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">
            The leaderboard isn&apos;t available right now. Please check back soon.
          </p>
        )}
        {entries !== null && entries.length === 0 && !error && (
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">
            No du&apos;as recorded yet — yours could be the first.
          </p>
        )}
        {entries !== null && entries.length > 0 && (
          <ul className="divide-y divide-slate-200/60 dark:divide-slate-600/30">
            {entries.map((e, i) => {
              const { english, meaning, arabic } = parseNameContent(e.name);
              return (
                <li
                  key={e.name}
                  className={`flex items-center gap-4 py-3 ${i < 3 ? "bg-emerald-500/[0.04] dark:bg-emerald-500/[0.06]" : ""}`}
                >
                  <span className="w-7 text-right font-github text-sm tabular-nums text-slate-400 dark:text-slate-500 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {arabic && (
                      <p className="font-calligraphy text-xl text-slate-800 dark:text-slate-100 leading-snug">
                        {arabic}
                      </p>
                    )}
                    <p className="font-github text-xs text-slate-500 dark:text-slate-400 truncate">
                      {english}
                      {meaning ? ` · ${meaning}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="hidden sm:block w-24 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/50 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500/70"
                        style={{ width: `${Math.max(4, Math.round((e.total / max) * 100))}%` }}
                      />
                    </div>
                    <span className="w-14 text-right font-github text-sm tabular-nums text-slate-600 dark:text-slate-300">
                      {e.total.toLocaleString()}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200/60 dark:border-slate-500/30 bg-white/90 dark:bg-slate-800/50 backdrop-blur-xl p-4 sm:p-6 shadow-[0_2px_24px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]">
        <h2 className="font-serif text-lg font-medium text-slate-800 dark:text-slate-100 mb-4">Your du&apos;as</h2>
        {stats ? (
          <dl className="space-y-3 font-github text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Saved du&apos;as</dt>
              <dd className="tabular-nums text-slate-800 dark:text-slate-200">{stats.saved}</dd>
            </div>
            <div>
              <dt className="text-slate-500 dark:text-slate-400 mb-1">Names you invoked most</dt>
              <dd>
                {stats.top.length === 0 ? (
                  <span className="text-slate-400 dark:text-slate-500">None yet</span>
                ) : (
                  <ul className="space-y-1">
                    {stats.top.map(([name, count]) => (
                      <li key={name} className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span className="truncate">{name}</span>
                        <span className="tabular-nums text-slate-500 dark:text-slate-400">{count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Requests fulfilled</dt>
              <dd className="tabular-nums text-slate-800 dark:text-slate-200">{stats.fulfilled}</dd>
            </div>
          </dl>
        ) : (
          <p className="font-github text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        )}
      </section>
    </div>
  );
}
