// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import type { IncomingMessage, ServerResponse } from "node:http";
import { defineConfig, loadEnv } from "vite";
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

/**
 * Serves /api/analyze and /api/local/* from the Vite dev server.
 */
function localApiPlugin(): Plugin {
  return {
    name: "trustlens-local-apis",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlPath = (req.url ?? "").split("?")[0];

        try {
          if (urlPath === "/api/analyze" || urlPath.startsWith("/api/analyze/")) {
            const request = await nodeToFetchRequest(req);
            const { handleAnalyzeApi } = await import("./src/lib/ai/analyze-handler");
            const response = await handleAnalyzeApi(request);
            await writeFetchResponse(res, response);
            return;
          }

          if (!urlPath.startsWith("/api/local")) {
            next();
            return;
          }

          const provider =
            process.env.VITE_DB_PROVIDER || process.env.DB_PROVIDER || "sqlite";
          if (provider === "supabase") {
            next();
            return;
          }

          const request = await nodeToFetchRequest(req);
          const { handleLocalApi } = await import("./src/lib/sqlite/api-handler");
          const response = await handleLocalApi(request);
          await writeFetchResponse(res, response);
        } catch (err) {
          console.error("[trustlens-local-apis]", err);
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: { message: String(err) } }));
        }
      });
    },
  };
}

async function nodeToFetchRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const method = req.method ?? "GET";
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks);
  return new Request(url, { method, headers, body });
}

async function writeFetchResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    // Node handles content-length itself for some bodies
    if (key.toLowerCase() === "transfer-encoding") return;
    res.setHeader(key, value);
  });
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

// Load all .env keys into process.env so server APIs can read PERPLEXITY_API_KEY
// (Vite only exposes VITE_* to the browser by design).
const env = loadEnv(process.env.NODE_ENV === "production" ? "production" : "development", process.cwd(), "");
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

export default defineLovableConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [localApiPlugin()],
    // Keep node:sqlite and server modules out of the browser bundle
    ssr: {
      external: ["node:sqlite", "node:fs", "node:path", "node:crypto", "node:url"],
    },
  },
});
