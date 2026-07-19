/**
 * Browser client for TrustLens OCR proxy (OCR.space on the server).
 * POST /api/ocr — API key never leaves the server.
 */

export type WebOcrAction = "accept" | "review" | "retake";

export type WebOcrResult = {
  text: string;
  confidence: number;
  action: WebOcrAction;
  message: string;
  engine: string;
  requestId?: string;
  error?: string | null;
};

type ApiBody = {
  data?: {
    text?: string;
    confidence?: number;
    action?: WebOcrAction;
    message?: string;
    engine?: string;
    requestId?: string;
    error?: string | null;
  };
  error?: { message?: string };
  configured?: boolean;
};

/** GET /api/ocr — is OCR.space configured on the server? */
export async function ocrProviderInfo(): Promise<{ configured: boolean; provider: string }> {
  try {
    const res = await fetch("/api/ocr", { method: "GET" });
    const json = (await res.json()) as { configured?: boolean; provider?: string };
    return {
      configured: Boolean(json.configured),
      provider: json.provider || "none",
    };
  } catch {
    return { configured: false, provider: "none" };
  }
}

/**
 * Extract text from an image File via server OCR.space proxy.
 */
export async function extractTextFromImage(file: File): Promise<WebOcrResult> {
  const form = new FormData();
  form.append("image", file, file.name || "scan.jpg");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch("/api/ocr", {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    let json: ApiBody;
    try {
      json = (await res.json()) as ApiBody;
    } catch {
      throw new Error(`OCR returned invalid JSON (HTTP ${res.status})`);
    }

    if (!res.ok || !json.data) {
      throw new Error(json.error?.message || `OCR failed (HTTP ${res.status})`);
    }

    const text = String(json.data.text ?? "").trim();
    const action = json.data.action || (text ? "review" : "retake");

    return {
      text,
      confidence: Number(json.data.confidence ?? -1),
      action,
      message:
        json.data.message ||
        (text
          ? "Text extracted — review before analyzing."
          : "No text found. You can type a caption or analyze the image as-is."),
      engine: json.data.engine || "ocrspace",
      requestId: json.data.requestId,
      error: json.data.error,
    };
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("OCR timed out. Try a smaller or clearer image.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
