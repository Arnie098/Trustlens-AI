export type TrustCategory =
  | "high_trust"
  | "needs_verification"
  | "low_confidence"
  | "potentially_misleading";

export interface AnalysisInput {
  type: "url" | "text" | "image";
  url?: string;
  text?: string;
  imageName?: string;
}

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
  provider?: "perplexity" | "mock";
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
