/**
 * UNESCO OCR HTTP client for React Native / Expo.
 * Source: D:\Hackaton\App\UNESCO\OCR\ocr-prototype\client\react-native
 *
 *   const client = createOcrClient({ baseUrl: "http://10.0.2.2:5001" });
 *   const result = await client.recognize({ uri: photo.uri });
 */

import type {
  OcrClientConfig,
  OcrHealth,
  OcrRequestOptions,
  OcrResponse,
  OcrServiceMeta,
} from "./types";

export class OcrHttpError extends Error {
  readonly status: number;
  readonly body: Partial<OcrResponse> | null;

  constructor(message: string, status: number, body: Partial<OcrResponse> | null) {
    super(message);
    this.name = "OcrHttpError";
    this.status = status;
    this.body = body;
  }
}

export class OcrTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`OCR request timed out after ${timeoutMs}ms`);
    this.name = "OcrTimeoutError";
  }
}

export type ImageInput =
  | { uri: string; name?: string; type?: string }
  | { base64: string; name?: string; type?: string }
  | Blob
  | { uri: string };

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function guessName(uri: string): string {
  const clean = uri.split("?")[0] ?? uri;
  const part = clean.split("/").pop();
  if (part && /\.[a-z0-9]+$/i.test(part)) return part;
  return "capture.jpg";
}

function guessType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".heic") || lower.endsWith(".heif")) return "image/heic";
  return "image/jpeg";
}

async function fetchWithTimeout(
  input: RequestInfo,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new OcrTimeoutError(timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function createOcrClient(config: OcrClientConfig) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const defaultTimeout = config.timeoutMs ?? 45_000;

  function headers(extra?: Record<string, string>, requestId?: string): HeadersInit {
    const h: Record<string, string> = {
      Accept: "application/json",
      "X-Request-Id": requestId || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      ...extra,
    };
    if (config.apiKey) {
      h["X-API-Key"] = config.apiKey;
    }
    return h;
  }

  async function parseJson(res: Response): Promise<OcrResponse> {
    let body: OcrResponse | null = null;
    try {
      body = (await res.json()) as OcrResponse;
    } catch {
      body = null;
    }
    if (!res.ok && res.status >= 400) {
      if (body && typeof body === "object") {
        if ("action" in body || "error_code" in body) {
          return {
            ok: false,
            action: (body.action as OcrResponse["action"]) || "retake",
            text: body.text || "",
            confidence: body.confidence ?? -1,
            low_confidence: body.low_confidence ?? true,
            low_confidence_words: body.low_confidence_words || [],
            fields: body.fields || {},
            word_count: body.word_count || 0,
            elapsed_ms: body.elapsed_ms || 0,
            lang: body.lang,
            lang_requested: body.lang_requested,
            error: body.error || res.statusText,
            error_code: body.error_code || "ocr_failed",
            request_id: body.request_id || "",
            meta: body.meta || {},
          };
        }
      }
      const errMsg =
        body && typeof body === "object" && "error" in body && body.error
          ? String(body.error)
          : `HTTP ${res.status}`;
      throw new OcrHttpError(errMsg, res.status, body);
    }
    if (!body) {
      throw new OcrHttpError("Empty response from OCR service", res.status, null);
    }
    return body;
  }

  return {
    async health(timeoutMs = 8000): Promise<OcrHealth> {
      const res = await fetchWithTimeout(
        `${baseUrl}/health`,
        { method: "GET", headers: headers() },
        timeoutMs,
      );
      if (!res.ok) {
        throw new OcrHttpError(`Health check failed: ${res.status}`, res.status, null);
      }
      return (await res.json()) as OcrHealth;
    },

    async meta(timeoutMs = 8000): Promise<OcrServiceMeta> {
      const res = await fetchWithTimeout(
        `${baseUrl}/ocr/meta`,
        { method: "GET", headers: headers() },
        timeoutMs,
      );
      if (!res.ok) {
        throw new OcrHttpError(`Meta fetch failed: ${res.status}`, res.status, null);
      }
      return (await res.json()) as OcrServiceMeta;
    },

    async recognize(image: ImageInput, options: OcrRequestOptions = {}): Promise<OcrResponse> {
      const timeoutMs = options.timeoutMs ?? defaultTimeout;
      const requestId = options.requestId;
      const form = new FormData();

      if (image instanceof Blob) {
        form.append("image", image, "capture.jpg");
      } else if ("base64" in image && image.base64) {
        const name = image.name || "capture.jpg";
        const type = image.type || guessType(name);
        form.append("image", {
          uri: `data:${type};base64,${image.base64}`,
          name,
          type,
        } as unknown as Blob);
      } else if ("uri" in image && image.uri) {
        const file = image as { uri: string; name?: string; type?: string };
        const name = file.name || guessName(file.uri);
        const type = file.type || guessType(name);
        form.append("image", {
          uri: file.uri,
          name,
          type,
        } as unknown as Blob);
      } else {
        throw new Error("recognize() requires { uri }, { base64 }, or Blob");
      }

      if (options.preset) form.append("preset", options.preset);
      if (options.lang) form.append("lang", options.lang);
      if (options.psm !== undefined && options.psm !== null) {
        form.append("psm", String(options.psm));
      }
      if (options.debug) form.append("debug", "1");

      const res = await fetchWithTimeout(
        `${baseUrl}/ocr`,
        {
          method: "POST",
          headers: headers(undefined, requestId),
          body: form,
        },
        timeoutMs,
      );

      return parseJson(res);
    },
  };
}

export type OcrClient = ReturnType<typeof createOcrClient>;

export function messageForAction(action: OcrResponse["action"]): string {
  switch (action) {
    case "accept":
      return "Text extracted successfully.";
    case "review":
      return "Please check the extracted text before saving.";
    case "retake":
      return "We could not read this photo. Try again with better lighting and focus.";
    default:
      return "Unexpected OCR result.";
  }
}

export function shouldRetake(result: OcrResponse): boolean {
  return result.action === "retake" || result.error_code === "no_text";
}

export function shouldReview(result: OcrResponse): boolean {
  return result.action === "review";
}
