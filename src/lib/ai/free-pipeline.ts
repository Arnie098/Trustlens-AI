/**
 * Hackathon free pipeline: DeepSeek (API key) + Perplexity website cookies.
 * No paid Perplexity API required.
 */
import type { AnalysisInput, AnalysisResult } from "./types";
import { deepseekAnalyze, formatDraftForPerplexitySearch, hasDeepSeekKey } from "./deepseek";
import { hasPerplexityCookies, perplexityCookieAnalyze } from "./perplexity-cookie";
import { filterCitationUrls } from "@/lib/evidence";

export function canUseFreeDeepSeekPerplexityPipeline(): boolean {
  return hasDeepSeekKey() && hasPerplexityCookies();
}

function mergeDraftAndGrounded(
  draft: AnalysisResult,
  grounded: AnalysisResult,
): AnalysisResult {
  // Prefer web-grounded fields from cookie Perplexity; keep draft where grounded is empty.
  const evidence =
    grounded.evidence?.length >= 2
      ? grounded.evidence
      : [...(grounded.evidence || []), ...(draft.evidence || [])].slice(0, 6);

  const citations = filterCitationUrls(
    [...(grounded.citations || []), ...(draft.citations || [])],
    8,
  );

  return {
    ...draft,
    ...grounded,
    // Grounded score wins if cookie returned something coherent
    trust_score: grounded.trust_score ?? draft.trust_score,
    category: grounded.category ?? draft.category,
    confidence: Math.max(draft.confidence ?? 0, grounded.confidence ?? 0),
    summary: grounded.summary?.trim() || draft.summary,
    source_assessment: grounded.source_assessment?.trim() || draft.source_assessment,
    context_analysis: grounded.context_analysis?.trim() || draft.context_analysis,
    concerns:
      grounded.concerns?.length > 0 ? grounded.concerns : draft.concerns,
    evidence,
    next_steps:
      grounded.next_steps?.length > 0 ? grounded.next_steps : draft.next_steps,
    citations,
    provider: "perplexity",
  };
}

/**
 * 1) DeepSeek structures / reasons (free API key tier)
 * 2) Perplexity cookie session searches the web for corroboration
 * 3) Merge into one TrustLens result
 */
export async function deepseekThenPerplexityCookie(
  input: AnalysisInput,
): Promise<AnalysisResult> {
  const draft = await deepseekAnalyze(input);

  if (!hasPerplexityCookies()) {
    return {
      ...draft,
      summary: `${draft.summary} (Analysis used DeepSeek only — live web session not available.)`,
      provider: "perplexity",
    };
  }

  try {
    const brief = formatDraftForPerplexitySearch(draft, input);
    const grounded = await perplexityCookieAnalyze({
      type: "text",
      text: brief.slice(0, 5500),
      imageName: input.imageName,
    });
    return mergeDraftAndGrounded(draft, grounded);
  } catch (err) {
    console.error("[free-pipeline] Perplexity cookie stage failed, using DeepSeek only:", err);
    return {
      ...draft,
      summary: `${draft.summary} (Live web check was unavailable; DeepSeek draft shown.)`,
      provider: "perplexity",
    };
  }
}
