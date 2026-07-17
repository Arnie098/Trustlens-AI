/**
 * Server-only SQLite access for local dev.
 * Mirrors public Supabase tables; swap to Supabase by setting VITE_DB_PROVIDER=supabase.
 */
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { BOOLEAN_COLUMNS, EMBEDS, JSON_COLUMNS, TABLES_WITH_ID } from "./meta";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "../../..");
const DATA_DIR = join(ROOT, "data");
const DB_PATH = join(DATA_DIR, "trustlens.db");
const UPLOADS_DIR = join(DATA_DIR, "uploads");
const SCHEMA_PATH = join(ROOT, "sqlite", "schema.sql");
const SEED_PATH = join(ROOT, "sqlite", "seed.sql");

const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

let db: DatabaseSync | null = null;

export function getSqliteDb(): DatabaseSync {
  if (db) return db;
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });

  const isNew = !existsSync(DB_PATH);
  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  if (isNew) {
    db.exec(readFileSync(SEED_PATH, "utf8"));
    console.info(`[sqlite] Created and seeded ${DB_PATH}`);
  }
  // Ensure sessions table exists on older DBs without reset
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_agent TEXT,
      revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1))
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
  `);
  return db;
}

/** scrypt$saltB64$hashB64 — preferred. Legacy sha256 hex still accepted. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "base64url");
    const expected = Buffer.from(parts[2], "base64url");
    const actual = scryptSync(password, salt, expected.length);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  // Legacy sha256 from earlier seeds
  const legacy = createHash("sha256").update(`trustlens:${password}`).digest("hex");
  try {
    const a = Buffer.from(legacy, "utf8");
    const b = Buffer.from(stored, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return legacy === stored;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── row transform ──────────────────────────────────────────────

function encodeValue(key: string, value: unknown): unknown {
  if (value === undefined) return undefined;
  if (BOOLEAN_COLUMNS.has(key)) {
    if (value === null) return null;
    return value === true || value === 1 || value === "1" ? 1 : 0;
  }
  if (JSON_COLUMNS.has(key)) {
    if (value === null || value === undefined) return value ?? null;
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  return value;
}

function decodeRow(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (BOOLEAN_COLUMNS.has(k)) {
      out[k] = v === 1 || v === true || v === "1";
    } else if (JSON_COLUMNS.has(k) && typeof v === "string") {
      try {
        out[k] = JSON.parse(v);
      } catch {
        out[k] = v;
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function decodeRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map((r) => decodeRow(r)!);
}

// ── select parsing ─────────────────────────────────────────────

interface ParsedSelect {
  columns: string; // SQL column list for main table
  embeds: { name: string; columns: string }[];
}

function parseSelect(select: string | undefined): ParsedSelect {
  if (!select || select.trim() === "*") {
    return { columns: "*", embeds: [] };
  }

  const embeds: { name: string; columns: string }[] = [];
  let rest = select;

  // Match relation(cols) tokens — non-greedy inner
  const embedRe = /([a-zA-Z_][a-zA-Z0-9_]*)\(([^)]*)\)/g;
  rest = rest.replace(embedRe, (_m, name: string, cols: string) => {
    embeds.push({ name, columns: cols.trim() || "*" });
    return "";
  });

  const mainCols = rest
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");

  return { columns: mainCols || "*", embeds };
}

function quoteIdent(id: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(id)) {
    throw new Error(`Invalid identifier: ${id}`);
  }
  return `"${id}"`;
}

function assertTable(table: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table: ${table}`);
  }
  return table;
}

// ── query ops ──────────────────────────────────────────────────

export type Filter =
  | { op: "eq"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] };

export interface QueryRequest {
  action: "select" | "insert" | "update" | "delete" | "upsert";
  table: string;
  select?: string;
  values?: Record<string, unknown> | Record<string, unknown>[];
  filters?: Filter[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  count?: "exact" | null;
  head?: boolean;
  single?: boolean;
  maybeSingle?: boolean;
  onConflict?: string;
  returning?: boolean;
}

export interface QueryResponse {
  data: unknown;
  error: { message: string } | null;
  count: number | null;
  status: number;
  statusText: string;
}

function applyFilters(filters: Filter[] | undefined): { sql: string; params: unknown[] } {
  if (!filters?.length) return { sql: "", params: [] };
  const parts: string[] = [];
  const params: unknown[] = [];
  for (const f of filters) {
    const col = quoteIdent(f.column);
    if (f.op === "eq") {
      parts.push(`${col} = ?`);
      params.push(encodeValue(f.column, f.value));
    } else if (f.op === "in") {
      if (!f.value.length) {
        parts.push("1 = 0");
      } else {
        parts.push(`${col} IN (${f.value.map(() => "?").join(", ")})`);
        for (const v of f.value) params.push(encodeValue(f.column, v));
      }
    }
  }
  return { sql: ` WHERE ${parts.join(" AND ")}`, params };
}

function attachEmbeds(
  database: DatabaseSync,
  table: string,
  rows: Record<string, unknown>[],
  embeds: { name: string; columns: string }[],
): void {
  if (!rows.length || !embeds.length) return;
  const tableEmbeds = EMBEDS[table] ?? {};

  for (const emb of embeds) {
    const def = tableEmbeds[emb.name];
    if (!def) continue;

    const keys = [...new Set(rows.map((r) => r[def.localKey]).filter((k) => k != null))];
    if (!keys.length) {
      for (const r of rows) r[emb.name] = def.many ? [] : null;
      continue;
    }

    const cols =
      emb.columns === "*"
        ? "*"
        : emb.columns
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean)
            .map(quoteIdent)
            .join(", ");

    const placeholders = keys.map(() => "?").join(", ");
    const sql = `SELECT ${cols === "*" ? "*" : cols} FROM ${quoteIdent(def.table)} WHERE ${quoteIdent(def.foreignKey)} IN (${placeholders})`;
    const related = decodeRows(
      database.prepare(sql).all(...keys) as Record<string, unknown>[],
    );

    const byFk = new Map<unknown, Record<string, unknown>[]>();
    for (const rel of related) {
      const fk = rel[def.foreignKey];
      if (!byFk.has(fk)) byFk.set(fk, []);
      byFk.get(fk)!.push(rel);
    }

    for (const r of rows) {
      const list = byFk.get(r[def.localKey]) ?? [];
      r[emb.name] = def.many ? list : (list[0] ?? null);
    }
  }
}

export function executeQuery(req: QueryRequest): QueryResponse {
  try {
    const database = getSqliteDb();
    const table = assertTable(req.table);

    if (req.action === "select") {
      return runSelect(database, table, req);
    }
    if (req.action === "insert") {
      return runInsert(database, table, req);
    }
    if (req.action === "update") {
      return runUpdate(database, table, req);
    }
    if (req.action === "delete") {
      return runDelete(database, table, req);
    }
    if (req.action === "upsert") {
      return runUpsert(database, table, req);
    }
    return fail("Unknown action");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[sqlite]", message);
    return fail(message);
  }
}

function ok(data: unknown, count: number | null = null): QueryResponse {
  return { data, error: null, count, status: 200, statusText: "OK" };
}

function fail(message: string): QueryResponse {
  return { data: null, error: { message }, count: null, status: 400, statusText: "Bad Request" };
}

function runSelect(database: DatabaseSync, table: string, req: QueryRequest): QueryResponse {
  const { columns, embeds } = parseSelect(req.select);
  const { sql: where, params } = applyFilters(req.filters);

  if (req.count === "exact" && req.head) {
    const row = database.prepare(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}${where}`).get(...params) as {
      c: number;
    };
    return ok(null, row.c);
  }

  let sql = `SELECT ${columns === "*" ? "*" : columns
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .map(quoteIdent)
    .join(", ")} FROM ${quoteIdent(table)}${where}`;

  // When selecting with embeds, we need full rows (at least keys). If columns are partial
  // but embeds need localKey, ensure keys exist — re-select * when embeds present.
  if (embeds.length) {
    sql = `SELECT * FROM ${quoteIdent(table)}${where}`;
  }

  if (req.order) {
    sql += ` ORDER BY ${quoteIdent(req.order.column)} ${req.order.ascending === false ? "DESC" : "ASC"}`;
  }
  if (req.limit != null) {
    sql += ` LIMIT ${Number(req.limit)}`;
  }

  let count: number | null = null;
  if (req.count === "exact") {
    const crow = database.prepare(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}${where}`).get(...params) as {
      c: number;
    };
    count = crow.c;
  }

  const raw = database.prepare(sql).all(...params) as Record<string, unknown>[];
  let rows = decodeRows(raw);
  attachEmbeds(database, table, rows, embeds);

  // If user asked for specific main columns (no embeds path already handled), project
  if (!embeds.length && columns !== "*" && !req.head) {
    const wanted = columns.split(",").map((c) => c.trim()).filter(Boolean);
    rows = rows.map((r) => {
      const o: Record<string, unknown> = {};
      for (const w of wanted) o[w] = r[w];
      return o;
    });
  }

  if (req.maybeSingle || req.single) {
    if (rows.length === 0) {
      if (req.single) return fail("JSON object requested, multiple (or no) rows returned");
      return ok(null, count);
    }
    if (rows.length > 1 && req.single) {
      return fail("JSON object requested, multiple (or no) rows returned");
    }
    return ok(rows[0], count);
  }

  return ok(rows, count);
}

function normalizeRows(
  values: Record<string, unknown> | Record<string, unknown>[] | undefined,
): Record<string, unknown>[] {
  if (!values) return [];
  return Array.isArray(values) ? values : [values];
}

function prepareInsertRow(table: string, row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    out[k] = encodeValue(k, v);
  }
  if (TABLES_WITH_ID.has(table) && !out.id) {
    out.id = randomUUID();
  }
  return out;
}

function runInsert(database: DatabaseSync, table: string, req: QueryRequest): QueryResponse {
  const rows = normalizeRows(req.values).map((r) => prepareInsertRow(table, r));
  if (!rows.length) return fail("No rows to insert");

  const inserted: Record<string, unknown>[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const sql = `INSERT INTO ${quoteIdent(table)} (${keys.map(quoteIdent).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`;
    try {
      database.prepare(sql).run(...keys.map((k) => row[k]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Ignore unique conflicts on badge awards etc.
      if (msg.includes("UNIQUE")) {
        if (req.returning || req.single || req.maybeSingle) {
          // fall through without adding
          continue;
        }
        continue;
      }
      throw e;
    }
    if (row.id) {
      const fetched = database
        .prepare(`SELECT * FROM ${quoteIdent(table)} WHERE id = ?`)
        .get(row.id) as Record<string, unknown> | undefined;
      if (fetched) inserted.push(decodeRow(fetched)!);
    } else {
      inserted.push(decodeRow(row)!);
    }
  }

  if (req.single || req.maybeSingle) {
    return ok(inserted[0] ?? null);
  }
  if (req.returning || req.select) {
    return ok(inserted);
  }
  return ok(null);
}

function runUpdate(database: DatabaseSync, table: string, req: QueryRequest): QueryResponse {
  const patch = normalizeRows(req.values)[0];
  if (!patch) return fail("No update payload");
  const encoded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || k === "id") continue;
    encoded[k] = encodeValue(k, v);
  }
  const keys = Object.keys(encoded);
  if (!keys.length) return fail("Empty update");

  const { sql: where, params } = applyFilters(req.filters);
  if (!where) return fail("Refusing update without filters");

  const sql = `UPDATE ${quoteIdent(table)} SET ${keys.map((k) => `${quoteIdent(k)} = ?`).join(", ")}${where}`;
  database.prepare(sql).run(...keys.map((k) => encoded[k]), ...params);

  if (req.returning || req.select) {
    return runSelect(database, table, { ...req, action: "select", select: req.select || "*" });
  }
  return ok(null);
}

function runDelete(database: DatabaseSync, table: string, req: QueryRequest): QueryResponse {
  const { sql: where, params } = applyFilters(req.filters);
  if (!where) return fail("Refusing delete without filters");
  database.prepare(`DELETE FROM ${quoteIdent(table)}${where}`).run(...params);
  return ok(null);
}

function runUpsert(database: DatabaseSync, table: string, req: QueryRequest): QueryResponse {
  const rows = normalizeRows(req.values).map((r) => prepareInsertRow(table, r));
  if (!rows.length) return fail("No rows to upsert");

  const conflictCols = (req.onConflict || "id")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const results: Record<string, unknown>[] = [];

  for (const row of rows) {
    const keys = Object.keys(row);
    const updateKeys = keys.filter((k) => !conflictCols.includes(k) && k !== "id");
    const sql = `
      INSERT INTO ${quoteIdent(table)} (${keys.map(quoteIdent).join(", ")})
      VALUES (${keys.map(() => "?").join(", ")})
      ON CONFLICT(${conflictCols.map(quoteIdent).join(", ")})
      DO UPDATE SET ${
        updateKeys.length
          ? updateKeys.map((k) => `${quoteIdent(k)} = excluded.${quoteIdent(k)}`).join(", ")
          : `${quoteIdent(conflictCols[0])} = excluded.${quoteIdent(conflictCols[0])}`
      }
    `;
    database.prepare(sql).run(...keys.map((k) => row[k]));

    // Fetch by conflict keys
    const where = conflictCols.map((c) => `${quoteIdent(c)} = ?`).join(" AND ");
    const fetched = database
      .prepare(`SELECT * FROM ${quoteIdent(table)} WHERE ${where}`)
      .get(...conflictCols.map((c) => row[c])) as Record<string, unknown> | undefined;
    if (fetched) results.push(decodeRow(fetched)!);
  }

  if (req.single || req.maybeSingle) return ok(results[0] ?? null);
  return ok(results);
}

// ── auth ───────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: { full_name?: string };
  app_metadata: { roles?: string[]; is_admin?: boolean };
  aud: string;
  role: string;
  created_at: string;
}

export interface AuthSession {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  expires_at: number;
  refresh_token: string;
  user: AuthUser;
}

function loadRoles(database: DatabaseSync, userId: string): string[] {
  const rows = database
    .prepare(`SELECT role FROM user_roles WHERE user_id = ?`)
    .all(userId) as { role: string }[];
  return rows.map((r) => r.role);
}

function makeUser(row: Record<string, unknown>, roles: string[] = []): AuthUser {
  let meta: { full_name?: string } = {};
  if (typeof row.raw_user_meta_data === "string") {
    try {
      meta = JSON.parse(row.raw_user_meta_data);
    } catch {
      meta = {};
    }
  } else if (row.raw_user_meta_data && typeof row.raw_user_meta_data === "object") {
    meta = row.raw_user_meta_data as { full_name?: string };
  }
  if (row.full_name && !meta.full_name) meta.full_name = String(row.full_name);

  const isAdmin = roles.includes("admin");
  return {
    id: String(row.id),
    email: String(row.email ?? ""),
    user_metadata: meta,
    app_metadata: { roles, is_admin: isAdmin },
    aud: "authenticated",
    role: isAdmin ? "admin" : "authenticated",
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

function createDbSession(
  database: DatabaseSync,
  user: AuthUser,
  userAgent?: string | null,
): AuthSession {
  const sessionId = randomUUID();
  const expires_in = SESSION_TTL_SEC;
  const expires_at = Math.floor(Date.now() / 1000) + expires_in;
  const expiresIso = new Date(expires_at * 1000).toISOString();

  const payload = Buffer.from(
    JSON.stringify({ sid: sessionId, sub: user.id, email: user.email, exp: expires_at }),
  ).toString("base64url");
  const access_token = `local.${payload}`;
  const token_hash = hashToken(access_token);

  database
    .prepare(
      `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at, user_agent, revoked)
       VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?, 0)`,
    )
    .run(sessionId, user.id, token_hash, expiresIso, userAgent ?? null);

  return {
    access_token,
    token_type: "bearer",
    expires_in,
    expires_at,
    refresh_token: `refresh.${sessionId}`,
    user,
  };
}

export function parseLocalToken(
  token: string | null | undefined,
): { userId: string; sessionId?: string } | null {
  if (!token?.startsWith("local.")) return null;
  try {
    const json = JSON.parse(Buffer.from(token.slice(6), "base64url").toString("utf8")) as {
      sub?: string;
      sid?: string;
      exp?: number;
    };
    if (!json.sub) return null;
    if (json.exp && json.exp * 1000 < Date.now()) return null;
    return { userId: json.sub, sessionId: json.sid };
  } catch {
    return null;
  }
}

/** Validate token against sessions table (revoked / expired). */
export function validateSessionToken(
  token: string | null | undefined,
): { userId: string; sessionId: string } | null {
  const parsed = parseLocalToken(token);
  if (!parsed || !token) return null;

  const database = getSqliteDb();
  const token_hash = hashToken(token);

  // Prefer DB session row when present
  const row = database
    .prepare(
      `SELECT id, user_id, expires_at, revoked FROM sessions WHERE token_hash = ? LIMIT 1`,
    )
    .get(token_hash) as
    | { id: string; user_id: string; expires_at: string; revoked: number }
    | undefined;

  if (row) {
    if (row.revoked) return null;
    if (new Date(row.expires_at).getTime() < Date.now()) return null;
    database
      .prepare(`UPDATE sessions SET last_seen_at = datetime('now') WHERE id = ?`)
      .run(row.id);
    return { userId: row.user_id, sessionId: row.id };
  }

  // Legacy tokens without DB row (pre-migration) — still accept JWT-like local token
  if (parsed.userId) return { userId: parsed.userId, sessionId: parsed.sessionId ?? "" };
  return null;
}

export function authSignIn(
  email: string,
  password: string,
  userAgent?: string | null,
): { session: AuthSession | null; error: string | null } {
  const database = getSqliteDb();
  const row = database
    .prepare(`SELECT * FROM users WHERE lower(email) = lower(?)`)
    .get(email.trim()) as Record<string, unknown> | undefined;

  if (!row) return { session: null, error: "Invalid login credentials" };

  const storedHash = row.password_hash as string | null;
  let okPass = verifyPassword(password, storedHash);

  // Boot-strapping known seed accounts if hash missing
  if (
    !okPass &&
    !storedHash &&
    (String(row.email).toLowerCase() === "demo@trustlensai.app" ||
      String(row.email).toLowerCase() === "admin@trustlensai.app" ||
      String(row.email).toLowerCase() === "learner@trustlensai.app") &&
    password === "demo-trustlens-2026"
  ) {
    okPass = true;
  }

  if (!okPass) return { session: null, error: "Invalid login credentials" };

  // Upgrade legacy / missing hashes to scrypt
  if (!storedHash || !String(storedHash).startsWith("scrypt$")) {
    database
      .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .run(hashPassword(password), row.id);
  }

  const roles = loadRoles(database, String(row.id));
  const user = makeUser(row, roles);
  return { session: createDbSession(database, user, userAgent), error: null };
}

export function authSignUp(
  email: string,
  password: string,
  fullName?: string,
  userAgent?: string | null,
): { session: AuthSession | null; user: AuthUser | null; error: string | null } {
  const database = getSqliteDb();
  const existing = database
    .prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`)
    .get(email.trim()) as { id: string } | undefined;
  if (existing) return { session: null, user: null, error: "User already registered" };

  if (password.length < 8) {
    return { session: null, user: null, error: "Password must be at least 8 characters" };
  }

  const id = randomUUID();
  const name = fullName?.trim() || email.split("@")[0];
  const meta = JSON.stringify({ full_name: name });
  const now = new Date().toISOString();

  database
    .prepare(
      `INSERT INTO users (id, email, full_name, password_hash, raw_user_meta_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(id, email.trim().toLowerCase(), name, hashPassword(password), meta, now);

  database
    .prepare(
      `INSERT INTO profiles (id, full_name, email, preferred_language, ai_consent, notification_email, created_at, updated_at)
       VALUES (?, ?, ?, 'en', 0, 1, ?, ?)`,
    )
    .run(id, name, email.trim().toLowerCase(), now, now);

  database
    .prepare(`INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, 'user', ?)`)
    .run(randomUUID(), id, now);

  const user = makeUser(
    {
      id,
      email: email.trim().toLowerCase(),
      full_name: name,
      raw_user_meta_data: meta,
      created_at: now,
    },
    ["user"],
  );
  return { session: createDbSession(database, user, userAgent), user, error: null };
}

export function authGetUser(token: string | null | undefined): AuthUser | null {
  const valid = validateSessionToken(token);
  if (!valid) return null;
  const database = getSqliteDb();
  const row = database.prepare(`SELECT * FROM users WHERE id = ?`).get(valid.userId) as
    | Record<string, unknown>
    | undefined;
  if (!row) return null;
  return makeUser(row, loadRoles(database, valid.userId));
}

export function authSignOut(token: string | null | undefined): void {
  if (!token) return;
  const database = getSqliteDb();
  const token_hash = hashToken(token);
  database.prepare(`UPDATE sessions SET revoked = 1 WHERE token_hash = ?`).run(token_hash);
}

export function authGetSession(
  token: string | null | undefined,
): AuthSession | null {
  const user = authGetUser(token);
  if (!user || !token) return null;
  const parsed = parseLocalToken(token);
  const expires_at = parsed
    ? JSON.parse(Buffer.from(token.slice(6), "base64url").toString("utf8")).exp
    : Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: Math.max(0, expires_at - Math.floor(Date.now() / 1000)),
    expires_at,
    refresh_token: `refresh.${parsed?.sessionId ?? user.id}`,
    user,
  };
}

export function saveUpload(path: string, bytes: Buffer): void {
  const full = join(UPLOADS_DIR, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, bytes);
}

export function getUploadsDir(): string {
  return UPLOADS_DIR;
}
