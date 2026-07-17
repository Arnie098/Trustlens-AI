// Database access layer.
// Default: local SQLite (data/trustlens.db via /api/local/*).
// Switch to Supabase: set VITE_DB_PROVIDER=supabase and Supabase env vars.

import { localClient } from "@/lib/sqlite/client";
import { supabase as supabaseCloud } from "@/integrations/supabase/client";

export type TrustCategory =
  | "high_trust"
  | "needs_verification"
  | "low_confidence"
  | "potentially_misleading";

export type DbProvider = "sqlite" | "supabase";

function readProvider(): DbProvider {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_DB_PROVIDER) ||
    (typeof process !== "undefined" && process.env?.VITE_DB_PROVIDER) ||
    (typeof process !== "undefined" && process.env?.DB_PROVIDER) ||
    "sqlite";
  return raw === "supabase" ? "supabase" : "sqlite";
}

export const dbProvider: DbProvider = readProvider();
export const isSqlite = dbProvider === "sqlite";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = isSqlite ? localClient : supabaseCloud;

// Loose typing until types.ts is regenerated for the active provider.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db: any = supabase;
