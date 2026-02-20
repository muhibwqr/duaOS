"use client";

/**
 * Square 1080×1080 card for share/download: personal du'a, hadith sources list, duaos.com bottom right.
 */

type DuaShareCardProps = {
  personalDua: string;
  hadithSources: string[];
};

export function DuaShareCard({ personalDua, hadithSources }: DuaShareCardProps) {
  return (
    <div
      className="relative flex flex-col text-slate-800 rounded-lg overflow-hidden"
      style={{
        width: 1080,
        height: 1080,
        background: "#f8fafc",
      }}
    >
      <div className="relative flex-1 flex flex-col px-14 py-14 overflow-hidden">
        <p
          className="text-2xl leading-relaxed whitespace-pre-wrap text-slate-800 flex-1"
          style={{ fontFamily: '"EB Garamond", serif' }}
        >
          {personalDua}
        </p>
        {hadithSources.length > 0 && (
          <div
            className="mt-6 text-slate-600 text-lg"
            style={{ fontFamily: "system-ui, sans-serif" }}
          >
            <p className="text-emerald-600 text-base mb-2 font-medium">Relevant hadith sources:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-700">
              {hadithSources.map((src, i) => (
                <li key={i}>{src}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        className="absolute bottom-6 right-6 text-emerald-600 text-base font-medium"
        style={{ fontFamily: "system-ui, sans-serif" }}
      >
        duaos.com
      </div>
    </div>
  );
}
