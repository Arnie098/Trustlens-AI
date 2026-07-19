/**
 * Temporary public screenshot hosting for mobile floating assist / vision analyze.
 *
 * POST /api/uploads  → store JPEG/PNG, return fetchable HTTPS URL
 * GET  /api/uploads/:id  → serve bytes (Perplexity fetches this)
 *
 * Files live under data/uploads/ and auto-expire (default 2h).
 */
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";

const corsHeaders: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, apikey",
};

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const TTL_MS = Number(process.env.UPLOAD_TTL_MS || 2 * 60 * 60 * 1000); // 2h
const UPLOADS_DIR =
  process.env.UPLOADS_DIR?.trim() || join(process.cwd(), "data", "uploads");

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

function publicBase(request: Request): string {
  const env =
    process.env.PUBLIC_APP_URL?.trim() ||
    process.env.RENDER_EXTERNAL_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    "";
  if (env) return env.replace(/\/$/, "");
  // Fall back to the request origin (works on Render + local)
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

async function ensureDir() {
  await mkdir(UPLOADS_DIR, { recursive: true });
}

/** Drop expired capture files (best-effort). */
async function purgeExpired() {
  try {
    const now = Date.now();
    const names = await readdir(UPLOADS_DIR);
    await Promise.all(
      names.map(async (name) => {
        if (!/^tl_[a-f0-9]+\.(jpe?g|png|webp)$/i.test(name)) return;
        const full = join(UPLOADS_DIR, name);
        try {
          const s = await stat(full);
          if (now - s.mtimeMs > TTL_MS) await unlink(full);
        } catch {
          /* ignore */
        }
      }),
    );
  } catch {
    /* ignore */
  }
}

function extFor(mime: string): string {
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "jpg";
}

function mimeForExt(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

function newId(): string {
  return randomBytes(16).toString("hex");
}

async function storeBytes(
  bytes: Uint8Array,
  mime: string,
  request: Request,
): Promise<{ id: string; url: string; bytes: number; expiresInSec: number }> {
  if (bytes.byteLength < 32) {
    throw new Error("Image is empty or too small.");
  }
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error(`Image too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB).`);
  }

  await ensureDir();
  await purgeExpired();

  const id = newId();
  const ext = extFor(mime);
  const filename = `tl_${id}.${ext}`;
  const full = join(UPLOADS_DIR, filename);
  await writeFile(full, bytes);

  const base = publicBase(request);
  const url = `${base}/api/uploads/${filename}`;
  const expiresInSec = Math.round(TTL_MS / 1000);

  console.info(
    `[api/uploads] stored ${filename} (${bytes.byteLength}B) sha=${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}`,
  );

  return { id: filename, url, bytes: bytes.byteLength, expiresInSec };
}

async function parsePostBody(
  request: Request,
): Promise<{ bytes: Uint8Array; mime: string }> {
  const ct = (request.headers.get("content-type") || "").toLowerCase();

  // JSON: { imageBase64, contentType? } or { dataUrl }
  if (ct.includes("application/json")) {
    const body = (await request.json()) as {
      imageBase64?: string;
      dataUrl?: string;
      contentType?: string;
      mime?: string;
    };
    let b64 = body.imageBase64?.trim() || "";
    let mime = body.contentType || body.mime || "image/jpeg";
    if (!b64 && body.dataUrl) {
      const m = body.dataUrl.match(/^data:([^;]+);base64,(.+)$/i);
      if (m) {
        mime = m[1] || mime;
        b64 = m[2];
      }
    }
    if (!b64) throw new Error("imageBase64 or dataUrl is required");
    const raw = Buffer.from(b64.replace(/\s/g, ""), "base64");
    return { bytes: new Uint8Array(raw), mime };
  }

  // Multipart form (field name: file | image | capture)
  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file =
      (form.get("file") as File | null) ||
      (form.get("image") as File | null) ||
      (form.get("capture") as File | null);
    if (!file || typeof file === "string") {
      throw new Error("multipart field file|image|capture is required");
    }
    const ab = await file.arrayBuffer();
    return {
      bytes: new Uint8Array(ab),
      mime: file.type || "image/jpeg",
    };
  }

  // Raw body: Content-Type: image/jpeg
  if (ct.startsWith("image/")) {
    const ab = await request.arrayBuffer();
    return { bytes: new Uint8Array(ab), mime: ct.split(";")[0].trim() };
  }

  throw new Error(
    "Unsupported body. Use application/json { imageBase64 }, multipart file, or raw image/*.",
  );
}

export async function handleUploadApi(request: Request): Promise<Response> {
  try {
    const pathname = new URL(request.url).pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // GET /api/uploads/:filename — public image for Perplexity
    if (request.method === "GET") {
      if (pathname === "/api/uploads" || pathname === "/api/uploads/") {
        return json({
          ok: true,
          maxBytes: MAX_BYTES,
          ttlSec: Math.round(TTL_MS / 1000),
          post: "POST /api/uploads with imageBase64 | multipart | raw image/*",
        });
      }

      const name = basename(pathname.replace(/\/+$/, ""));
      if (!/^tl_[a-f0-9]+\.(jpe?g|png|webp)$/i.test(name)) {
        return json({ error: { message: "Not found" } }, 404);
      }
      await ensureDir();
      const full = join(UPLOADS_DIR, name);
      let bytes: Buffer;
      try {
        bytes = await readFile(full);
      } catch {
        return json({ error: { message: "Not found or expired" } }, 404);
      }
      // Soft TTL
      try {
        const s = await stat(full);
        if (Date.now() - s.mtimeMs > TTL_MS) {
          try {
            await unlink(full);
          } catch {
            /* ignore */
          }
          return json({ error: { message: "Upload expired" } }, 410);
        }
      } catch {
        /* ignore */
      }

      const ext = name.split(".").pop()?.toLowerCase() || "jpg";
      // Uint8Array is a valid BodyInit; Node Buffer is not always typed as one
      return new Response(new Uint8Array(bytes), {
        status: 200,
        headers: {
          "content-type": mimeForExt(ext),
          "cache-control": "public, max-age=300",
          "access-control-allow-origin": "*",
        },
      });
    }

    if (request.method !== "POST") {
      return json({ error: { message: "Method not allowed" } }, 405);
    }

    const { bytes, mime } = await parsePostBody(request);
    const stored = await storeBytes(bytes, mime, request);
    return json({
      data: {
        id: stored.id,
        url: stored.url,
        bytes: stored.bytes,
        expiresInSec: stored.expiresInSec,
      },
      error: null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/uploads]", message);
    return json({ error: { message } }, 400);
  }
}

export function isUploadApiPath(pathname: string): boolean {
  return pathname === "/api/uploads" || pathname.startsWith("/api/uploads/");
}
