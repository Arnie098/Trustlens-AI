import type { TrustCategory } from "@/lib/db";

export type { TrustCategory };

export interface AnalysisInput {
  type: "url" | "text" | "image";
  url?: string;
  text?: string;
  imageName?: string;
  /** Fetchable image URL (e.g. signed Supabase URL / POST /api/uploads). */
  imageUrl?: string;
  /**
   * Raw image bytes as base64 (or data:image/...;base64,...) for direct Claude vision.
   * Preferred for mobile screenshots — skips remote fetch.
   */
  imageBase64?: string;
  /** MIME type when using imageBase64 (default image/jpeg). */
  imageMediaType?: string;
}

/** Which code path produced this result (actual run, not just env config). */
export type AnalysisEnginePath =
  | "perplexity_vision"
  | "claude_vision"
  | "claude_vision_perplexity"
  | "screenshot_ocr_free"
  | "screenshot_ocr_cookie"
  | "screenshot_ocr_deepseek"
  | "screenshot_ocr_mock"
  | "text_free_hybrid"
  | "text_deepseek"
  | "text_cookie"
  | "text_perplexity"
  | "mock";

export interface AnalysisResult {
  trust_score: number;
  category: TrustCategory;
  confidence: number;
  summary: string;
  source_assessment: string;
  context_analysis: string;
  ai_generated_detected: boolean;
  concerns: string[];
  evidence: string[];
  next_steps: string[];
  replay_data: ReplayNode[];
  /** Public engine label only — never expose internal transport details */
  provider?: "perplexity" | "mock" | "claude";
  /** Actual path used for THIS request */
  engine_path?: AnalysisEnginePath;
  /** Optional detail (model id, failure reason) for debugging */
  engine_detail?: string;
  citations?: string[];
}

export interface ReplayNode {
  id: string;
  label: string;
  platform: string;
  timestamp: string;
  reach: number;
  warning: boolean;
  connections: string[];
}

export function categoryFor(score: number): TrustCategory {
  if (score >= 80) return "high_trust";
  if (score >= 60) return "needs_verification";
  if (score >= 40) return "low_confidence";
  return "potentially_misleading";
}

export const trustLabel = (c: TrustCategory) =>
  ({
    high_trust: "High Trust",
    needs_verification: "Needs Verification",
    low_confidence: "Low Confidence",
    potentially_misleading: "Potentially Misleading",
  })[c];

export const trustColorVar = (c: TrustCategory) =>
  ({
    high_trust: "var(--trust-high)",
    needs_verification: "var(--trust-medium)",
    low_confidence: "var(--trust-low)",
    potentially_misleading: "var(--trust-danger)",
  })[c];
