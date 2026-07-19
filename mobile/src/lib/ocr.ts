/**
 * Text extraction from still images.
 *
 * Priority:
 *  1. OCR.space (via TrustLens /api/ocr or EXPO_PUBLIC_OCR_SPACE_API_KEY)
 *  2. UNESCO OCR microservice (EXPO_PUBLIC_OCR_URL) — optional local Tesseract
 *  3. Optional on-device ML Kit / expo-text-recognition
 *  4. none → user types caption manually
 *
 * Still-image only — never continuous OCR.
 */
import {
  createOcrClient,
  messageForAction,
  type OcrAction,
  type OcrFields,
} from "@/src/lib/unesco-ocr";
import { getOcrApiKey, getOcrBaseUrl, hasOcrEnv } from "@/src/lib/config";
import { isOcrSpaceAvailable, recognizeWithOcrSpace } from "@/src/lib/ocrspace";

export type OcrEngine = "ocrspace" | "unesco" | "native" | "none";

export type OcrResult = {
  text: string;
  engine: OcrEngine;
  action?: OcrAction;
  confidence?: number;
  message?: string;
  requestId?: string;
  fields?: OcrFields;
  error?: string | null;
  errorCode?: string | null;
};

let cachedClient: ReturnType<typeof createOcrClient> | null = null;
let cachedBase: string | null = null;

function getUnescoClient() {
  const base = getOcrBaseUrl();
  if (!base) return null;
  if (cachedClient && cachedBase === base) return cachedClient;
  cachedBase = base;
  cachedClient = createOcrClient({
    baseUrl: base,
    apiKey: getOcrApiKey(),
    timeoutMs: 45_000,
  });
  return cachedClient;
}

async function tryOcrSpace(uri: string): Promise<OcrResult | null> {
  if (!isOcrSpaceAvailable()) return null;
  try {
    const res = await recognizeWithOcrSpace(uri);
    return {
      text: res.text,
      engine: "ocrspace",
      action: res.action,
      confidence: res.confidence,
      message: res.message,
      requestId: res.requestId,
      error: res.error,
      errorCode: res.errorCode,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[ocr] OCR.space failed:", msg);
    return {
      text: "",
      engine: "none",
      action: "retake",
      message: `OCR.space unreachable (${msg}). Check API base URL / API key.`,
      error: msg,
      errorCode: "ocrspace_unreachable",
    };
  }
}

async function tryUnescoOcr(uri: string): Promise<OcrResult | null> {
  const client = getUnescoClient();
  if (!client) return null;

  try {
    const res = await client.recognize(
      { uri, name: "scan.jpg", type: "image/jpeg" },
      { preset: "auto", lang: "auto" },
    );

    const text = String(res.text ?? "").trim();
    const action = res.action || (text ? "review" : "retake");

    return {
      text,
      engine: "unesco",
      action,
      confidence: typeof res.confidence === "number" ? res.confidence : undefined,
      message:
        res.error?.trim() ||
        messageForAction(action) ||
        (text ? "Text extracted — review before analyzing." : "No text found."),
      requestId: res.request_id,
      fields: res.fields,
      error: res.error,
      errorCode: res.error_code,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[ocr] UNESCO service failed:", msg);
    return {
      text: "",
      engine: "none",
      action: "retake",
      message: `UNESCO OCR unreachable (${msg}).`,
      error: msg,
      errorCode: "ocr_unreachable",
    };
  }
}

async function tryNativeOcr(uri: string): Promise<OcrResult | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MlKit = require("@react-native-ml-kit/text-recognition");
    if (MlKit?.default?.recognize) {
      const result = await MlKit.default.recognize(uri);
      const text = String(result?.text ?? "").trim();
      if (text) {
        return {
          text,
          engine: "native",
          action: "review",
          message: "Text extracted on-device — edit if needed.",
        };
      }
    }
  } catch {
    /* not installed */
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const alt = require("expo-text-recognition");
    if (alt?.recognizeText) {
      const text = String(await alt.recognizeText(uri)).trim();
      if (text) {
        return {
          text,
          engine: "native",
          action: "review",
          message: "Text extracted on-device — edit if needed.",
        };
      }
    }
  } catch {
    /* Expo Go */
  }

  return null;
}

/** True when any cloud OCR path is configured (OCR.space or UNESCO). */
export function isUnescoOcrConfigured(): boolean {
  return isOcrSpaceAvailable() || hasOcrEnv();
}

export function isCloudOcrConfigured(): boolean {
  return isOcrSpaceAvailable() || hasOcrEnv();
}

export async function recognizeTextFromImageUri(uri: string): Promise<OcrResult> {
  // 1) OCR.space (primary hosted path)
  if (isOcrSpaceAvailable()) {
    const space = await tryOcrSpace(uri);
    if (space) {
      if (space.engine === "ocrspace" && space.text.trim().length > 0) {
        return space;
      }
      // Soft fallbacks if empty / retake
      if (hasOcrEnv()) {
        const unesco = await tryUnescoOcr(uri);
        if (unesco?.text) return unesco;
      }
      const nativeAfter = await tryNativeOcr(uri);
      if (nativeAfter?.text) return nativeAfter;
      return space;
    }
  }

  // 2) UNESCO local Tesseract server (optional)
  if (hasOcrEnv()) {
    const unesco = await tryUnescoOcr(uri);
    if (unesco) {
      if (unesco.engine === "unesco" && unesco.text.trim().length > 0) {
        return unesco;
      }
      const nativeAfter = await tryNativeOcr(uri);
      if (nativeAfter?.text) return nativeAfter;
      return unesco;
    }
  }

  // 3) Optional on-device
  const native = await tryNativeOcr(uri);
  if (native?.text) return native;

  // 4) Manual
  const hasAnyCloud = isOcrSpaceAvailable() || hasOcrEnv();
  return {
    text: "",
    engine: "none",
    action: "retake",
    message: hasAnyCloud
      ? "No text found. Retake with better lighting, or type the caption below."
      : "OCR not configured. Set OCR_SPACE_API_KEY on the server (and EXPO_PUBLIC_API_BASE_URL), or type the caption.",
  };
}

