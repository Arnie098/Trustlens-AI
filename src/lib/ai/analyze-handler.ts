import { analyzeContentServer, analyzeProviderInfo } from "./analyze.server";
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

export async function handleAnalyzeApi(request: Request): Promise<Response> {
  try {
    // Mobile Expo web (different origin) preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({ ok: true, ...analyzeProviderInfo() });
    }

    if (request.method !== "POST") {
      return json({ error: { message: "Method not allowed" } }, 405);
    }

    const body = (await request.json()) as AnalysisInput;
    if (!body?.type || !["url", "text", "image"].includes(body.type)) {
      return json({ error: { message: "type must be url | text | image" } }, 400);
    }

    if (body.type === "url" && !body.url) {
      return json({ error: { message: "url is required for type=url" } }, 400);
    }
    if (body.type === "text" && !body.text?.trim()) {
      return json({ error: { message: "text is required for type=text" } }, 400);
    }
    // Image: prefer fetchable imageUrl (server upload / signed URL) for Perplexity vision.
    // imageName alone is allowed as a degraded path.
    if (body.type === "image" && !body.imageUrl && !body.imageName && !body.text?.trim()) {
      return json(
        {
          error: {
            message:
              "image requires imageUrl (preferred), imageName, or OCR text. Upload via POST /api/uploads first.",
          },
        },
        400,
      );
    }

    const data = await analyzeContentServer(body);
    // config = env capabilities; data.engine_path = path that actually ran
    return json({
      data,
      error: null,
      config: analyzeProviderInfo(),
      // Keep top-level provider for older clients, but prefer data.engine_path
      provider: data.provider,
      engine_path: data.engine_path,
      engine_detail: data.engine_detail,
      ...analyzeProviderInfo(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/analyze]", message);
    // Safe client messages — include actionable vision/upload hints without secrets
    let safe = "Analysis failed. Please try again.";
    let fail_path: string | undefined;
    if (/cookie|sse|session|PERPLEXITY_COOKIES|cloudflare|web session/i.test(message)) {
      safe = "Analysis is temporarily unavailable. Please try again.";
      fail_path = "cookie_session";
    } else if (/ANTHROPIC_API_KEY|CLAUDE_API_KEY is not set/i.test(message)) {
      safe =
        "Screenshot vision needs ANTHROPIC_API_KEY (Claude) or PERPLEXITY_API_KEY on the server.";
      fail_path = "claude_vision_missing_key";
    } else if (/PERPLEXITY_API_KEY is not set/i.test(message)) {
      safe =
        "Set PERPLEXITY_API_KEY or ANTHROPIC_API_KEY on the server for screenshot vision.";
      fail_path = "perplexity_missing_key";
    } else if (/Claude API \d+|Claude vision failed|Claude non-JSON/i.test(message)) {
      safe = "Claude vision is temporarily unavailable. Please try again.";
      fail_path = "claude_vision";
    } else if (/public https imageUrl|missing public imageUrl|imageUrl from POST/i.test(message)) {
      safe = "Screenshot upload did not return a public image URL. Try Analyze again.";
      fail_path = "upload_url";
    } else if (/Vision image too large|too large/i.test(message)) {
      safe = "Screenshot is too large to analyze. Try again with a shorter capture.";
      fail_path = "vision_payload";
    } else if (/Could not fetch image|local upload read|data-URI|disk/i.test(message)) {
      safe = "Could not load the uploaded screenshot for vision. Try Analyze again.";
      fail_path = "vision_load";
    } else if (/blind \(non-vision\)|filename-only/i.test(message)) {
      safe = "The AI could not read the image pixels. Try Analyze again in a moment.";
      fail_path = "blind_vision";
    } else if (/Perplexity API \d+/i.test(message)) {
      safe = "Live vision analysis is temporarily unavailable. Please try again.";
      fail_path = "perplexity_vision";
    } else if (message.includes("Perplexity")) {
      safe = "Live analysis is temporarily unavailable. Please try again.";
      fail_path = "perplexity";
    } else if (/valid JSON|Empty response|Empty Claude/i.test(message)) {
      safe = "The analysis service returned an incomplete result. Please try again.";
      fail_path = "parse";
    }
    // engine_path null = hard failure before a result; engine_detail = short reason for debug
    return json(
      {
        error: { message: safe },
        engine_path: null,
        engine_detail: fail_path
          ? `${fail_path}: ${message.slice(0, 220)}`
          : message.slice(0, 220),
      },
      500,
    );
  }
}

export function isAnalyzeApiPath(pathname: string): boolean {
  return pathname === "/api/analyze" || pathname.startsWith("/api/analyze/");
}
