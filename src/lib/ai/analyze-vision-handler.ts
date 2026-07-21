import { claudeVisionAnalyze, hasClaudeKey } from "./claude-vision";
import type { AnalysisInput } from "./types";

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, apikey",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...corsHeaders,
    },
  });
}

/**
 * Mobile screenshot vision — **Claude reads the image and assesses it from its
 * own knowledge**. Single stage (no Perplexity, no OCR, no DeepSeek, no mock):
 * Claude describes what's on screen, extracts the factual claims, and judges
 * source credibility / context from what it already knows.
 *
 * Requires: { type: "image", imageBase64 } and a Claude key. Claude failure
 * fails the request (no image reading = no analysis).
 */
export async function handleAnalyzeVisionApi(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({
        ok: true,
        engine: "claude-vision (knowledge-grounded)",
        vision: hasClaudeKey(),
      });
    }

    if (request.method !== "POST") {
      return json({ error: { message: "Method not allowed" } }, 405);
    }

    const body = (await request.json()) as AnalysisInput;
    if (body?.type !== "image") {
      return json({ error: { message: "type must be image" } }, 400);
    }
    if (!body.imageBase64?.trim()) {
      return json(
        { error: { message: "imageBase64 is required for Claude vision" } },
        400,
      );
    }

    if (!hasClaudeKey()) {
      return json(
        {
          error: {
            message:
              "Screenshot vision needs ANTHROPIC_API_KEY / CLAUDE_API_KEY on the server.",
          },
          engine_path: null,
          engine_detail: "claude_vision_missing_key",
        },
        500,
      );
    }

    const result = await claudeVisionAnalyze(body);
    return json({
      data: result,
      error: null,
      engine_path: result.engine_path ?? "claude_vision",
      provider: result.provider ?? "claude",
      engine_detail: result.engine_detail,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/analyze/vision]", message);
    let safe = "The Model is temporarily unavailable. Please try again.";
    let fail_path = "claude_vision";
    if (/ANTHROPIC_API_KEY|CLAUDE_API_KEY is not set/i.test(message)) {
      safe =
        "Screenshot vision needs ANTHROPIC_API_KEY / CLAUDE_API_KEY on the server.";
      fail_path = "claude_vision_missing_key";
    } else if (
      /api-cc freemodel rejected|Claude Code-only|official Claude Code client/i.test(message)
    ) {
      safe =
        "freemodel api-cc rejected the vision call. Check ANTHROPIC_API_KEY for https://api-cc.freemodel.dev.";
      fail_path = "claude_api_cc_rejected";
    } else if (/Vision image too large|too large/i.test(message)) {
      safe = "Screenshot is too large to analyze. Try again with a shorter capture.";
      fail_path = "vision_payload";
    } else if (/blind \(non-vision\)|filename-only/i.test(message)) {
      safe = "The AI could not read the image pixels. Try Analyze again in a moment.";
      fail_path = "blind_vision";
    } else if (/valid JSON|Empty response|Empty Claude|non-JSON/i.test(message)) {
      safe = "The analysis service returned an incomplete result. Please try again.";
      fail_path = "parse";
    }
    return json(
      {
        error: { message: safe },
        engine_path: null,
        engine_detail: `${fail_path}: ${message.slice(0, 220)}`,
      },
      500,
    );
  }
}

export function isAnalyzeVisionApiPath(pathname: string): boolean {
  return pathname === "/api/analyze/vision";
}
