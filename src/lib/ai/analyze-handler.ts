import { analyzeContentServer, analyzeProviderInfo } from "./analyze.server";
import type { AnalysisInput } from "./types";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function handleAnalyzeApi(request: Request): Promise<Response> {
  try {
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

    const data = await analyzeContentServer(body);
    return json({ data, error: null, ...analyzeProviderInfo() });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/analyze]", message);
    // Never leak internal transport / auth details to the browser
    const safe =
      /cookie|sse|session|PERPLEXITY_COOKIES|cloudflare|web session/i.test(message)
        ? "Analysis is temporarily unavailable. Please try again."
        : message.includes("Perplexity")
          ? "Live analysis is temporarily unavailable. Please try again."
          : "Analysis failed. Please try again.";
    return json({ error: { message: safe } }, 500);
  }
}

export function isAnalyzeApiPath(pathname: string): boolean {
  return pathname === "/api/analyze" || pathname.startsWith("/api/analyze/");
}
