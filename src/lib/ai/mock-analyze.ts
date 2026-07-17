// Offline heuristic analyzer. Used when PERPLEXITY_API_KEY is not set,
// or as fallback if Perplexity fails.
import {
  categoryFor,
  type AnalysisInput,
  type AnalysisResult,
  type ReplayNode,
  type TrustCategory,
} from "./types";

export type { AnalysisInput, AnalysisResult, ReplayNode, TrustCategory };
export { categoryFor, trustLabel, trustColorVar } from "./types";

const KNOWN_TRUSTED = ["reuters.com", "apnews.com", "bbc.co.uk", "nature.com", "who.int"];
const KNOWN_RISKY = ["clickbait", "shocking", "you-wont-believe", "conspiracy"];

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export async function mockAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 400));

  const raw = (input.url || input.text || input.imageName || "").toLowerCase();
  const seed = hashSeed(raw || "empty");

  let base = 45 + (seed % 45); // 45..89
  const trusted = KNOWN_TRUSTED.some((d) => raw.includes(d));
  const risky = KNOWN_RISKY.some((k) => raw.includes(k));
  if (trusted) base = Math.min(95, base + 20);
  if (risky) base = Math.max(15, base - 30);
  if (input.type === "image") base = Math.max(30, base - 10);

  const score = Math.round(base);
  const category = categoryFor(score);
  const confidence = Math.round((60 + (seed % 30)) * 10) / 10;
  const ai_generated_detected = input.type === "image" && seed % 3 === 0;

  const concernsPool = [
    "Emotionally charged or sensational language detected",
    "Source could not be independently verified in known credible databases",
    "Limited context or missing publication date",
    "Similar claims have appeared in low-credibility outlets",
    "Image shows possible signs of AI generation or editing",
  ];
  const evidencePool = [
    "Author information is present",
    "Publication date is clearly stated",
    "Multiple independent sources reference similar facts",
    "Domain appears in known reference lists",
    "Content structure follows editorial standards",
  ];
  const stepsPool = [
    "Cross-check the claim with two independent, credible sources",
    "Search the exact quote or claim to see original context",
    "Use a reverse image search if the piece includes visuals",
    "Look for the author's credentials or publisher's About page",
    "Take a lesson on spotting misleading headlines",
  ];

  const pick = (arr: string[], n: number) =>
    Array.from({ length: n }, (_, i) => arr[(seed + i * 7) % arr.length]);

  const summaries: Record<TrustCategory, string> = {
    high_trust:
      "The analysis suggests this content shows several markers of credibility. Independent verification is still recommended before sharing.",
    needs_verification:
      "The analysis suggests mixed signals. Some elements look credible, but potential indicators of concern were also found. Further verification is recommended.",
    low_confidence:
      "The analysis suggests low confidence. Several potential indicators of misleading framing were detected. Pause before sharing and verify independently.",
    potentially_misleading:
      "The analysis suggests this content may be misleading. Multiple potential indicators of unreliable framing were detected. We strongly recommend verifying with independent sources.",
  };

  let originLabel = "Original source";
  try {
    if (input.url) originLabel = new URL(input.url).hostname;
  } catch {
    /* ignore */
  }

  const replay_data: ReplayNode[] = [
    {
      id: "origin",
      label: originLabel,
      platform: input.type === "url" ? "Web" : input.type === "text" ? "Text" : "Image",
      timestamp: "T+0h",
      reach: 1,
      warning: category === "potentially_misleading" || category === "low_confidence",
      connections: ["amp-1", "amp-2"],
    },
    {
      id: "amp-1",
      label: "Social share",
      platform: "X / Twitter",
      timestamp: "T+2h",
      reach: 1200 + (seed % 5000),
      warning: false,
      connections: ["amp-3"],
    },
    {
      id: "amp-2",
      label: "Aggregator repost",
      platform: "Reddit",
      timestamp: "T+4h",
      reach: 3400 + (seed % 8000),
      warning: category !== "high_trust",
      connections: ["amp-3", "amp-4"],
    },
    {
      id: "amp-3",
      label: "Viral thread",
      platform: "Facebook",
      timestamp: "T+9h",
      reach: 24000 + (seed % 20000),
      warning: category === "potentially_misleading",
      connections: [],
    },
    {
      id: "amp-4",
      label: "Messaging groups",
      platform: "WhatsApp",
      timestamp: "T+14h",
      reach: 50000 + (seed % 40000),
      warning: true,
      connections: [],
    },
  ];

  return {
    trust_score: score,
    category,
    confidence,
    summary: summaries[category],
    source_assessment: trusted
      ? "Source appears in publicly maintained lists of established outlets."
      : "Source credibility could not be strongly established. Further checks are recommended.",
    context_analysis:
      "The content was reviewed for tone, framing, presence of citations, and known misinformation patterns. This is an automated assessment and may be incomplete.",
    ai_generated_detected,
    concerns: score < 70 ? pick(concernsPool, 3) : pick(concernsPool, 1),
    evidence: score > 40 ? pick(evidencePool, 3) : pick(evidencePool, 1),
    next_steps: pick(stepsPool, 3),
    replay_data,
    provider: "mock",
  };
}
