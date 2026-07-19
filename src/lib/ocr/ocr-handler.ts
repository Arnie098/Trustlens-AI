/**
 * HTTP handler for POST /api/ocr — proxies to OCR.space with server-side API key.
 */
import {
  hasOcrSpaceKey,
  ocrSpaceFromBase64,
  ocrSpaceFromBytes,
  ocrSpaceProviderInfo,
} from "./ocrspace.server";

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

export async function handleOcrApi(request: Request): Promise<Response> {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method === "GET") {
      return json({ ok: true, ...ocrSpaceProviderInfo() });
    }

    if (request.method !== "POST") {
      return json({ error: { message: "Method not allowed" } }, 405);
    }

    if (!hasOcrSpaceKey()) {
      return json(
        {
          error: {
            message:
              "OCR.space is not configured on the server. Set OCR_SPACE_API_KEY in the environment.",
          },
          ...ocrSpaceProviderInfo(),
        },
        503,
      );
    }

    const contentType = request.headers.get("content-type") || "";

    // JSON: { base64: "..." | "data:image/jpeg;base64,...", language?: "eng" }
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as {
        base64?: string;
        imageBase64?: string;
        language?: string;
      };
      const b64 = (body.base64 || body.imageBase64 || "").trim();
      if (!b64) {
        return json({ error: { message: "base64 image is required" } }, 400);
      }
      const data = await ocrSpaceFromBase64(b64, { language: body.language });
      return json({ data, error: null, ...ocrSpaceProviderInfo() });
    }

    // Multipart: field "image" or "file"
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = (form.get("image") || form.get("file")) as File | null;
      const language = String(form.get("language") || "") || undefined;

      if (!file || typeof file.arrayBuffer !== "function") {
        return json(
          { error: { message: "multipart field 'image' (or 'file') is required" } },
          400,
        );
      }

      const bytes = await file.arrayBuffer();
      if (!bytes.byteLength) {
        return json({ error: { message: "empty image upload" } }, 400);
      }

      const data = await ocrSpaceFromBytes(bytes, {
        filename: file.name || "scan.jpg",
        mimeType: file.type || "image/jpeg",
        language,
      });
      return json({ data, error: null, ...ocrSpaceProviderInfo() });
    }

    return json(
      {
        error: {
          message: "Send multipart/form-data with 'image', or JSON { base64 }",
        },
      },
      400,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/ocr]", message);
    const safe = /api.?key|apikey|unauthorized|401/i.test(message)
      ? "OCR service rejected the request. Check OCR_SPACE_API_KEY."
      : message.includes("timed out")
        ? "OCR timed out. Try a smaller or clearer image."
        : "OCR failed. Please try again.";
    return json({ error: { message: safe } }, 500);
  }
}

export function isOcrApiPath(pathname: string): boolean {
  return pathname === "/api/ocr" || pathname.startsWith("/api/ocr/");
}
