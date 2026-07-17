import { useEffect, useRef, useState } from "react";
import type { TrustCategory } from "@/lib/db";
import { trustColorVar, trustLabel } from "@/lib/ai/mock-analyze";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function TrustGauge({
  score,
  category,
  size = 220,
  animate = false,
}: {
  score: number;
  category: TrustCategory;
  size?: number;
  animate?: boolean;
}) {
  const stroke = Math.max(10, Math.round(size * 0.07));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduced = usePrefersReducedMotion();

  const [display, setDisplay] = useState(animate && !reduced ? 0 : score);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate || reduced) {
      setDisplay(score);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (score - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, reduced, score]);

  const pct = Math.max(0, Math.min(100, display)) / 100;
  const dash = c * pct;
  const color = trustColorVar(category);

  // Scale center typography with gauge diameter so size={140} doesn't clip
  const scorePx = Math.max(22, Math.round(size * 0.22));
  const labelPx = Math.max(9, Math.round(size * 0.055));
  const badgePx = Math.max(9, Math.round(size * 0.055));
  const badgePadX = Math.max(8, Math.round(size * 0.05));
  const showBadge = size >= 120;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="var(--muted)"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 300ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <div
          className="font-black tabular-nums leading-none"
          style={{ color, fontSize: scorePx }}
        >
          {display}
        </div>
        <div
          className="mt-1 font-medium uppercase tracking-wider text-muted-foreground"
          style={{ fontSize: labelPx }}
        >
          TrustScore
        </div>
        {showBadge && (
          <div
            className="mt-1.5 max-w-[90%] truncate rounded-full font-semibold leading-tight"
            style={{
              background: `color-mix(in oklab, ${color} 15%, transparent)`,
              color,
              fontSize: badgePx,
              padding: `0.2em ${badgePadX}px`,
            }}
          >
            {trustLabel(category)}
          </div>
        )}
      </div>
    </div>
  );
}
