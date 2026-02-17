"use client";

const BG_IMAGE = "/mario-la-pergola-myy2_CazPR8-unsplash.jpg";

export default function RamadanBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#020617]">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BG_IMAGE})` }}
      />
      <div className="absolute inset-0 bg-[#020617]/70 pointer-events-none" />

      {/* Diagonal diamond grid (two crossing line sets) with glowing lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(135deg, transparent 0%, transparent calc(50% - 4px), rgba(255,255,255,0.02) calc(50% - 2px), rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) calc(50% + 2px), transparent calc(50% + 4px), transparent 100%),
            linear-gradient(-135deg, transparent 0%, transparent calc(50% - 4px), rgba(255,255,255,0.02) calc(50% - 2px), rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) calc(50% + 2px), transparent calc(50% + 4px), transparent 100%)
          `,
          backgroundSize: "40px 40px, 40px 40px",
          boxShadow: "inset 0 0 140px rgba(255,255,255,0.03)",
        }}
      />

      {/* Grain & Vignette */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>'
          )}")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020617]/80 pointer-events-none" />
    </div>
  );
}
