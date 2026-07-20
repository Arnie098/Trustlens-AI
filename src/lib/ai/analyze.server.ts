/**
 * Server-side content analysis.
 *
 * Mobile screenshot (imageUrl) vision priority:
 *   1) PERPLEXITY_API_KEY → Sonar vision
 *   2) ANTHROPIC_API_KEY / CLAUDE_API_KEY → Claude vision (screenshot-only)
 *   3) OCR/text via free DeepSeek + cookies
 *
 * Every result includes engine_path = which path actually ran.
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
import type {
  AnalysisEnginePath,
  AnalysisInput,
  AnalysisResult,
} from "./types";

/** What the browser / API clients are allowed to see. */
export type PublicProvider = "perplexity" | "mock" | "claude";

function asPublicResult(
  result: AnalysisResult,
  provider: PublicProvider,
  engine_path: AnalysisEnginePath,
  engine_detail?: string,
): AnalysisResult {
  return {
    ...result,
    provider,
    engine_path,
    engine_detail: engine_detail || result.engine_detail,
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

function useFreeHybridPipeline(): boolean {
  if (!canUseFreeDeepSeekPerplexityPipeline()) return false;
  const flag = process.env.ANALYZE_FREE_PIPELINE?.trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") return false;
  if (flag === "1" || flag === "true" || flag === "yes") return true;
  return !hasPerplexityKey();
}

export async function analyzeContentServer(input: AnalysisInput): Promise<AnalysisResult> {
  const requiresVision = input.type === "image" && Boolean(input.imageUrl?.trim());
  const visionErrors: string[] = [];

  // 1) Perplexity vision
  if (requiresVision && hasPerplexityKey()) {
    try {
      const r = await perplexityAnalyze(input);
      return asPublicResult(r, "perplexity", "perplexity_vision");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      visionErrors.push(`perplexity_vision: ${msg}`);
      console.error("[analyze] Perplexity vision path failed:", err);
      if (hasClaudeKey()) {
        try {
          const r = await claudeVisionAnalyze(input);
          return asPublicResult(
            r,
            "claude",
            "claude_vision",
            r.engine_detail || `after_perplexity_fail: ${msg.slice(0, 120)}`,
          );
        } catch (claudeErr) {
          const cmsg = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
          visionErrors.push(`claude_vision: ${cmsg}`);
          console.error("[analyze] Claude vision fallback failed:", claudeErr);
        }
      }
    }
  }

  // 1a) Claude vision (freemodel or Anthropic) — screenshots only
  if (requiresVision && hasClaudeKey()) {
    try {
      const r = await claudeVisionAnalyze(input);
      return asPublicResult(r, "claude", "claude_vision", r.engine_detail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      visionErrors.push(`claude_vision: ${msg}`);
      console.error("[analyze] Claude vision path failed:", err);
    }
  }

  // 1b) Screenshot OCR / caption text fallback
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
    const failNote =
      visionErrors.length > 0
        ? ` Vision failed: ${visionErrors[visionErrors.length - 1].slice(0, 160)}`
        : " No vision key or vision call failed.";
    const mark = (r: AnalysisResult, path: AnalysisEnginePath): AnalysisResult =>
      asPublicResult(
        {
          ...r,
          summary: `${r.summary} (Text from screen only.${failNote})`,
          confidence: Math.min(r.confidence, 75),
        },
        r.provider === "claude" ? "claude" : path.startsWith("screenshot_ocr") ? "perplexity" : "mock",
        path,
        visionErrors.join(" || ").slice(0, 400) || undefined,
      );

    if (canUseFreeDeepSeekPerplexityPipeline() || useFreeHybridPipeline()) {
      try {
        return mark(await deepseekThenPerplexityCookie(textInput), "screenshot_ocr_free");
      } catch (err) {
        console.error("[analyze] Screenshot OCR free-pipeline failed:", err);
      }
    }
    if (hasPerplexityCookies()) {
      try {
        return mark(await perplexityCookieAnalyze(textInput), "screenshot_ocr_cookie");
      } catch (err) {
        console.error("[analyze] Screenshot OCR cookie path failed:", err);
      }
    }
    if (hasDeepSeekKey()) {
      try {
        return mark(await deepseekAnalyze(textInput), "screenshot_ocr_deepseek");
      } catch (err) {
        console.error("[analyze] Screenshot OCR DeepSeek path failed:", err);
      }
    }
    return mark(await mockAnalyze(textInput), "screenshot_ocr_mock");
  }

  // 2–7 text/url paths
  if (useFreeHybridPipeline()) {
    try {
      return asPublicResult(
        await deepseekThenPerplexityCookie(input),
        "perplexity",
        "text_free_hybrid",
      );
    } catch (err) {
      console.error("[analyze] Free DeepSeek+web pipeline failed:", err);
    }
  }

  if (canUseFreeDeepSeekPerplexityPipeline()) {
    try {
      return asPublicResult(
        await deepseekThenPerplexityCookie(input),
        "perplexity",
        "text_free_hybrid",
      );
    } catch (err) {
      console.error("[analyze] Free pipeline fallback failed:", err);
    }
  }

  if (hasDeepSeekKey()) {
    try {
      return asPublicResult(await deepseekAnalyze(input), "perplexity", "text_deepseek");
    } catch (err) {
      console.error("[analyze] DeepSeek-only failed:", err);
    }
  }

  if (preferCookieSession() && hasPerplexityCookies() || hasPerplexityCookies()) {
    try {
      return asPublicResult(
        await perplexityCookieAnalyze(input),
        "perplexity",
        "text_cookie",
      );
    } catch (err) {
      console.error("[analyze] Cookie session path failed:", err);
    }
  }

  if (hasPerplexityKey()) {
    try {
      return asPublicResult(await perplexityAnalyze(input), "perplexity", "text_perplexity");
    } catch (err) {
      console.error("[analyze] Perplexity API path failed:", err);
    }
  }

  return asPublicResult(await mockAnalyze(input), "mock", "mock");
}

/** Config snapshot (what is available), not the path used for a request. */
export function analyzeProviderInfo(): {
  provider: PublicProvider;
  engine: string;
  vision: boolean;
  screenshot_vision?: "perplexity" | "claude" | "none";
  free_pipeline?: boolean;
  claude_base_url?: string;
  claude_model?: string;
} {
  const screenshotVision = hasPerplexityKey()
    ? "perplexity"
    : hasClaudeKey()
      ? "claude"
      : "none";
  const vision = screenshotVision !== "none";
  const claudeBase =
    process.env.ANTHROPIC_BASE_URL?.trim() ||
    (/^(1|true|yes)$/i.test(process.env.ANTHROPIC_USE_FREEMODEL || "")
      ? "https://api-cc.freemodel.dev"
      : undefined);
  const claudeModel =
    process.env.CLAUDE_VISION_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    (hasClaudeKey() ? "claude-opus-4-8" : undefined);

  if (canUseFreeDeepSeekPerplexityPipeline()) {
    return {
      provider: "perplexity",
      engine: "deepseek+web",
      vision,
      screenshot_vision: screenshotVision,
      free_pipeline: true,
      claude_base_url: claudeBase,
      claude_model: claudeModel,
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
      claude_base_url: claudeBase,
      claude_model: claudeModel,
    };
  }
  return {
    provider: "mock",
    engine: "heuristic",
    vision: false,
    screenshot_vision: "none",
  };
}
