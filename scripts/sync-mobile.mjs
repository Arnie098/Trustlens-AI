/**
 * Build TrustLens web for mobile and copy the static client build into mobile/www.
 *
 * Usage (from repo root):
 *   node scripts/sync-mobile.mjs             # build web → copy to mobile/www
 *   node scripts/sync-mobile.mjs --cap-sync  # also run `cap sync` in mobile/
 *
 * Requires env for device-capable builds (see mobile/README.md / mobile/.env.example):
 *   VITE_DB_PROVIDER=supabase
 *   VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
 *   VITE_API_BASE_URL=https://<deployed-host>
 *
 * This app is a TanStack Start SSR project; the default build emits only assets +
 * a server entry (no index.html). We pass MOBILE_SPA=1 so vite.config.ts turns on
 * SPA prerender (with Nitro disabled), producing dist/client + a static shell
 * (dist/client/_shell.html) that we copy to mobile/www/index.html for the WebView.
 */
import { cpSync, existsSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// TanStack Start SPA prerender (Nitro disabled for MOBILE_SPA) writes the static
// client build to dist/client, and the prerendered shell as dist/client/_shell.html
// (the SPA "mask" file) rather than index.html. Keep .output/public + dist as
// fallbacks in case the toolchain output moves.
const distCandidates = [
  path.join(root, "dist", "client"),
  path.join(root, ".output", "public"),
  path.join(root, "dist"),
];
// SPA mask filename the framework emits; we rename it to index.html for Capacitor.
const SHELL_CANDIDATES = ["_shell.html", "index.html"];
const www = path.join(root, "mobile", "www");
const doCapSync = process.argv.includes("--cap-sync");

/** Prefer bun when available (repo's documented runtime); fall back to npm. */
function detectRunner() {
  const probe = spawnSync("bun", ["--version"], { stdio: "ignore", shell: true });
  return probe.status === 0 ? "bun" : "npm";
}
const runner = detectRunner();

function run(cmd, args, env = {}) {
  console.log(`> ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Mobile artifacts default to Supabase + SPA prerender so a static shell is emitted.
const mobileEnv = {
  VITE_DB_PROVIDER: process.env.VITE_DB_PROVIDER || "supabase",
  MOBILE_SPA: "1",
};

console.log(`Using ${runner} to build the web app for mobile…`);
run(runner, ["run", "build"], mobileEnv);

const dist = distCandidates.find(
  (p) => existsSync(p) && SHELL_CANDIDATES.some((s) => existsSync(path.join(p, s))),
);
if (!dist) {
  console.error(
    "No static web build with a shell (_shell.html / index.html) found. Checked:",
    distCandidates,
  );
  console.error(
    "SPA prerender may have failed. Confirm MOBILE_SPA=1 turns on spa.prerender in vite.config.ts,",
  );
  console.error("then inspect the build output and update distCandidates if the path differs.");
  process.exit(1);
}

const shellName = SHELL_CANDIDATES.find((s) => existsSync(path.join(dist, s)));
console.log("Using build output:", dist, `(shell: ${shellName})`);
if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(path.dirname(www), { recursive: true });
cpSync(dist, www, { recursive: true });

// Capacitor loads www/index.html. If the shell was the SPA mask (_shell.html),
// materialize it as index.html so the WebView boots the client app.
if (shellName !== "index.html") {
  copyFileSync(path.join(dist, shellName), path.join(www, "index.html"));
  console.log(`Wrote index.html from ${shellName}`);
}
console.log("Copied →", www);

if (doCapSync) {
  // cap sync must run from the mobile/ package (that's where capacitor.config.ts lives).
  console.log("> npx cap sync (in mobile/)");
  const sync = spawnSync("npx", ["cap", "sync"], {
    cwd: path.join(root, "mobile"),
    stdio: "inherit",
    shell: true,
  });
  if (sync.status !== 0) process.exit(sync.status ?? 1);
}

console.log("Done. Open Android: cd mobile && npx cap open android");
