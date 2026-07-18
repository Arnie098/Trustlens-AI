/**
 * HTTP handler for local SQLite API (/api/local/*).
 * Mounted from src/server.ts so the browser client can talk to the file DB.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  authGetSession,
  authGetUser,
  authSignIn,
  authSignOut,
  authSignUp,
  executeQuery,
  getUploadsDir,
  saveUpload,
  type QueryRequest,
} from "./server-db";

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

export async function handleLocalApi(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  try {
    // Mobile Expo web (localhost:8081) → API (localhost:3000) preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (path === "/api/local/health" && request.method === "GET") {
      return json({ ok: true, provider: "sqlite" });
    }

    if (path === "/api/local/query" && request.method === "POST") {
      const body = (await request.json()) as QueryRequest;
      const result = executeQuery(body);
      return json(result, result.error ? 400 : 200);
    }

    if (path === "/api/local/auth" && request.method === "POST") {
      const body = (await request.json()) as {
        action: string;
        email?: string;
        password?: string;
        full_name?: string;
        access_token?: string;
      };
      const userAgent = request.headers.get("user-agent");

      if (body.action === "signInWithPassword") {
        const { session, error } = authSignIn(body.email ?? "", body.password ?? "", userAgent);
        if (error) return json({ data: { session: null, user: null }, error: { message: error } });
        return json({ data: { session, user: session!.user }, error: null });
      }

      if (body.action === "signUp") {
        const { session, user, error } = authSignUp(
          body.email ?? "",
          body.password ?? "",
          body.full_name,
          userAgent,
        );
        if (error) return json({ data: { session: null, user: null }, error: { message: error } });
        return json({ data: { session, user }, error: null });
      }

      if (body.action === "getUser") {
        const user = authGetUser(body.access_token);
        return json({ data: { user }, error: user ? null : { message: "Invalid session" } });
      }

      if (body.action === "getSession") {
        const session = authGetSession(body.access_token);
        return json({
          data: { session },
          error: session ? null : { message: "Invalid or expired session" },
        });
      }

      if (body.action === "signOut") {
        authSignOut(body.access_token);
        return json({ data: {}, error: null });
      }

      if (body.action === "resetPasswordForEmail" || body.action === "updateUser") {
        return json({
          data: {},
          error: {
            message:
              "Password reset is not available in local SQLite mode. Switch to Supabase for email auth flows.",
          },
        });
      }

      return json({ data: null, error: { message: `Unknown auth action: ${body.action}` } }, 400);
    }

    if (path === "/api/local/storage/upload" && request.method === "POST") {
      const form = await request.formData();
      const file = form.get("file");
      const storagePath = String(form.get("path") ?? "");
      if (!storagePath || !(file instanceof File)) {
        return json({ data: null, error: { message: "path and file required" } }, 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      saveUpload(storagePath, buf);
      return json({ data: { path: storagePath }, error: null });
    }

    if (path.startsWith("/api/local/storage/object/") && request.method === "GET") {
      const rel = decodeURIComponent(path.slice("/api/local/storage/object/".length));
      const full = join(getUploadsDir(), rel);
      if (!existsSync(full) || !full.startsWith(getUploadsDir())) {
        return new Response("Not found", { status: 404 });
      }
      const data = readFileSync(full);
      return new Response(data, {
        headers: { "content-type": "application/octet-stream", "cache-control": "private, max-age=3600" },
      });
    }

    return json({ error: { message: "Not found" } }, 404);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[local-api]", message);
    return json({ error: { message } }, 500);
  }
}

export function isLocalApiPath(pathname: string): boolean {
  return pathname === "/api/local" || pathname.startsWith("/api/local/");
}
