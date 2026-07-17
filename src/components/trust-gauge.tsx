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
  const stroke = 16;
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

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-black tabular-nums" style={{ color }}>
          {display}
        </div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          TrustScore
        </div>
        <div
          className="mt-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
        >
          {trustLabel(category)}
        </div>
      </div>
    </div>
  );
}
