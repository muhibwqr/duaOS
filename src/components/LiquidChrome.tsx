"use client";

/**
 * Liquid chrome–style animated background (CSS-based).
 */
export function LiquidChrome({
  speed = 0.2,
  amplitude = 0.3,
  frequencyX = 3,
  frequencyY = 3,
  interactive = false,
  className = "",
  style = {},
}: {
  speed?: number;
  amplitude?: number;
  frequencyX?: number;
  frequencyY?: number;
  interactive?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const duration = Math.max(6, 16 - speed * 30);
  return (
    <div
      className={`fixed inset-0 z-0 overflow-hidden pointer-events-none ${className}`}
      style={{
        background: `
          radial-gradient(ellipse 80% 80% at 20% 20%, rgba(30,41,59,0.4) 0%, transparent 50%),
          radial-gradient(ellipse 60% 60% at 80% 80%, rgba(15,23,42,0.5) 0%, transparent 50%),
          radial-gradient(ellipse 70% 70% at 50% 50%, rgba(15,23,42,0.3) 0%, transparent 55%),
          linear-gradient(135deg, #0a0f1a 0%, #0f172a 25%, #0c1324 50%, #0f172a 75%, #080d16 100%)
        `,
        backgroundSize: `${120 + amplitude * 40}% ${120 + amplitude * 40}%`,
        animation: `liquidChrome ${duration}s ease-in-out infinite`,
        ...style,
      }}
      aria-hidden
    />
  );
}
