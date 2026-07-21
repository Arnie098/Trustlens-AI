/**
 * OCR.space client for VeriSphere mobile (JavaScript/TypeScript).
 *
 * Preferred: call VeriSphere web API POST /api/ocr (key stays on server).
 * Optional: direct OCR.space with EXPO_PUBLIC_OCR_SPACE_API_KEY (less secure).
 *
 * Docs: https://ocr.space/ocrapi
 */
import { Platform } from "react-native";
import { getApiBaseUrl, getOcrSpaceApiKey, hasOcrSpaceDirectKey } from "@/src/lib/config";
import { appendImageField, imageUriToBase64 } from "@/src/lib/image-form";
import type { OcrAction } from "@/src/lib/unesco-ocr";

const OCR_SPACE_URL = "https://api.ocr.space/parse/image";

export type OcrSpaceClientResult = {
  text: string;
  confidence: number;
  action: OcrAction;
  message: string;
  requestId?: string;
  error?: string | null;
  errorCode?: string | null;
};

type ApiOcrData = {
  text: string;
  confidence: number;
  action: OcrAction;
  message: string;
  requestId?: string;
  error?: string | null;
  errorCode?: string | null;
};

export function isOcrSpaceAvailable(): boolean {
  return Boolean(getApiBaseUrl()) || hasOcrSpaceDirectKey();
}

/**
 * Run OCR.space on a local image URI (file://, content://, blob:, …).
 */
export async function recognizeWithOcrSpace(uri: string): Promise<OcrSpaceClientResult> {
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    try {
      return await recognizeViaTrustlensApi(apiBase, uri);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Web multipart sometimes fails — try JSON base64 to same server
      if (Platform.OS === "web" || /failed to fetch|network|multipart|formdata/i.test(msg)) {
        try {
          return await recognizeViaTrustlensJson(apiBase, uri);
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          if (hasOcrSpaceDirectKey()) {
            return recognizeDirectOcrSpace(uri);
          }
          throw new Error(msg2 || msg);
        }
      }
      if (hasOcrSpaceDirectKey() && /not configured|503|OCR.space is not configured/i.test(msg)) {
        return recognizeDirectOcrSpace(uri);
      }
      throw e;
    }
  }

  if (hasOcrSpaceDirectKey()) {
    return recognizeDirectOcrSpace(uri);
  }

  throw new Error(
    "OCR.space needs EXPO_PUBLIC_API_BASE_URL (server proxy) or EXPO_PUBLIC_OCR_SPACE_API_KEY.",
  );
}

async function recognizeViaTrustlensApi(
  apiBase: string,
  uri: string,
): Promise<OcrSpaceClientResult> {
  const form = new FormData();
  await appendImageField(form, "image", uri, { name: "scan.jpg", type: "image/jpeg" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(`${apiBase}/api/ocr`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    let json: { data?: ApiOcrData; error?: { message: string } };
    try {
      json = (await res.json()) as { data?: ApiOcrData; error?: { message: string } };
    } catch {
      throw new Error(`OCR API invalid response (HTTP ${res.status}) at ${apiBase}/api/ocr`);
    }

    if (!res.ok || !json.data) {
      throw new Error(json.error?.message || `OCR failed (HTTP ${res.status})`);
    }

    return mapApiData(json.data);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("OCR request timed out.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON base64 path — more reliable on Expo web than RN-style FormData. */
async function recognizeViaTrustlensJson(
  apiBase: string,
  uri: string,
): Promise<OcrSpaceClientResult> {
  const b64 = await imageUriToBase64(uri);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${apiBase}/api/ocr`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ base64: `data:image/jpeg;base64,${b64}` }),
      signal: controller.signal,
    });
    const json = (await res.json()) as { data?: ApiOcrData; error?: { message: string } };
    if (!res.ok || !json.data) {
      throw new Error(json.error?.message || `OCR failed (HTTP ${res.status})`);
    }
    return mapApiData(json.data);
  } finally {
    clearTimeout(timer);
  }
}

function mapApiData(data: ApiOcrData): OcrSpaceClientResult {
  return {
    text: String(data.text ?? "").trim(),
    confidence: Number(data.confidence ?? -1),
    action: data.action || (data.text ? "review" : "retake"),
    message: data.message || "OCR.space result",
    requestId: data.requestId,
    error: data.error,
    errorCode: data.errorCode,
  };
}

/**
 * Direct call to api.ocr.space — uses EXPO_PUBLIC_OCR_SPACE_API_KEY.
 * Prefer server proxy in production so the key is not in the APK.
 */
async function recognizeDirectOcrSpace(uri: string): Promise<OcrSpaceClientResult> {
  const apiKey = getOcrSpaceApiKey();
  if (!apiKey) {
    throw new Error("Missing EXPO_PUBLIC_OCR_SPACE_API_KEY");
  }

  const form = new FormData();
  form.append("apikey", apiKey);
  form.append("language", process.env.EXPO_PUBLIC_OCR_SPACE_LANGUAGE || "eng");
  form.append("isOverlayRequired", "false");
  form.append("detectOrientation", "true");
  form.append("scale", "true");
  form.append("OCREngine", process.env.EXPO_PUBLIC_OCR_SPACE_ENGINE || "2");
  await appendImageField(form, "file", uri, { name: "scan.jpg", type: "image/jpeg" });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);

  try {
    const res = await fetch(OCR_SPACE_URL, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    const json = (await res.json()) as {
      ParsedResults?: Array<{ ParsedText?: string; ErrorMessage?: string | string[] }>;
      OCRExitCode?: number;
      IsErroredOnProcessing?: boolean;
      ErrorMessage?: string | string[] | null;
    };

    const text = (json.ParsedResults ?? [])
      .map((p) => String(p.ParsedText ?? "").trim())
      .filter(Boolean)
      .join("\n\n")
      .trim();

    const errMsg = Array.isArray(json.ErrorMessage)
      ? json.ErrorMessage.join("; ")
      : String(json.ErrorMessage || "");

    if (json.IsErroredOnProcessing && !text) {
      return {
        text: "",
        confidence: -1,
        action: "retake",
        message: errMsg || "OCR.space could not process this image.",
        error: errMsg,
        errorCode: "ocr_failed",
      };
    }

    if (!text) {
      return {
        text: "",
        confidence: -1,
        action: "retake",
        message: errMsg || "No text found. Retake with better lighting.",
        error: errMsg || null,
        errorCode: "no_text",
      };
    }

    const exit = Number(json.OCRExitCode ?? 1);
    const action: OcrAction = exit === 2 || text.length < 24 ? "review" : "accept";

    return {
      text,
      confidence: action === "accept" ? 85 : 60,
      action,
      message:
        action === "accept"
          ? "Text extracted via OCR.space."
          : "Text extracted — please review before analyzing.",
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("OCR.space request timed out.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
