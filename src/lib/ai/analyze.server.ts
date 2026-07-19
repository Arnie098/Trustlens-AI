/**
 * Server-side content analysis.
 *
 * Mobile screenshot (imageUrl) vision priority:
 *   1) PERPLEXITY_API_KEY → Sonar vision
 *   2) ANTHROPIC_API_KEY / CLAUDE_API_KEY → Claude vision (screenshot-only path)
 *   3) OCR/text via free DeepSeek + cookies
 *
 * Text/url paths: free DeepSeek+cookies or Perplexity text API.
 * Public provider labels: perplexity | claude | mock.
 */
import { mockAnalyze } from "./mock-analyze";
import { claudeVisionAnalyze, hasClaudeKey } from "./claude-vision";
import { deepseekAnalyze, hasDeepSeekKey } from "./deepseek";
import {
  canUseFreeDeepSeekPerplexityPipeline,
  deepseekThenPerplexityCookie,
} from "./free-pipeline";
import { hasPerplexityKey, perplexityAnalyze } from "./perplexity";
import { hasPerplexityCookies, perplexityCookieAnalyze } from "./perplexity-cookie";
import { sanitizeAnalysisProse, sanitizeDisplayList } from "./sanitize-text";
import type { AnalysisInput, AnalysisResult } from "./types";

/** What the browser / API clients are allowed to see. */
export type PublicProvider = "perplexity" | "mock" | "claude";

function asPublicResult(result: AnalysisResult, provider: PublicProvider): AnalysisResult {
  return {
    ...result,
    provider,
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

/**
 * Use free DeepSeek + Perplexity-cookie hybrid.
 * Default: ON when both free creds exist and PERPLEXITY_API_KEY is unset.
 * Force ON with ANALYZE_FREE_PIPELINE=1 even if a paid key exists.
 */
function useFreeHybridPipeline(): boolean {
  if (!canUseFreeDeepSeekPerplexityPipeline()) return false;
  const flag = process.env.ANALYZE_FREE_PIPELINE?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") return false;
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  return !hasPerplexityKey();
}

export async function analyzeContentServer(input: AnalysisInput): Promise<AnalysisResult> {
  const requiresVision = input.type === "image" && Boolean(input.imageUrl?.trim());

  // 1) Mobile screenshot vision — Perplexity if key present
  if (requiresVision && hasPerplexityKey()) {
    try {
      return asPublicResult(await perplexityAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Perplexity vision path failed:", err);
      // Prefer Claude for screenshots if available before OCR-only
      if (hasClaudeKey()) {
        try {
          return asPublicResult(await claudeVisionAnalyze(input), "claude");
        } catch (claudeErr) {
          console.error("[analyze] Claude vision fallback failed:", claudeErr);
        }
      }
    }
  }

  // 1a) Claude vision — screenshot/imageUrl only (when no Perplexity key, or after it failed)
  if (requiresVision && hasClaudeKey()) {
    try {
      return asPublicResult(await claudeVisionAnalyze(input), "claude");
    } catch (err) {
      console.error("[analyze] Claude vision path failed:", err);
    }
  }

  // 1b) Screenshot without any vision key: OCR / caption text via free web path
  if (requiresVision) {
    const ocr = input.text?.trim() || "";
    const textForAnalysis =
      ocr.length >= 12
        ? "Analyze this social media post text taken from a mobile screenshot " +
          "(OCR may have small errors). Judge the post content itself:\n\n" +
          ocr.slice(0, 5500)
        : "A user captured a social media screenshot but little readable text was " +
          "extracted. Assess typical trust risks for social posts with weak text " +
          `(label: ${input.imageName || "screenshot"}).`;

    const textInput: AnalysisInput = { type: "text", text: textForAnalysis };
    const mark = (r: AnalysisResult): AnalysisResult => ({
      ...r,
      summary: `${r.summary} (Text from screen only — set ANTHROPIC_API_KEY or PERPLEXITY_API_KEY for image vision.)`,
      confidence: Math.min(r.confidence, 75),
    });

    if (canUseFreeDeepSeekPerplexityPipeline() || useFreeHybridPipeline()) {
      try {
        return asPublicResult(mark(await deepseekThenPerplexityCookie(textInput)), "perplexity");
      } catch (err) {
        console.error("[analyze] Screenshot OCR free-pipeline failed:", err);
      }
    }
    if (hasPerplexityCookies()) {
      try {
        return asPublicResult(mark(await perplexityCookieAnalyze(textInput)), "perplexity");
      } catch (err) {
        console.error("[analyze] Screenshot OCR cookie path failed:", err);
      }
    }
    if (hasDeepSeekKey()) {
      try {
        return asPublicResult(mark(await deepseekAnalyze(textInput)), "perplexity");
      } catch (err) {
        console.error("[analyze] Screenshot OCR DeepSeek path failed:", err);
      }
    }
    return asPublicResult(mark(await mockAnalyze(textInput)), "mock");
  }

  // 2) Hackathon free: DeepSeek API + Perplexity cookies (text/url — no pixel vision)
  if (useFreeHybridPipeline()) {
    try {
      return asPublicResult(await deepseekThenPerplexityCookie(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Free DeepSeek+web pipeline failed:", err);
    }
  }

  // 3) Free hybrid as fallback for text/url
  if (canUseFreeDeepSeekPerplexityPipeline()) {
    try {
      return asPublicResult(await deepseekThenPerplexityCookie(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Free pipeline fallback failed:", err);
    }
  }

  // 4) DeepSeek only (still free; no live web)
  if (hasDeepSeekKey()) {
    try {
      return asPublicResult(await deepseekAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] DeepSeek-only failed:", err);
    }
  }

  // 5) Cookie-only Perplexity
  const tryCookieFirst = preferCookieSession() && hasPerplexityCookies();
  if (tryCookieFirst || hasPerplexityCookies()) {
    try {
      return asPublicResult(await perplexityCookieAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Cookie session path failed:", err);
    }
  }

  // 6) Official Perplexity API (text/url)
  if (hasPerplexityKey()) {
    try {
      return asPublicResult(await perplexityAnalyze(input), "perplexity");
    } catch (err) {
      console.error("[analyze] Perplexity API path failed:", err);
    }
  }

  // 7) Mock
  return asPublicResult(await mockAnalyze(input), "mock");
}

/** Public health/status for /api/analyze */
export function analyzeProviderInfo(): {
  provider: PublicProvider;
  engine: string;
  vision: boolean;
  screenshot_vision?: "perplexity" | "claude" | "none";
  free_pipeline?: boolean;
} {
  const screenshotVision = hasPerplexityKey()
    ? "perplexity"
    : hasClaudeKey()
      ? "claude"
      : "none";
  const vision = screenshotVision !== "none";

  if (canUseFreeDeepSeekPerplexityPipeline()) {
    return {
      provider: "perplexity",
      engine: "deepseek+web",
      vision,
      screenshot_vision: screenshotVision,
      free_pipeline: true,
    };
  }
  if (hasPerplexityKey() || hasClaudeKey() || hasPerplexityCookies() || hasDeepSeekKey()) {
    return {
      provider: hasPerplexityKey() ? "perplexity" : hasClaudeKey() ? "claude" : "perplexity",
      engine: hasPerplexityKey()
        ? "perplexity"
        : hasClaudeKey()
          ? "claude-vision"
          : hasDeepSeekKey()
            ? "deepseek"
            : "web",
      vision,
      screenshot_vision: screenshotVision,
      free_pipeline: false,
    };
  }
  return {
    provider: "mock",
    engine: "heuristic",
    vision: false,
    screenshot_vision: "none",
  };
}
