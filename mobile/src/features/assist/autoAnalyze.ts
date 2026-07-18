/**
 * Auto-analyze helpers for Floating Assist.
 * - Clipboard text
 * - Screen capture taken BY TrustLens (MediaProjection) — user does not screenshot manually
 */
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";
import FloatingAssistNative, { isNativeLinked } from "trustlens-floating-assist";
import { prepareImageForAnalysis } from "@/src/lib/image-prep";
import { uriToJpegBytes } from "@/src/lib/image-upload";
import { recognizeTextFromImageUri } from "@/src/lib/ocr";
import { ensureConsent, submitVerification } from "@/src/lib/verify/submit";
import { getApiBaseUrl } from "@/src/lib/config";
import { db } from "@/src/lib/db";
import type { TrustCategory } from "@/src/lib/types/analysis";

export type AssistSource = "clipboard" | "capture" | "gallery";

export type AssistStructuredResult = {
  requestId: string;
  trustScore: number;
  category: TrustCategory;
  confidence: number;
  summary: string;
  concerns: string[];
  evidence: string[];
  nextSteps: string[];
  source: AssistSource;
  preview?: string;
};

async function loadResult(requestId: string, userId: string) {
  const { data } = await db
    .from("verification_results")
    .select(
      "trust_score, category, confidence, summary, concerns, evidence, next_steps",
    )
    .eq("request_id", requestId)
    .eq("user_id", userId)
    .maybeSingle();
  return data as {
    trust_score: number;
    category: TrustCategory;
    confidence: number;
    summary: string;
    concerns: string[] | null;
    evidence: string[] | null;
    next_steps: string[] | null;
  } | null;
}

function toFileUri(path: string): string {
  if (path.startsWith("file://") || path.startsWith("content://") || path.startsWith("http")) {
    return path;
  }
  // Android absolute path from native capture
  return path.startsWith("/") ? `file://${path}` : `file:///${path}`;
}

export async function analyzeClipboardText(
  userId: string,
  _aiConsent: boolean,
): Promise<AssistStructuredResult> {
  const text = (await Clipboard.getStringAsync()).trim();
  if (!text || text.length < 8) {
    throw new Error(
      "Clipboard is empty or too short. On Facebook, long-press the post text → Copy, then try again.",
    );
  }

  // User explicitly started analysis → record consent for this action
  await ensureConsent(userId, true);

  const isUrl = /^https?:\/\//i.test(text);
  const requestId = await submitVerification(
    userId,
    isUrl
      ? { type: "url", input_url: text }
      : { type: "text", input_text: text.slice(0, 5000) },
  );

  const row = await loadResult(requestId, userId);
  if (!row) {
    return {
      requestId,
      trustScore: 0,
      category: "needs_verification",
      confidence: 0,
      summary: "Analysis saved, but details could not be loaded.",
      concerns: [],
      evidence: [],
      nextSteps: [],
      source: "clipboard",
      preview: text.slice(0, 120),
    };
  }

  return {
    requestId,
    trustScore: row.trust_score,
    category: row.category,
    confidence: row.confidence,
    summary: row.summary,
    concerns: row.concerns ?? [],
    evidence: row.evidence ?? [],
    nextSteps: row.next_steps ?? [],
    source: "clipboard",
    preview: text.slice(0, 120),
  };
}

/**
 * Analyze an image already captured by TrustLens (native path) or a gallery fallback URI.
 */
export async function analyzeCapturedImage(
  userId: string,
  _aiConsent: boolean,
  imagePath: string,
  source: AssistSource = "capture",
): Promise<AssistStructuredResult> {
  const uri = toFileUri(imagePath);
  let prepared: string;
  try {
    prepared = await prepareImageForAnalysis(uri);
  } catch (e) {
    throw new Error(
      `Could not prepare image: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  const ocr = await recognizeTextFromImageUri(prepared);
  await ensureConsent(userId, true);

  const imageName =
    source === "capture" ? "trustlens-screen-capture.jpg" : "imported-image.jpg";

  // Fast path: enough text extracted → analyze as text (no storage upload)
  if (ocr.text.trim().length >= 10) {
    try {
      const requestId = await submitVerification(userId, {
        type: "text",
        input_text: ocr.text.trim().slice(0, 5000),
        imageName,
      });
      const row = await loadResult(requestId, userId);
      return {
        requestId,
        trustScore: row?.trust_score ?? 0,
        category: row?.category ?? "needs_verification",
        confidence: row?.confidence ?? 0,
        summary: row?.summary ?? "Analysis complete.",
        concerns: row?.concerns ?? [],
        evidence: row?.evidence ?? [],
        nextSteps: row?.next_steps ?? [],
        source,
        preview: ocr.text.trim().slice(0, 120),
      };
    } catch (e) {
      throw wrapNetworkError(e, "analyze API");
    }
  }

  // Image path: upload bytes (not Blob) — Blob/fetch(file://) causes "Network request failed"
  let uploadedId: string | undefined;
  try {
    const { body, size } = await uriToJpegBytes(prepared);
    const path = `${userId}/${Date.now()}-${imageName.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    const { error: upErr } = await db.storage.from("verification-uploads").upload(path, body, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (upErr) {
      throw new Error(
        upErr.message?.includes("Network")
          ? `Upload failed (network). Check internet and Supabase storage. (${upErr.message})`
          : upErr.message || "Upload failed",
      );
    }
    const { data: uploaded, error: upDbErr } = await db
      .from("uploaded_content")
      .insert({
        user_id: userId,
        storage_path: path,
        mime_type: "image/jpeg",
        size_bytes: size,
      })
      .select()
      .single();
    if (upDbErr) throw new Error(upDbErr.message || "Failed to save upload record");
    uploadedId = uploaded?.id;
  } catch (e) {
    throw wrapNetworkError(e, "image upload / Supabase storage");
  }

  try {
    const requestId = await submitVerification(userId, {
      type: "image",
      imageName,
      uploaded_content_id: uploadedId,
    });
    const row = await loadResult(requestId, userId);
    return {
      requestId,
      trustScore: row?.trust_score ?? 0,
      category: row?.category ?? "needs_verification",
      confidence: row?.confidence ?? 0,
      summary: row?.summary ?? "Analysis complete.",
      concerns: row?.concerns ?? [],
      evidence: row?.evidence ?? [],
      nextSteps: row?.next_steps ?? [],
      source,
      preview: imageName,
    };
  } catch (e) {
    throw wrapNetworkError(e, "analyze API");
  }
}

function wrapNetworkError(e: unknown, where: string): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (/network request failed/i.test(msg)) {
    const api = getApiBaseUrl() || "(API URL not set)";
    return new Error(
      `Network request failed while doing ${where}.\n` +
        `Phone needs internet.\n` +
        `Analyze API: ${api}\n` +
        `If this is a capture, OCR may be missing — try “Copied text” as a fallback.`,
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

/**
 * Preferred path: TrustLens captures the screen itself (native MediaProjection).
 * Returns "started" when the native capture activity was launched (result arrives via deep link).
 * If [existingPath] is already set (from deep link), analyzes immediately.
 */
export async function captureAndAnalyze(
  userId: string,
  aiConsent: boolean,
  existingPath?: string | null,
): Promise<AssistStructuredResult | { started: true }> {
  if (existingPath?.trim()) {
    return analyzeCapturedImage(userId, aiConsent, existingPath.trim(), "capture");
  }

  if (Platform.OS === "android" && isNativeLinked()) {
    await FloatingAssistNative.captureScreen();
    return { started: true };
  }

  throw new Error(
    "Expo Go cannot screenshot other apps (Android security). " +
      "Install the TrustLens app from your PC:\n\n" +
      "1. USB-connect this phone (USB debugging on)\n" +
      "2. In the mobile folder run:  npm run android\n" +
      "3. Open the TrustLensAI app (not Expo Go)\n" +
      "4. Profile → enable Floating Assist → Analyze content on my screen\n\n" +
      "Until then: use “Copied text” or “Pick a photo”.",
  );
}

/** Gallery fallback when native capture is unavailable (Expo Go / web demo). */
export async function analyzeFromGallery(
  userId: string,
  aiConsent: boolean,
): Promise<AssistStructuredResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Photo access is needed to pick an image for verification.");
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.85,
    allowsEditing: false,
  });

  if (picked.canceled || !picked.assets?.[0]) {
    throw new Error("No image selected.");
  }

  return analyzeCapturedImage(userId, aiConsent, picked.assets[0].uri, "gallery");
}

/** @deprecated Use captureAndAnalyze — kept for old deep links action=screenshot */
export async function analyzeScreenshot(
  userId: string,
  aiConsent: boolean,
  path?: string | null,
): Promise<AssistStructuredResult | { started: true }> {
  if (path?.trim()) {
    return analyzeCapturedImage(userId, aiConsent, path.trim(), "capture");
  }
  return captureAndAnalyze(userId, aiConsent);
}
