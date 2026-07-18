/** Shared env helpers for the mobile app. Supabase is the primary backend. */
import { Platform } from "react-native";

export function getApiBaseUrl(): string {
  let base = (process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");
  // Android emulator cannot reach the host machine via "localhost"
  if (Platform.OS === "android" && /:\/\/(localhost|127\.0\.0\.1)([:/]|$)/i.test(base)) {
    base = base.replace(/:\/\/(localhost|127\.0\.0\.1)/i, "://10.0.2.2");
  }
  return base;
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
