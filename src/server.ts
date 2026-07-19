import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

function isSqliteProvider(): boolean {
  const raw = process.env.VITE_DB_PROVIDER || process.env.DB_PROVIDER || "sqlite";
  return raw !== "supabase";
}

async function tryAppApis(request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;

  // Perplexity (or mock) content verification — always available
  if (pathname === "/api/analyze" || pathname.startsWith("/api/analyze/")) {
    const { handleAnalyzeApi } = await import("./lib/ai/analyze-handler");
    return handleAnalyzeApi(request);
  }

  // OCR.space proxy (server holds OCR_SPACE_API_KEY)
  if (pathname === "/api/ocr" || pathname.startsWith("/api/ocr/")) {
    const { handleOcrApi } = await import("./lib/ocr/ocr-handler");
    return handleOcrApi(request);
  }

  // Local SQLite API only when not on Supabase
  if (!isSqliteProvider()) return null;
  if (pathname !== "/api/local" && !pathname.startsWith("/api/local/")) return null;
  const { handleLocalApi } = await import("./lib/sqlite/api-handler");
  return handleLocalApi(request);
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const appApi = await tryAppApis(request);
      if (appApi) return appApi;

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
