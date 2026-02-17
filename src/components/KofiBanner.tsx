"use client";

const KOFI_URL = process.env.NEXT_PUBLIC_KOFI_URL;

/**
 * Optional donation banner styled with the same Moon Glow (emerald) so it feels
 * like a native part of the night sky. Only renders when NEXT_PUBLIC_KOFI_URL is set.
 */
export function KofiBanner() {
  if (!KOFI_URL) return null;

  return (
    <a
      href={KOFI_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="block mx-4 mt-2 mb-0 rounded-xl border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-xl px-4 py-2.5 text-center text-sm text-emerald-100/90 hover:text-emerald-50 hover:border-emerald-400/30 hover:bg-emerald-500/15 transition-colors font-github shadow-[0_0_20px_rgba(5,150,105,0.08)]"
    >
      Support the project on Ko-fi
    </a>
  );
}
