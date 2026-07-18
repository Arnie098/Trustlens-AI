/**
 * Still-image OCR only (design §18).
 * One prepared bitmap per call; cancelable; never continuous/live multi-frame OCR.
 */
import { prepareImageForAnalysis } from "@/lib/mobile/image-pipeline";
import { isNativePlatform } from "@/lib/mobile/bridge";

export type OcrEngine = "native" | "none";

export type OcrResult = {
  text: string;
  engine: OcrEngine;
};

export class OcrCancelledError extends Error {
  constructor() {
    super("OCR cancelled");
    this.name = "OcrCancelledError";
  }
}

type NativeOcrHost = {
  recognizeTextFromPath?: (path: string) => Promise<string | { text?: string }>;
  recognizeText?: (opts: { path?: string; base64?: string }) => Promise<string | { text?: string }>;
};

type CapacitorPlugins = {
  TextRecognition?: {
    recognizeText?: (opts: {
      path?: string;
    }) => Promise<{ text?: string; results?: Array<{ text?: string; blockText?: string }> }>;
  };
  MlKitTextRecognition?: {
    recognizeText?: (opts: {
      path?: string;
    }) => Promise<{ text?: string; results?: Array<{ text?: string }> }>;
  };
};

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new OcrCancelledError();
}

function extractText(raw: unknown): string {
  if (raw == null) return "";
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "object") {
    const o = raw as {
      text?: string;
      value?: string;
      results?: Array<{ text?: string; blockText?: string }>;
    };
    if (typeof o.text === "string" && o.text.trim()) return o.text.trim();
    if (typeof o.value === "string" && o.value.trim()) return o.value.trim();
    if (Array.isArray(o.results)) {
      return o.results
        .map((r) => r.text || r.blockText || "")
        .filter(Boolean)
        .join("\n")
        .trim();
    }
  }
  return "";
}

/**
 * Best-effort native OCR via injected bridge or Capacitor Plugins registry.
 * Plugins are optional — missing modules return engine "none" (manual caption).
 */
async function tryNativeOcr(objectUrl: string, signal?: AbortSignal): Promise<OcrResult | null> {
  throwIfAborted(signal);
  if (typeof window === "undefined") return null;

  const host = (window as unknown as { TrustLensNative?: NativeOcrHost }).TrustLensNative;
  if (host?.recognizeTextFromPath) {
    throwIfAborted(signal);
    const raw = await host.recognizeTextFromPath(objectUrl);
    throwIfAborted(signal);
    return { text: extractText(raw), engine: "native" };
  }
  if (host?.recognizeText) {
    throwIfAborted(signal);
    const raw = await host.recognizeText({ path: objectUrl });
    throwIfAborted(signal);
    return { text: extractText(raw), engine: "native" };
  }

  if (!isNativePlatform()) return null;

  const plugins = (
    window as unknown as {
      Capacitor?: { Plugins?: CapacitorPlugins };
    }
  ).Capacitor?.Plugins;

  const plugin = plugins?.TextRecognition ?? plugins?.MlKitTextRecognition;
  if (plugin?.recognizeText) {
    throwIfAborted(signal);
    const raw = await plugin.recognizeText({ path: objectUrl });
    throwIfAborted(signal);
    return { text: extractText(raw), engine: "native" };
  }

  return null;
}

/**
 * Recognize text from a still image blob.
 * 1) prepareImageForAnalysis (downscale/compress)
 * 2) native plugin if available
 * 3) else empty string — user edits caption manually
 */
export async function recognizeTextFromBlob(
  fileOrBlob: Blob,
  opts?: {
    signal?: AbortSignal;
    /** already prepared — skip second downscale */ prepared?: boolean;
  },
): Promise<OcrResult> {
  const signal = opts?.signal;
  throwIfAborted(signal);

  const blob = opts?.prepared ? fileOrBlob : (await prepareImageForAnalysis(fileOrBlob)).blob;

  throwIfAborted(signal);

  const objectUrl = URL.createObjectURL(blob);
  try {
    const native = await tryNativeOcr(objectUrl, signal);
    if (native) return native;
    return { text: "", engine: "none" };
  } catch (e) {
    if (e instanceof OcrCancelledError) throw e;
    console.warn("[ocr] native recognition failed:", e);
    return { text: "", engine: "none" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
