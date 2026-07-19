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
    return json({ data, error: null, ...analyzeProviderInfo() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/analyze]", message);
    // Safe client messages — include actionable vision/upload hints without secrets
    let safe = "Analysis failed. Please try again.";
    if (/cookie|sse|session|PERPLEXITY_COOKIES|cloudflare|web session/i.test(message)) {
      safe = "Analysis is temporarily unavailable. Please try again.";
    } else if (/PERPLEXITY_API_KEY/i.test(message)) {
      safe = "Screenshot vision is not configured on the server (missing API key).";
    } else if (/Vision image too large|too large/i.test(message)) {
      safe = "Screenshot is too large to analyze. Try again with a shorter capture.";
    } else if (/Could not fetch image|local upload read|data-URI|disk/i.test(message)) {
      safe = "Could not load the uploaded screenshot for vision. Try Analyze again.";
    } else if (/blind \(non-vision\)|filename-only/i.test(message)) {
      safe = "The AI could not read the image pixels. Try Analyze again in a moment.";
    } else if (/Perplexity API \d+/i.test(message)) {
      safe = "Live vision analysis is temporarily unavailable. Please try again.";
    } else if (message.includes("Perplexity")) {
      safe = "Live analysis is temporarily unavailable. Please try again.";
    } else if (/valid JSON|Empty response/i.test(message)) {
      safe = "The analysis service returned an incomplete result. Please try again.";
    }
    return json({ error: { message: safe } }, 500);
  }
}

export function isAnalyzeApiPath(pathname: string): boolean {
  return pathname === "/api/analyze" || pathname.startsWith("/api/analyze/");
}
