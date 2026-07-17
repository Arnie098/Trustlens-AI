/**
 * Create / reset the local SQLite database for TrustLensAI.
 *
 * Usage:
 *   npm run db:init          # create if missing + apply schema/seed
 *   npm run db:reset         # delete and recreate
 *
 * Output: data/trustlens.db
 *
 * Uses Node 22+ built-in node:sqlite (no native deps). When you move to
 * Supabase, keep using supabase/migrations — this file is local-only.
 */

import { mkdirSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "data");
const dbPath = join(dataDir, "trustlens.db");
const schemaPath = join(root, "sqlite", "schema.sql");
const seedPath = join(root, "sqlite", "seed.sql");

const reset = process.argv.includes("--reset") || process.argv.includes("-r");

mkdirSync(dataDir, { recursive: true });

if (reset && existsSync(dbPath)) {
  unlinkSync(dbPath);
  console.log("Removed existing database.");
}

const isNew = !existsSync(dbPath);
const db = new DatabaseSync(dbPath);

db.exec("PRAGMA foreign_keys = ON;");
db.exec(readFileSync(schemaPath, "utf8"));
db.exec(readFileSync(seedPath, "utf8"));

const tables = db
  .prepare(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  )
  .all()
  .map((r) => r.name);

const counts = Object.fromEntries(
  tables.map((name) => {
    const row = db.prepare(`SELECT COUNT(*) AS c FROM "${name}"`).get();
    return [name, row.c];
  }),
);

db.close();

console.log(isNew || reset ? "Created" : "Updated", dbPath);
console.log("Tables:", tables.join(", "));
console.log("Row counts:", counts);
console.log("\nDemo accounts (password: demo-trustlens-2026)");
console.log("  learner@trustlensai.app / demo@trustlensai.app — user app");
console.log("  admin@trustlensai.app                         — admin console");
console.log("App uses VITE_DB_PROVIDER=sqlite by default (see .env).");
