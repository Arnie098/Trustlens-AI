// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import type { IncomingMessage, ServerResponse } from "node:http";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { defineConfig as defineLovableConfig } from "@lovable.dev/vite-tanstack-config";
import type { Plugin } from "vite";

const SQLITE_STUB = fileURLToPath(new URL("./src/lib/sqlite/sqlite-stub.ts", import.meta.url));

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
            // ssrLoadModule (not a literal import()) so esbuild doesn't bundle this
            // chain into the config file — it would hoist node:sqlite to config load.
            const { handleAnalyzeApi } = (await server.ssrLoadModule(
              "/src/lib/ai/analyze-handler",
            )) as typeof import("./src/lib/ai/analyze-handler");
            const response = await handleAnalyzeApi(request);
            await writeFetchResponse(res, response);
            return;
          }

          if (!urlPath.startsWith("/api/local")) {
            next();
            return;
          }

          const provider = process.env.VITE_DB_PROVIDER || process.env.DB_PROVIDER || "sqlite";
          if (provider === "supabase") {
            next();
            return;
          }

          const request = await nodeToFetchRequest(req);
          const { handleLocalApi } = (await server.ssrLoadModule(
            "/src/lib/sqlite/api-handler",
          )) as typeof import("./src/lib/sqlite/api-handler");
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
const env = loadEnv(
  process.env.NODE_ENV === "production" ? "production" : "development",
  process.cwd(),
  "",
);
for (const [key, value] of Object.entries(env)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

// Supabase deploys (Render) must not touch Node's experimental `node:sqlite`.
// Alias it to a stub so Vite/Nitro can build on hosts without that builtin.
const dbProvider =
  process.env.VITE_DB_PROVIDER || process.env.DB_PROVIDER || env.VITE_DB_PROVIDER || "sqlite";
const useSupabase = dbProvider === "supabase";
const sqliteAlias = useSupabase ? { "node:sqlite": SQLITE_STUB } : {};

// Mobile (Capacitor) needs a STATIC index.html to bundle into mobile/www — the
// default SSR/Nitro build only emits assets + a server entry. When MOBILE_SPA=1
// (set by scripts/sync-mobile.mjs), enable TanStack Start SPA mode so the shell
// is prerendered to a static index.html and the app runs fully client-side inside
// the WebView.
//
// SPA prerender boots TanStack Start's own preview server, which loads the server
// build from dist/server/server.js. Nitro's node-server preset repackages output
// to .output/ instead, so prerender + Nitro do not compose. For the mobile build
// we therefore DISABLE Nitro (nitro: false) — we only need static client assets +
// the prerendered shell, not a deployable server. The Render/production SSR path
// never sets MOBILE_SPA, so it keeps the node-server preset untouched.
const mobileSpa = process.env.MOBILE_SPA === "1";
const tanstackStartOptions: Record<string, unknown> = {
  // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
  server: { entry: "server" },
  ...(mobileSpa
    ? {
        spa: {
          enabled: true,
          prerender: { enabled: true, crawlLinks: false },
        },
      }
    : {}),
};

const nitroConfig = mobileSpa
  ? false
  : {
      // Render (and local Node hosting) need a Node listener, not Cloudflare Workers.
      // Override Lovable's defaultPreset of cloudflare-module.
      preset: "node-server",
      alias: sqliteAlias,
    };

export default defineLovableConfig({
  nitro: nitroConfig,
  tanstackStart: tanstackStartOptions,
  vite: {
    plugins: [localApiPlugin()],
    resolve: {
      alias: sqliteAlias,
    },
    // Keep node builtins out of the browser bundle. On Supabase builds, do NOT
    // externalize node:sqlite — resolve the stub instead (external would still
    // try to load a missing builtin on older Node and fail the build).
    ssr: {
      external: useSupabase
        ? ["node:fs", "node:path", "node:crypto", "node:url"]
        : ["node:sqlite", "node:fs", "node:path", "node:crypto", "node:url"],
    },
  },
});
