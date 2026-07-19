/**
 * OCR.space server client (JavaScript/TypeScript).
 * API key stays on the server — never ship it to the browser/mobile bundle.
 *
 * Docs: https://ocr.space/ocrapi
 * Env: OCR_SPACE_API_KEY or OCRSPACE_APIKEY
 */

export type OcrSpaceResult = {
  text: string;
  confidence: number;
  engine: "ocrspace";
  action: "accept" | "review" | "retake";
  message: string;
  requestId: string;
  rawExitCode?: number;
  error?: string | null;
  errorCode?: string | null;
};

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";

export function getOcrSpaceApiKey(): string {
  return (
    process.env.OCR_SPACE_API_KEY ||
    process.env.OCRSPACE_APIKEY ||
    process.env.OCR_SPACE_KEY ||
    ""
  ).trim();
}

export function hasOcrSpaceKey(): boolean {
  return Boolean(getOcrSpaceApiKey());
}

export function ocrSpaceProviderInfo() {
  return {
    provider: hasOcrSpaceKey() ? ("ocrspace" as const) : ("none" as const),
    configured: hasOcrSpaceKey(),
  };
}

type OcrSpaceApiResponse = {
  ParsedResults?: Array<{
    ParsedText?: string;
    FileParseExitCode?: number;
    ErrorMessage?: string | string[] | null;
    TextOverlay?: { Lines?: unknown[] };
  }>;
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[] | null;
  ErrorDetails?: string | null;
  ProcessingTimeInMilliseconds?: string | number;
  SearchablePDFURL?: string;
};

function asErrorText(v: string | string[] | null | undefined): string {
  if (!v) return "";
  if (Array.isArray(v)) return v.filter(Boolean).join("; ");
  return String(v);
}

function decideAction(text: string, exitCode: number, errored: boolean): OcrSpaceResult["action"] {
  if (errored || exitCode === 3 || exitCode === 4) return "retake";
  if (!text.trim()) return "retake";
  // Exit 2 = partial success on free tier sometimes
  if (exitCode === 2 || text.trim().length < 24) return "review";
  return "accept";
}

/**
 * Call OCR.space with raw image bytes (JPEG/PNG/…).
 */
export async function ocrSpaceFromBytes(
  bytes: ArrayBuffer | Uint8Array,
  opts: { filename?: string; mimeType?: string; language?: string } = {},
): Promise<OcrSpaceResult> {
  const apiKey = getOcrSpaceApiKey();
  if (!apiKey) {
    throw new Error("OCR.space is not configured. Set OCR_SPACE_API_KEY on the server.");
  }

  const filename = opts.filename || "scan.jpg";
  const mimeType = opts.mimeType || "image/jpeg";
  const language = opts.language || process.env.OCR_SPACE_LANGUAGE || "eng";
  const requestId = `ocrspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const part: BlobPart =
    bytes instanceof ArrayBuffer ? bytes : new Uint8Array(bytes);
  const blob = new Blob([part], { type: mimeType });

  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", language);
  form.append("isOverlayRequired", "false");
  form.append("detectOrientation", "true");
  form.append("scale", "true");
  form.append("OCREngine", process.env.OCR_SPACE_ENGINE || "2");
  form.append("file", blob, filename);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(OCR_SPACE_URL, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    let json: OcrSpaceApiResponse;
    try {
      json = (await res.json()) as OcrSpaceApiResponse;
    } catch {
      throw new Error(`OCR.space returned invalid JSON (HTTP ${res.status})`);
    }

    if (!res.ok && !json?.ParsedResults) {
      throw new Error(
        asErrorText(json?.ErrorMessage) || `OCR.space HTTP ${res.status}`,
      );
    }

    return mapOcrSpaceResponse(json, requestId);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("OCR.space request timed out.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call OCR.space with a data-URL or raw base64 string.
 */
export async function ocrSpaceFromBase64(
  base64OrDataUrl: string,
  opts: { language?: string } = {},
): Promise<OcrSpaceResult> {
  const apiKey = getOcrSpaceApiKey();
  if (!apiKey) {
    throw new Error("OCR.space is not configured. Set OCR_SPACE_API_KEY on the server.");
  }

  const language = opts.language || process.env.OCR_SPACE_LANGUAGE || "eng";
  const requestId = `ocrspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  let base64Image = base64OrDataUrl.trim();
  if (!base64Image.startsWith("data:")) {
    base64Image = `data:image/jpeg;base64,${base64Image}`;
  }

  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", language);
  form.append("isOverlayRequired", "false");
  form.append("detectOrientation", "true");
  form.append("scale", "true");
  form.append("OCREngine", process.env.OCR_SPACE_ENGINE || "2");
  form.append("base64Image", base64Image);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(OCR_SPACE_URL, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    const json = (await res.json()) as OcrSpaceApiResponse;
    if (!res.ok && !json?.ParsedResults) {
      throw new Error(asErrorText(json?.ErrorMessage) || `OCR.space HTTP ${res.status}`);
    }
    return mapOcrSpaceResponse(json, requestId);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("OCR.space request timed out.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

function mapOcrSpaceResponse(json: OcrSpaceApiResponse, requestId: string): OcrSpaceResult {
  const exitCode = Number(json.OCRExitCode ?? 0);
  const errored = Boolean(json.IsErroredOnProcessing);
  const topError = asErrorText(json.ErrorMessage) || asErrorText(json.ErrorDetails);

  const texts = (json.ParsedResults ?? [])
    .map((p) => String(p.ParsedText ?? "").trim())
    .filter(Boolean);
  const text = texts.join("\n\n").trim();

  const parseErrors = (json.ParsedResults ?? [])
    .map((p) => asErrorText(p.ErrorMessage))
    .filter(Boolean);

  const action = decideAction(text, exitCode, errored);
  const error = topError || parseErrors.join("; ") || null;

  if (errored && !text) {
    return {
      text: "",
      confidence: -1,
      engine: "ocrspace",
      action: "retake",
      message: error || "OCR.space could not process this image.",
      requestId,
      rawExitCode: exitCode,
      error,
      errorCode: "ocr_failed",
    };
  }

  if (!text) {
    return {
      text: "",
      confidence: -1,
      engine: "ocrspace",
      action: "retake",
      message: error || "No text found. Retake with better lighting and focus.",
      requestId,
      rawExitCode: exitCode,
      error,
      errorCode: "no_text",
    };
  }

  // OCR.space free API does not always return a real confidence score
  const confidence = action === "accept" ? 85 : action === "review" ? 60 : -1;

  return {
    text,
    confidence,
    engine: "ocrspace",
    action,
    message:
      action === "accept"
        ? "Text extracted via OCR.space."
        : action === "review"
          ? "Text extracted — please review before analyzing."
          : "Hard to read this image.",
    requestId,
    rawExitCode: exitCode,
    error: null,
    errorCode: null,
  };
}
