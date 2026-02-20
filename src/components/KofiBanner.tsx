"use client";

const KOFI_URL = process.env.NEXT_PUBLIC_KOFI_URL;

/**
 * Optional donation banner with restrained green accent. Only renders when NEXT_PUBLIC_KOFI_URL is set.
 */
export function KofiBanner() {
  if (!KOFI_URL) return null;

  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block mx-4 mt-2 mb-0 rounded-xl border border-emerald-500/20 dark:border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 backdrop-blur-xl px-4 py-2.5 text-center text-sm text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 hover:border-emerald-500/30 hover:bg-emerald-500/10 dark:hover:bg-emerald-500/20 transition-colors font-github shadow-[0_2px_12px_rgba(0,0,0,0.06)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.2)]"
    >
      Support the project on Ko-fi
    </a>
  );
}
