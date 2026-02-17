"use client";

import { motion, useMotionValue, useSpring, useMotionTemplate } from "framer-motion";
import { useEffect, useMemo } from "react";

const CX = 50;
const CY = 50;
const OUTER_R = 44;
const INNER_R = 18;

/** 8-pointed star (Khatam): two squares at 45°. Alternating outer/inner radii. */
function khatamPath(): string {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const deg = i * 45 - 90;
    const rad = (deg * Math.PI) / 180;
    const r = i % 2 === 0 ? OUTER_R : INNER_R;
    points.push({
      x: CX + r * Math.cos(rad),
      y: CY + r * Math.sin(rad),
    });
  }
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ") + " Z";
}

const STROKE_WATERMARK = "rgba(255, 255, 255, 0.5)";

export function IslamicGeometricLattice() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 45, damping: 28 });
  const springY = useSpring(mouseY, { stiffness: 45, damping: 28 });

  const pathD = useMemo(() => khatamPath(), []);

  const followMouseGlow = useMotionTemplate`radial-gradient(circle 300px at ${springX}px ${springY}px, rgba(255,255,255,0.15) 0%, transparent 70%)`;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mouseX, mouseY]);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Base: deep navy–black */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, #080d16 0%, #0f172a 40%, #0a0f1a 100%)" }}
      />

      {/* Dynamic radial mesh: emerald top-left, gold bottom-right */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 90% 90% at 15% 15%, rgba(6,78,59,0.10) 0%, transparent 55%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 85% at 88% 88%, rgba(69,26,3,0.10) 0%, transparent 55%)",
          }}
        />
      </div>

      {/* Single large Khatam: bottom-right, 40% opacity, ultra-thin, drifting 20px over 60s */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          right: "-8%",
          bottom: "-12%",
          width: "min(72vw, 72vh)",
          height: "min(72vw, 72vh)",
        }}
        animate={{
          x: [0, 10, 0],
          y: [0, 10, 0],
        }}
        transition={{
          duration: 60,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: 0.4 }}
        >
          <path
            d={pathD}
            fill="none"
            stroke={STROKE_WATERMARK}
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </motion.div>

      {/* Follow-mouse glow: 300px radial, 0.15 opacity, reveals geometry under cursor */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: followMouseGlow,
          mixBlendMode: "screen",
        }}
      />

      {/* Noise grain overlay: premium paper/stone texture, opacity 0.02 */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ opacity: 0.02 }}
        aria-hidden
      >
        <defs>
          <filter id="noise-grain" x="0" y="0">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="4"
              stitchTiles="stitch"
              result="noise"
            />
            <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
          </filter>
        </defs>
        <rect width="100%" height="100%" filter="url(#noise-grain)" fill="transparent" />
      </svg>
    </div>
  );
}
