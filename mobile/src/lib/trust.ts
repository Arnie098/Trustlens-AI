import type { TrustCategory } from "./types/analysis";

export function categoryFor(score: number): TrustCategory {
  if (score >= 80) return "high_trust";
  if (score >= 60) return "needs_verification";
  if (score >= 40) return "low_confidence";
  return "potentially_misleading";
}

/** Normalize confidence to 0–100 for display (API uses 0–100; some clients used 0–1). */
export function confidencePercent(confidence: number | null | undefined): number {
  const n = Number(confidence ?? 0);
  if (!Number.isFinite(n)) return 0;
  const pct = n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

export const trustLabel = (c: TrustCategory) =>
  ({
    high_trust: "High Trust",
    needs_verification: "Needs Verification",
    low_confidence: "Low Confidence",
    potentially_misleading: "Potentially Misleading",
  })[c];
