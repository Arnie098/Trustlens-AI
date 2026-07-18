/**
 * Perplexity Sonar — web-grounded media literacy analysis.
 * Server-only: uses PERPLEXITY_API_KEY (never expose to the browser).
 *
 * Why Perplexity: built-in live web search + citations match TrustLens
 * "signals with evidence" better than a plain offline LLM.
 */
import {
  categoryFor,
  type AnalysisInput,
  type AnalysisResult,
  type ReplayNode,
  type TrustCategory,
} from "./types";
import { filterCitationUrls } from "@/lib/evidence";
import { sanitizeAnalysisProse, sanitizeStringList } from "./sanitize-text";

const PERPLEXITY_URL = "https://api.perplexity.ai/chat/completions";

/** Prefer sonar-pro for research-grade verification; override via env. */
function modelName(): string {
  return process.env.PERPLEXITY_MODEL || "sonar-pro";
}

export function hasPerplexityKey(): boolean {
  return Boolean(process.env.PERPLEXITY_API_KEY?.trim());
}

export const SYSTEM_PROMPT = `You are TrustLensAI, a media and information literacy assistant.
You do NOT declare absolute truth. You surface signals, evidence, and concerns so people can decide carefully.

Analyze the user's content (URL, text claim, or image description) using web search where useful.
Return ONLY a single JSON object (no markdown fences, no prose outside JSON) with this exact shape:
{
  "trust_score": <integer 0-100>,
  "category": <"high_trust"|"needs_verification"|"low_confidence"|"potentially_misleading">,
  "confidence": <number 0-100, one decimal ok>,
  "summary": <string, 1-3 sentences, hedged language>,
  "source_assessment": <string about publisher/author/domain credibility>,
  "context_analysis": <string about framing, missing context, tone, citations>,
  "ai_generated_detected": <boolean>,
  "concerns": <string array, 0-5 items>,
  "evidence": <string array, 0-5 items of supporting signals or citations>,
  "next_steps": <string array, 2-4 practical verification actions>,
  "replay_data": <array of 3-5 nodes: {id, label, platform, timestamp, reach, warning, connections}>
}

Scoring guide (signals, not verdicts):
- 80-100 high_trust: established outlets, clear sourcing, consistent with reputable reporting
- 60-79 needs_verification: mixed signals or incomplete sourcing
- 40-59 low_confidence: weak provenance, emotional framing, sparse evidence
- 0-39 potentially_misleading: strong clickbait/conspiracy patterns, contradicted by reliable sources

Always encourage independent verification. Prefer citing what you found on the open web.`;

export function buildUserPrompt(input: AnalysisInput): string {
  if (input.type === "url" && input.url) {
    return `Verify this URL for media-literacy signals (origin, reputation, claim quality, missing context):\n${input.url}`;
  }
  if (input.type === "text" && input.text) {
    return `Verify this claim or excerpt for media-literacy signals:\n"""\n${input.text.slice(0, 6000)}\n"""`;
  }
  // Image path: when we can send the actual image (imageUrl), instruct real visual inspection.
  if (input.imageUrl) {
    const caption = input.text?.trim()
      ? `\nText extracted from the image (OCR — may contain errors):\n"""\n${input.text.slice(0, 4000)}\n"""`
      : "";
    return `Analyze the attached image for media-literacy and authenticity signals. Inspect the image itself for signs of AI generation, editing/compositing, or misleading framing, and assess any claims it makes.${caption}`;
  }
  return `Analyze this image submission for media-literacy / authenticity signals. Filename or label: ${input.imageName || "uploaded image"}. Note limitations if you cannot see the binary image; use web knowledge about common AI-image and manipulation cues and reverse-image practice.`;
}

type PerplexityContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

/** User message content: multimodal parts when an image URL is available, else a plain string. */
export function buildUserContent(input: AnalysisInput): string | PerplexityContentPart[] {
  const prompt = buildUserPrompt(input);
  if (input.type === "image" && input.imageUrl) {
    return [
      { type: "text", text: prompt },
      { type: "image_url", image_url: { url: input.imageUrl } },
    ];
  }
  return prompt;
}

function defaultReplay(input: AnalysisInput, category: TrustCategory): ReplayNode[] {
  let origin = "Original source";
  try {
    if (input.url) origin = new URL(input.url).hostname;
  } catch {
    /* ignore */
  }
  const warning = category === "potentially_misleading" || category === "low_confidence";
  return [
    {
      id: "origin",
      label: origin,
      platform: input.type === "url" ? "Web" : input.type === "text" ? "Text" : "Image",
      timestamp: "T+0h",
      reach: 1,
      warning,
      connections: ["amp-1", "amp-2"],
    },
    {
      id: "amp-1",
      label: "Social share",
      platform: "X / Twitter",
      timestamp: "T+2h",
      reach: 2500,
      warning: false,
      connections: ["amp-3"],
    },
    {
      id: "amp-2",
      label: "Aggregator repost",
      platform: "Reddit",
      timestamp: "T+4h",
      reach: 8000,
      warning: category !== "high_trust",
      connections: ["amp-3"],
    },
    {
      id: "amp-3",
      label: "Viral thread",
      platform: "Facebook",
      timestamp: "T+9h",
      reach: 32000,
      warning: category === "potentially_misleading",
      connections: [],
    },
  ];
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* try fence */
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    return JSON.parse(fence[1].trim());
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error("Perplexity response was not valid JSON");
}

function asStringArray(v: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(v)) return fallback;
  return v.map((x) => String(x)).filter(Boolean).slice(0, 8);
}

function normalizeReplay(raw: unknown, input: AnalysisInput, category: TrustCategory): ReplayNode[] {
  if (!Array.isArray(raw) || !raw.length) return defaultReplay(input, category);
  return raw.slice(0, 8).map((n, i) => {
    const node = n as Record<string, unknown>;
    return {
      id: String(node.id ?? `n-${i}`),
      label: String(node.label ?? "Node"),
      platform: String(node.platform ?? "Web"),
      timestamp: String(node.timestamp ?? `T+${i}h`),
      reach: Number(node.reach) || 0,
      warning: Boolean(node.warning),
      connections: Array.isArray(node.connections)
        ? node.connections.map(String)
        : [],
    };
  });
}

/** If the model nested a full analysis JSON string in one field, hoist fields up. */
function unwrapNestedAnalysis(raw: Record<string, unknown>): Record<string, unknown> {
  let obj = { ...raw };

  // Sometimes the whole payload is double-wrapped under a string field
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (!t.startsWith("{") || !t.includes("trust_score")) continue;
    try {
      const inner = JSON.parse(t) as Record<string, unknown>;
      if (inner && typeof inner === "object" && !Array.isArray(inner)) {
        // Prefer outer non-JSON fields, fill from inner
        obj = { ...inner, ...obj };
        // Replace the bad string field with the inner prose equivalent when present
        if (typeof inner[key] === "string") obj[key] = inner[key];
        else if (key === "context_analysis" && typeof inner.context_analysis === "string") {
          obj.context_analysis = inner.context_analysis;
        }
      }
    } catch {
      /* keep original */
    }
  }

  // If context_analysis is itself the full blob, pull prose out
  for (const key of ["summary", "source_assessment", "context_analysis"] as const) {
    if (typeof obj[key] === "string") {
      obj[key] = sanitizeAnalysisProse(obj[key] as string, key);
    }
  }

  return obj;
}

export function normalizeResult(
  raw: Record<string, unknown>,
  input: AnalysisInput,
  citations: string[],
  provider: AnalysisResult["provider"] = "perplexity",
): AnalysisResult {
  const data = unwrapNestedAnalysis(raw);

  let score = Math.round(Number(data.trust_score));
  if (!Number.isFinite(score)) score = 50;
  score = Math.min(100, Math.max(0, score));

  const allowed: TrustCategory[] = [
    "high_trust",
    "needs_verification",
    "low_confidence",
    "potentially_misleading",
  ];
  let category = data.category as TrustCategory;
  if (!allowed.includes(category)) category = categoryFor(score);

  let confidence = Number(data.confidence);
  if (!Number.isFinite(confidence)) confidence = 70;
  confidence = Math.min(100, Math.max(0, Math.round(confidence * 10) / 10));

  let evidence = asStringArray(data.evidence);
  if (!evidence.length) evidence = sanitizeStringList(data.evidence);
  // Fold high-quality Perplexity web citations when sparse (skip images / junk hosts)
  if (citations.length && evidence.length < 3) {
    for (const c of filterCitationUrls(citations, 3)) {
      if (!evidence.some((e) => e.includes(c))) evidence.push(`Citation: ${c}`);
    }
  }

  let concerns = asStringArray(data.concerns);
  if (!concerns.length) concerns = sanitizeStringList(data.concerns);

  let next_steps = asStringArray(data.next_steps);
  if (!next_steps.length) {
    next_steps = sanitizeStringList(data.next_steps);
  }
  if (!next_steps.length) {
    next_steps = [
      "Cross-check the claim with two independent, credible sources",
      "Search the exact quote to find original context",
      "Pause before sharing if anything feels uncertain",
    ];
  }

  return {
    trust_score: score,
    category,
    confidence,
    summary: sanitizeAnalysisProse(
      String(
        data.summary ||
          "Automated web-grounded analysis completed. Verify with independent sources before sharing.",
      ),
      "summary",
    ),
    source_assessment: sanitizeAnalysisProse(
      String(
        data.source_assessment ||
          "Source assessment incomplete; check the original publisher.",
      ),
      "source_assessment",
    ),
    context_analysis: sanitizeAnalysisProse(
      String(
        data.context_analysis ||
          "Context review was limited. Look for missing dates, authors, and primary sources.",
      ),
      "context_analysis",
    ),
    ai_generated_detected: Boolean(data.ai_generated_detected),
    concerns,
    evidence,
    next_steps,
    replay_data: normalizeReplay(data.replay_data, input, category),
    provider,
    citations,
  };
}

export async function perplexityAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not set");
  }

  const body = {
    model: modelName(),
    temperature: 0.2,
    max_tokens: 2048,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(input) },
    ],
  };

  const res = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Perplexity API ${res.status}: ${errText.slice(0, 400) || res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    citations?: string[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from Perplexity");

  const parsed = extractJson(content) as Record<string, unknown>;
  const citations = Array.isArray(data.citations) ? data.citations.map(String) : [];
  return normalizeResult(parsed, input, citations);
}
