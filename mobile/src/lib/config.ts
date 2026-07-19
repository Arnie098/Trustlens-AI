/** Shared env helpers for the mobile app. Supabase is the primary backend. */
import { Platform } from "react-native";

/** Rewrite localhost → 10.0.2.2 on Android emulator so host-machine services are reachable. */
function rewriteAndroidLoopback(url: string): string {
  if (Platform.OS === "android" && /:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(url)) {
    return url.replace(/:\/\/(localhost|127\.0\.0\.1)/i, "://10.0.2.2");
  }
  return url;
}

export function getApiBaseUrl(): string {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
  return rewriteAndroidLoopback(base);
}

/**
 * UNESCO OCR microservice (Tesseract server under D:\Hackaton\App\UNESCO\OCR\ocr-prototype).
 * Android emulator: http://10.0.2.2:5001 (or http://localhost:5001 — rewritten).
 * Physical device: http://<PC-LAN-IP>:5001
 */
export function getOcrBaseUrl(): string {
  const base = (process.env.EXPO_PUBLIC_OCR_URL || "").replace(/\/$/, "");
  return rewriteAndroidLoopback(base);
}

export function getOcrApiKey(): string | undefined {
  const key = (process.env.EXPO_PUBLIC_OCR_API_KEY || "").trim();
  return key || undefined;
}

export function hasOcrEnv(): boolean {
  return Boolean(getOcrBaseUrl());
}

/**
 * Optional client-side OCR.space key (hackathon/demo only — visible in the app bundle).
 * Prefer server OCR_SPACE_API_KEY + EXPO_PUBLIC_API_BASE_URL → POST /api/ocr.
 */
export function getOcrSpaceApiKey(): string {
  return (process.env.EXPO_PUBLIC_OCR_SPACE_API_KEY || "").trim();
}

export function hasOcrSpaceDirectKey(): boolean {
  return Boolean(getOcrSpaceApiKey());
}

export function hasSupabaseEnv(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Mobile always uses Supabase for auth + DB.
 * Analyze still goes to EXPO_PUBLIC_API_BASE_URL (deployed or local web server).
 *
 * EXPO_PUBLIC_DB_PROVIDER=sqlite is only for rare offline/local hacks — not the default.
 */
export function getDbProvider(): "sqlite" | "supabase" {
  const explicit = (process.env.EXPO_PUBLIC_DB_PROVIDER || "").toLowerCase();
  if (explicit === "sqlite") return "sqlite";
  // Default and recommended: Supabase
  return "supabase";
}
