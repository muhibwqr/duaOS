import { ImageResponse } from "next/og";
import { decodeSharePayload } from "@/lib/share-codec";
import { buildSharePreview, parseNameContent } from "@/lib/share-preview";

export const runtime = "edge";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
};

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function fontSize(count: number): number {
  if (count <= 1) return 40;
  if (count === 2) return 32;
  return 26;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("c");
  const payload = code ? await decodeSharePayload(code).catch(() => null) : null;

  if (!payload || payload.kind === "request") {
    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            background: "#faf7f2",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: 12, background: "linear-gradient(90deg, #059669, #34d399, #059669)" }} />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 80 }}>
            <p style={{ fontSize: 54, color: "#1e293b", textAlign: "center" }}>
              du&apos;aOS — Bring your intention to Allah
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 60px 40px" }}>
            <span style={{ fontSize: 28, color: "#059669", fontWeight: 600 }}>duaos.com</span>
          </div>
        </div>
      ),
      { width: 1200, height: 630, headers: CACHE_HEADERS }
    );
  }

  const preview = buildSharePreview(payload);
  const size = fontSize(preview.lines.length);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#faf7f2",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ height: 12, background: "linear-gradient(90deg, #059669, #34d399, #059669)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", padding: "36px 60px 0" }}>
          <span style={{ fontSize: 24, color: "#64748b", letterSpacing: "0.08em" }}>du&apos;aOS</span>
          <span style={{ fontSize: 22, color: "#94a3b8" }}>{preview.title.replace(/ · du'aOS$/, "")}</span>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 28,
            padding: "0 80px",
          }}
        >
          {preview.lines.map((line, i) => {
            const name = line.name ? parseNameContent(line.name) : null;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 24 }}>
                  <p style={{ fontSize: size, color: "#1e293b", lineHeight: 1.5, flex: 1 }}>
                    {truncate(line.dua.trim(), 140)}
                  </p>
                  {name?.arabic ? (
                    <span style={{ fontSize: 26, color: "#065f46", flexShrink: 0 }}>{name.arabic}</span>
                  ) : null}
                </div>
                {name?.english ? (
                  <span style={{ fontSize: 18, color: "#059669", marginTop: 4 }}>{name.english}</span>
                ) : null}
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 60px 40px" }}>
          <span style={{ fontSize: 28, color: "#059669", fontWeight: 600 }}>duaos.com</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: CACHE_HEADERS }
  );
}
