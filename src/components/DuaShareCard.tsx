"use client";

/**
 * Square 1080×1080 card for share/download: personal du'a, Name of Allah,
 * hadith sources, duaos.com bottom right. Captured via html-to-image.
 */

type DuaShareCardProps = {
  personalDua: string;
  nameOfAllah?: string;
  hadithSources: string[];
};

/** Split "English (Meaning) - العربية" into parts for display. */
function parseNameContent(content: string): { english: string; arabic: string } {
  const dashIdx = content.lastIndexOf(" - ");
  const arabic = dashIdx >= 0 ? content.slice(dashIdx + 3).trim() : "";
  const head = dashIdx >= 0 ? content.slice(0, dashIdx) : content;
  const english = head.trim();
  return { english, arabic };
}

function duaFontSize(text: string): number {
  if (text.length > 600) return 26;
  if (text.length > 300) return 34;
  return 42;
}

export function DuaShareCard({ personalDua, nameOfAllah, hadithSources }: DuaShareCardProps) {
  const name = nameOfAllah ? parseNameContent(nameOfAllah) : null;
  return (
    <div
      className="relative flex flex-col text-slate-800 overflow-hidden"
      style={{
        width: 1080,
        height: 1080,
        background: "#faf7f2",
        fontFamily: '"EB Garamond", serif',
      }}
    >
      {/* Top emerald rule */}
      <div style={{ height: 10, background: "linear-gradient(90deg, #059669, #34d399, #059669)" }} />

      {/* Header row */}
      <div className="flex items-start justify-between px-14 pt-10">
        <span
          className="font-github"
          style={{ fontSize: 22, letterSpacing: "0.08em", color: "#64748b" }}
        >
          du&apos;aOS
        </span>
        {name && (
          <div className="text-right">
            {name.arabic && (
              <p className="font-calligraphy" style={{ fontSize: 40, lineHeight: 1.3, color: "#065f46" }}>
                {name.arabic}
              </p>
            )}
            <p style={{ fontSize: 20, color: "#64748b", fontFamily: "system-ui, sans-serif" }}>{name.english}</p>
          </div>
        )}
      </div>

      {/* Centered du'a */}
      <div className="flex-1 flex items-center justify-center px-16 overflow-hidden">
        <p
          className="font-calligraphy whitespace-pre-wrap text-center"
          style={{ fontSize: duaFontSize(personalDua), lineHeight: 1.6, color: "#1e293b" }}
        >
          {personalDua}
        </p>
      </div>

      {/* Bottom bar */}
      <div className="flex items-end justify-between px-14 pb-10">
        <p
          className="font-github"
          style={{ fontSize: 18, color: "#94a3b8", maxWidth: 760 }}
        >
          {hadithSources.slice(0, 4).join("  ·  ")}
        </p>
        <span className="font-github" style={{ fontSize: 22, color: "#059669", fontWeight: 600 }}>
          duaos.com
        </span>
      </div>
    </div>
  );
}
