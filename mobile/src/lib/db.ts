/**
 * Mobile data layer: Supabase by default (auth + tables + storage).
 * Optional sqlite local client only if EXPO_PUBLIC_DB_PROVIDER=sqlite.
 */
import { getDbProvider, hasSupabaseEnv, getApiBaseUrl } from "./config";
import { localClient } from "./local-client";
import { supabase as supabaseCloud } from "./supabase";

export const dbProvider = getDbProvider();
export const isSqlite = dbProvider === "sqlite";
export const isSupabase = !isSqlite;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = isSqlite ? localClient : supabaseCloud;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = db;

export function isBackendConfigured(): boolean {
  if (isSqlite) return Boolean(getApiBaseUrl());
  return hasSupabaseEnv();
}

export function backendLabel(): string {
  if (isSqlite) return `SQLite local API (${getApiBaseUrl() || "missing API URL"})`;
  if (!hasSupabaseEnv()) return "Supabase (missing EXPO_PUBLIC_SUPABASE_URL / ANON_KEY)";
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
  try {
    return `Supabase (${new URL(url).host})`;
  } catch {
    return "Supabase cloud";
  }
}
