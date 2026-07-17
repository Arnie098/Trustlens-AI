/**
 * Probe Supabase connectivity + TrustLens schema.
 * Usage: node scripts/test-supabase.mjs
 * Reads .env (does not print secrets).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const env = {};
for (const line of readFileSync(resolve(".env"), "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
}

const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
const provider = env.VITE_DB_PROVIDER;

const results = [];
function ok(name, pass, detail = "") {
  results.push({ name, pass: Boolean(pass), detail });
}

ok("VITE_DB_PROVIDER=supabase", provider === "supabase", provider || "(missing)");
ok("SUPABASE_URL set", Boolean(url), url ? url : "missing");
ok(
  "publishable key set",
  Boolean(anon),
  anon
    ? anon.startsWith("sb_publishable_")
      ? "format: sb_publishable_*"
      : anon.startsWith("eyJ")
        ? "format: JWT"
        : "format: other"
    : "missing",
);
ok(
  "service_role key set",
  Boolean(service),
  service ? (service.startsWith("eyJ") ? "format: JWT" : "format: other") : "missing",
);

let configId = "";
try {
  const cfg = readFileSync(resolve("supabase/config.toml"), "utf8");
  const m = cfg.match(/project_id\s*=\s*"([^"]+)"/);
  configId = m?.[1] || "";
} catch {
  /* ignore */
}
const urlRef = (url || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || "";
ok(
  "config.toml project_id matches URL ref",
  !configId || configId === urlRef,
  configId ? `config=${configId} url_ref=${urlRef}` : "no config project_id",
);

async function probe(path, key, opts = {}) {
  const res = await fetch(url + path, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status, ok: res.ok, body };
}

if (!url || !anon) {
  console.log(JSON.stringify({ results, error: "Missing URL or publishable key" }, null, 2));
  process.exit(1);
}

// REST reachability
try {
  const rest = await probe("/rest/v1/", anon);
  ok("REST /rest/v1/ reachable", rest.status > 0 && rest.status < 500, `HTTP ${rest.status}`);
} catch (e) {
  ok("REST /rest/v1/ reachable", false, String(e.message || e));
}

// Auth health
try {
  const auth = await probe("/auth/v1/health", anon);
  ok("Auth /auth/v1/health", auth.ok || auth.status === 200, `HTTP ${auth.status}`);
} catch (e) {
  ok("Auth /auth/v1/health", false, String(e.message || e));
}

const tables = [
  "learning_modules",
  "badges",
  "profiles",
  "user_roles",
  "verification_requests",
  "verification_results",
  "lessons",
  "quizzes",
  "quiz_questions",
  "quiz_attempts",
  "user_learning_progress",
  "user_badges",
  "consent_records",
  "uploaded_content",
  "analytics_events",
  "moderation_reports",
];

const tableResults = [];
for (const t of tables) {
  try {
    const r = await probe(`/rest/v1/${t}?select=*&limit=1`, anon);
    const bodyStr = typeof r.body === "object" ? JSON.stringify(r.body) : String(r.body);
    const missing =
      r.status === 404 ||
      /PGRST205|does not exist|Could not find the table/i.test(bodyStr);
    const exists = !missing && r.status !== 0;
    tableResults.push({
      table: t,
      status: r.status,
      exists,
      detail:
        r.status === 200
          ? Array.isArray(r.body)
            ? `${r.body.length} row(s) (anon)`
            : "ok"
          : bodyStr.slice(0, 140),
    });
  } catch (e) {
    tableResults.push({ table: t, status: 0, exists: false, detail: String(e.message || e) });
  }
}

const missingTables = tableResults.filter((t) => !t.exists).map((t) => t.table);
ok(
  "All TrustLens public tables exist",
  missingTables.length === 0,
  missingTables.length ? `missing: ${missingTables.join(", ")}` : `${tables.length} tables OK`,
);

let seed = null;
if (service) {
  try {
    const mods = await probe("/rest/v1/learning_modules?select=slug,sort_order&order=sort_order", service);
    const badges = await probe("/rest/v1/badges?select=slug", service);
    const hasRole = await probe("/rest/v1/rpc/has_role", service, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        _user_id: "00000000-0000-0000-0000-000000000000",
        _role: "admin",
      }),
    });
    const buckets = await probe("/storage/v1/bucket", service);

    const moduleList = Array.isArray(mods.body) ? mods.body.map((m) => m.slug) : null;
    const badgeList = Array.isArray(badges.body) ? badges.body.map((b) => b.slug) : null;
    const bucketList = Array.isArray(buckets.body)
      ? buckets.body.map((b) => b.id || b.name)
      : [];

    seed = {
      modules: moduleList ?? { status: mods.status, err: mods.body },
      badges: badgeList ?? { status: badges.status, err: badges.body },
      has_role: { status: hasRole.status, value: hasRole.body },
      buckets: bucketList,
    };

    ok(
      "Seed: learning_modules ≥ 5",
      Array.isArray(moduleList) && moduleList.length >= 5,
      Array.isArray(moduleList) ? `${moduleList.length}: ${moduleList.join(", ")}` : JSON.stringify(mods.body).slice(0, 120),
    );
    ok(
      "Seed: badges ≥ 5",
      Array.isArray(badgeList) && badgeList.length >= 5,
      Array.isArray(badgeList) ? `${badgeList.length}: ${badgeList.join(", ")}` : JSON.stringify(badges.body).slice(0, 120),
    );
    ok(
      "RPC has_role callable",
      hasRole.status === 200 || hasRole.status === 204,
      `HTTP ${hasRole.status} body=${JSON.stringify(hasRole.body).slice(0, 80)}`,
    );
    ok(
      "Storage buckets verification-uploads + avatars",
      bucketList.includes("verification-uploads") && bucketList.includes("avatars"),
      bucketList.join(", ") || `HTTP ${buckets.status}`,
    );
  } catch (e) {
    ok("Service-role probes", false, String(e.message || e));
  }
} else {
  ok("Service-role probes", false, "SUPABASE_SERVICE_ROLE_KEY missing — skipped seed/storage checks");
}

const failed = results.filter((r) => !r.pass);
console.log(
  JSON.stringify(
    {
      project_url: url,
      provider,
      pass: failed.length === 0,
      checks: results,
      tables: tableResults,
      seed,
      failed_count: failed.length,
    },
    null,
    2,
  ),
);
process.exit(failed.length ? 1 : 0);
