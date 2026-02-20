"use client";

// Your masjid image (sunset mosque) — only visible in dark mode, blurred.
const MASJID_IMAGE = "/mario-la-pergola-myy2_CazPR8-unsplash.jpg";

export default function RamadanBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Light mode: plain gradient, no image */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white opacity-100 dark:opacity-0 transition-opacity duration-300"
        aria-hidden
      />
      {/* Dark mode only: masjid image with blur */}
      <div
        className="absolute inset-0 opacity-0 dark:opacity-100 dark:blur-md transition-opacity duration-300 bg-slate-900"
        style={{
          backgroundImage: `url(${MASJID_IMAGE})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Overlay for readability: light has minimal tint, dark has stronger overlay over blurred masjid */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white/30 dark:from-slate-950/50 dark:via-slate-900/55 dark:to-slate-900/65"
        aria-hidden
      />
    </div>
  );
}
