/**
 * Server-side content analysis.
 *
 * Implementation detail (not exposed to clients):
 *   official PERPLEXITY_API_KEY → optional local session bridge → mock.
 *
 * Public provider labels are only "perplexity" | "mock".
 */
import { mockAnalyze } from "./mock-analyze";
import { hasPerplexityKey, perplexityAnalyze } from "./perplexity";
import { hasPerplexityCookies, perplexityCookieAnalyze } from "./perplexity-cookie";
import type { AnalysisInput, AnalysisResult } from "./types";

/** What the browser / API clients are allowed to see. */
export type PublicProvider = "perplexity" | "mock";

function asPublicResult(result: AnalysisResult, provider: PublicProvider): AnalysisResult {
  return {
    ...result,
    provider,
    // Never leak internal transport notes into stored/displayed summary text
    summary: stripInternalNotes(result.summary),
    source_assessment: stripInternalNotes(result.source_assessment),
    context_analysis: stripInternalNotes(result.context_analysis),
  };
}

function stripInternalNotes(text: string | undefined): string {
  if (!text) return text ?? "";
  return text
    .replace(/\s*\[engine:[^\]]*\]/gi, "")
    .replace(/\s*\(Note:.*?\)/gi, "")
    .replace(/\bcookie[-\s]?mode\b/gi, "")
    .replace(/\bwebsite session\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export async function analyzeContentServer(input: AnalysisInput): Promise<AnalysisResult> {
  // 1) Official API
  if (hasPerplexityKey()) {
    try {
      return asPublicResult(await perplexityAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Perplexity primary path failed:", err);
      // fall through
    }
  }

  // 2) Local session bridge (implementation detail — not exposed)
  if (hasPerplexityCookies()) {
    try {
      return asPublicResult(await perplexityCookieAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Perplexity secondary path failed:", err);
      const mock = await mockAnalyze(input);
      return asPublicResult(
        {
          ...mock,
          summary:
            "Automated analysis completed with limited live signals. Independent verification is still recommended before sharing.",
        },
        "mock",
      );
    }
  }

  // 3) Mock
  return asPublicResult(await mockAnalyze(input), "mock");
}

/** Public health/status for /api/analyze — never mentions cookies or unofficial modes. */
export function analyzeProviderInfo(): {
  provider: PublicProvider;
  engine: string;
} {
  if (hasPerplexityKey() || hasPerplexityCookies()) {
    return {
      provider: "perplexity",
      engine: "perplexity",
    };
  }
  return {
    provider: "mock",
    engine: "heuristic",
  };
}
