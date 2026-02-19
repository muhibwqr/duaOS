"use client";

/**
 * Simple 1080×1920 card for share/download. Minimal: solid background, du'a text, watermark.
 */

type DuaShareCardProps = {
  nameOfAllah?: string;
  refinedDua: string;
  verifiedSource?: string;
};

export function DuaShareCard({
  nameOfAllah,
  refinedDua,
  verifiedSource,
}: DuaShareCardProps) {
  return (
    <div
      className="relative flex flex-col text-slate-100 rounded-lg overflow-hidden"
      style={{
        width: 1080,
        height: 1920,
        background: "#0f172a",
      }}
    >
      <div className="relative flex-1 flex flex-col justify-center px-16 py-20">
        {nameOfAllah && (
          <p
            className="text-3xl font-medium mb-5 text-emerald-200/95"
            style={{ fontFamily: '"EB Garamond", serif' }}
          >
            {nameOfAllah}
          </p>
        )}
        <p
          className="text-2xl leading-relaxed whitespace-pre-wrap text-slate-100"
          style={{ fontFamily: '"EB Garamond", serif' }}
        >
          {refinedDua}
        </p>
        {verifiedSource && (
          <p
            className="mt-6 text-lg text-slate-500"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            — {verifiedSource}
          </p>
        )}
      </div>

      <div
        className="relative py-5 text-center text-slate-500 text-base border-t border-slate-600/50"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        duaos.com
      </div>
    </div>
  );
}
