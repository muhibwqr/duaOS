"use client";

import { motion } from "framer-motion";

/** Single central khatim – concentric rings like the sample, slow rotation, fade out. */
const SIZE = 580;
const CX = 0;
const CY = 0;

const ROYAL_BLUE = "#1e40af";
const MAROON = "#7c2d12";
const GREEN = "#14532d";
const BRASS = "#C9A227";
const WHITE = "rgba(255,255,255,0.9)";
const OUTLINE = "rgba(0,0,0,0.5)";

function getStarPath(cx: number, cy: number, outerR: number, innerR: number, points = 8): string {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < points; i++) {
    const angle = (i * (2 * Math.PI)) / points - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
}

/** Scalloped (lobed) circle path – like the sample’s outer edge. */
function getScallopedPath(cx: number, cy: number, baseR: number, lobes: number, amplitude: number): string {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= lobes; i++) {
    const angle = (i * (2 * Math.PI)) / lobes - Math.PI / 2;
    const r = baseR + amplitude * Math.cos(lobes * angle);
    pts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }
  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
}

/** Small 4-pointed star for "blue star" ring. */
function getSmallStarPath(cx: number, cy: number, r: number): string {
  return getStarPath(cx, cy, r, r * 0.4, 4);
}

export function IslamicStarLattice() {
  const star8 = getStarPath(CX, CY, 165, 60, 8);
  const star16 = getStarPath(CX, CY, 215, 95, 16);
  const star16Outer = getStarPath(CX, CY, 280, 125, 16);
  const scalloped = getScallopedPath(CX, CY, 310, 24, 28);

  const numSmallStars = 16;
  const smallStarR = 195;
  const smallStarSize = 8;

  return (
    <motion.div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden flex items-center justify-center"
      aria-hidden
      initial={false}
      animate={{ opacity: [0.65, 0.82, 0.65] }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      style={{
        maskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 0%, black 28%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse 85% 85% at 50% 50%, black 0%, black 28%, transparent 75%)",
      }}
    >
      <motion.div
        className="flex items-center justify-center"
        animate={{ rotate: 360 }}
        transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
      >
        <svg
          className="w-[min(100vmax,180vw)] h-[min(100vmax,180vw)] opacity-[0.6] shrink-0"
          viewBox={`${-SIZE} ${-SIZE} ${SIZE * 2} ${SIZE * 2}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            filter: "drop-shadow(0 0 4px rgba(30,64,175,0.35)) drop-shadow(0 0 12px rgba(201,162,39,0.25))",
          }}
        >
          {/* Scalloped outer (blue) – like sample’s lobed edge */}
          <path
            d={scalloped}
            fill="none"
            stroke={ROYAL_BLUE}
            strokeWidth={2.2}
            opacity={0.7}
          />
          {/* Outer 16-pointed star */}
          <path d={star16Outer} fill="none" stroke={ROYAL_BLUE} strokeWidth={1.8} opacity={0.45} />
          {/* Blue band ring (background for white stars) */}
          <circle cx={CX} cy={CY} r={210} fill="none" stroke={ROYAL_BLUE} strokeWidth={28} opacity={0.75} />
          <circle cx={CX} cy={CY} r={210} fill="none" stroke={OUTLINE} strokeWidth={1} />
          {/* White 4-pointed stars on blue ring */}
          {Array.from({ length: numSmallStars }).map((_, i) => {
            const a = (i * 2 * Math.PI) / numSmallStars - Math.PI / 2;
            const sx = CX + smallStarR * Math.cos(a);
            const sy = CY + smallStarR * Math.sin(a);
            return (
              <path
                key={i}
                d={getSmallStarPath(sx, sy, smallStarSize)}
                fill={WHITE}
                stroke={OUTLINE}
                strokeWidth={0.6}
                opacity={0.95}
              />
            );
          })}
          {/* Maroon ring (floral band suggestion) */}
          <circle cx={CX} cy={CY} r={155} fill="none" stroke={MAROON} strokeWidth={22} opacity={0.8} />
          <circle cx={CX} cy={CY} r={155} fill="none" stroke={OUTLINE} strokeWidth={1} />
          {/* Middle 16-pointed star */}
          <path d={star16} fill="none" stroke={ROYAL_BLUE} strokeWidth={2} opacity={0.65} />
          {/* Main 8-pointed khatim */}
          <path d={star8} fill="none" stroke={ROYAL_BLUE} strokeWidth={2.5} />
          {/* White ring */}
          <circle cx={CX} cy={CY} r={38} fill="none" stroke={WHITE} strokeWidth={4} opacity={0.95} />
          <circle cx={CX} cy={CY} r={38} fill="none" stroke={OUTLINE} strokeWidth={1} />
          {/* Geometric brown chain ring */}
          <circle cx={CX} cy={CY} r={30} fill="none" stroke={MAROON} strokeWidth={6} opacity={0.9} />
          <circle cx={CX} cy={CY} r={30} fill="none" stroke={OUTLINE} strokeWidth={1} />
          {/* Green inner circle (around center motif) */}
          <circle cx={CX} cy={CY} r={24} fill={GREEN} opacity={0.85} />
          <circle cx={CX} cy={CY} r={24} fill="none" stroke={OUTLINE} strokeWidth={1} />
          {/* Central brass dot */}
          <circle cx={CX} cy={CY} r={10} fill={BRASS} />
          <circle cx={CX} cy={CY} r={10} fill="none" stroke={OUTLINE} strokeWidth={0.8} />
        </svg>
      </motion.div>
    </motion.div>
  );
}
