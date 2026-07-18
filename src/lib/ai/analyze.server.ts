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
import { sanitizeAnalysisProse, sanitizeDisplayList } from "./sanitize-text";
import type { AnalysisInput, AnalysisResult } from "./types";

/** What the browser / API clients are allowed to see. */
export type PublicProvider = "perplexity" | "mock";

function asPublicResult(result: AnalysisResult, provider: PublicProvider): AnalysisResult {
  return {
    ...result,
    provider,
    // Never leak internal transport notes or raw JSON blobs into stored/displayed fields
    summary: stripInternalNotes(sanitizeAnalysisProse(result.summary, "summary")),
    source_assessment: stripInternalNotes(
      sanitizeAnalysisProse(result.source_assessment, "source_assessment"),
    ),
    context_analysis: stripInternalNotes(
      sanitizeAnalysisProse(result.context_analysis, "context_analysis"),
    ),
    concerns: sanitizeDisplayList(result.concerns),
    evidence: sanitizeDisplayList(result.evidence),
    next_steps: sanitizeDisplayList(result.next_steps),
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

function preferCookieSession(): boolean {
  const flag = process.env.PERPLEXITY_PREFER_COOKIES?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export async function analyzeContentServer(input: AnalysisInput): Promise<AnalysisResult> {
  // Shared staging (e.g. Render free preview): prefer website session cookies first.
  // Production should leave PERPLEXITY_PREFER_COOKIES unset and use PERPLEXITY_API_KEY.
  const tryCookieFirst = preferCookieSession() && hasPerplexityCookies();

  if (tryCookieFirst) {
    try {
      return asPublicResult(await perplexityCookieAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Cookie session path failed:", err);
      // fall through to API / mock
    }
  }

  // Official API
  if (hasPerplexityKey()) {
    try {
      return asPublicResult(await perplexityAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Perplexity primary path failed:", err);
      // fall through
    }
  }

  // Cookie session (when not already tried above)
  if (!tryCookieFirst && hasPerplexityCookies()) {
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

  // Mock
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
