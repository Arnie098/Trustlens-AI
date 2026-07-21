# TrustLens Mobile (Capacitor) — Implementation Plan

> **SUPERSEDED (2026-07-18).** Do **not** implement this Capacitor plan.  
> Use instead:  
> - Design: `docs/superpowers/specs/2026-07-18-mobile-expo-react-native-design.md`  
> - Plan: `docs/superpowers/plans/2026-07-18-mobile-expo-react-native.md`  
> Direction change: **React Native + Expo from scratch**, not Capacitor WebView shell.

---

# (Archived) TrustLens Mobile (Capacitor) — Implementation Plan

> **For agentic workers (Claude, Grok, etc.):** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read first:** `docs/superpowers/specs/2026-07-17-mobile-capacitor-scanner-overlay-design.md`  
> That design is the source of truth for product rules (capture methods, anti-annoyance, performance budgets). This plan is the engineering sequence.

**Goal:** Create a separate `mobile/` Capacitor app that ships the TrustLens web UI on Android, with a camera/OCR scanner, share/clipboard verify paths, and a **lightweight, opt-in, non-annoying** floating assist bubble — without lagging the user’s phone.

**Architecture:** Approach A — build the existing TanStack/Vite web app into `mobile/www`, wrap with Capacitor. Device builds use **Supabase + absolute `VITE_API_BASE_URL`** for `/api/analyze`. Floating assist is **native Android only** (no WebView in the bubble). OCR and analyze run only after explicit user action.

**Tech Stack:** Capacitor 6/7, Android (primary), existing React 19 + TanStack Start web, Supabase JS, `@capacitor/camera`, `@capacitor/app`, `@capacitor/status-bar`, `@capacitor/splash-screen`, `@capacitor/clipboard`, optional ML Kit OCR (native), custom Android overlay service.

**Repo notes:**
- Workspace root: Trustlens-Web (Lovable-connected). Do **not** force-push or rewrite published history.
- Prefer frequent small commits on a feature branch if git is used; keep `main` working.
- Verify with device/emulator + `bun run lint` / `bun run build` for web changes.
- Mid-range Android is the perf reference device.

---

## Spec coverage map

| Design section | Plan tasks |
| --- | --- |
| §3 Capacitor shell + layout | Task 1–3 |
| §3.3 API base URL, deep links, safe areas | Task 4–5 |
| §5 Camera scanner + OCR + review | Task 6–8 |
| §4 Share / clipboard / screenshot import | Task 9–10 |
| §6 Floating assist + anti-annoyance | Task 11–13 |
| §18 Performance budgets | Tasks 3, 8, 11–14 |
| Phases 4–5 (MediaProjection, iOS) | Task 15 (deferred checklist only) |

---

## File structure (create / modify)

### New — mobile package


| Path | Responsibility |
| --- | --- |
| `mobile/package.json` | Capacitor deps + scripts (`sync`, `open:android`) |
| `mobile/capacitor.config.ts` | `appId`, `appName`, `webDir: "www"` |
| `mobile/www/` | **Generated** web build output (do not hand-edit) |
| `mobile/android/` | Native Android project (Capacitor-generated) |
| `mobile/README.md` | Build, env, permissions, perf QA |
| `mobile/native/README.md` | Where custom overlay/OCR native code lives |
| `scripts/sync-mobile.mjs` | Web production build → copy to `mobile/www` → optional `cap sync` |

### New — web bridge & mobile UX (in main app `src/`)

| Path | Responsibility |
| --- | --- |
| `src/lib/mobile/env.ts` | Detect Capacitor; read `VITE_API_BASE_URL` |
| `src/lib/mobile/bridge.ts` | Typed wrappers: camera, clipboard, overlay toggle, deep-link payload |
| `src/lib/mobile/image-pipeline.ts` | Downscale/compress still images before OCR/upload |
| `src/components/verify-scan-panel.tsx` | Camera/gallery scan + review UI |
| `src/components/compact-trust-result.tsx` | Mini TrustScore card (reuse later in native via deep link to full page; web uses this too) |
| `src/routes/_authenticated/settings.tsx` | Or section on profile: Floating Assist toggle + copy (if no settings route, add under profile) |

### Modify — existing web

| Path | Responsibility |
| --- | --- |
| `src/lib/ai/analyze.ts` | Prefix fetch with `VITE_API_BASE_URL` when set |
| `src/routes/_authenticated/verify.tsx` | Add **Scan** tab; handle deep-link search params |
| `src/routes/_authenticated/profile.tsx` | Link/toggle for floating assist on Android Capacitor |
| `src/styles.css` | Safe-area utilities; reduce heavy effects on mobile if needed |
| `src/routes/__root.tsx` | Optional: listen for app URL open / bridge init |
| `package.json` (root) | Scripts: `mobile:sync`, `mobile:android` |
| `.gitignore` | Ignore `mobile/www`, maybe `mobile/android` local artifacts if needed; **do commit** `mobile/android` source once generated if team wants reproducible builds — prefer committing capacitor config + documenting `cap add android` |

### Native Android (after `cap add android`)

| Path | Responsibility |
| --- | --- |
| `mobile/android/.../MainActivity.java` (or `.kt`) | Deep links, permission hooks |
| `mobile/android/.../overlay/AssistBubbleService.kt` | Foreground service + WindowManager bubble |
| `mobile/android/.../overlay/AssistBubbleView.kt` | Tiny bubble, half-hide, drag, long-press menu |
| `mobile/android/.../overlay/AssistPanelView.kt` | Mini action sheet (≤35% height) |
| `mobile/android/.../ocr/OcrHelper.kt` | ML Kit still-image OCR |
| `mobile/android/app/src/main/AndroidManifest.xml` | Permissions, service, intent filters |

---

## Environment variables (device builds)

Create `mobile/.env.example` (and document in README) — values used when building web assets for mobile:

```bash
VITE_DB_PROVIDER=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_ANON_KEY
VITE_API_BASE_URL=https://YOUR_DEPLOYED_TRUSTLENS_HOST
```

Never embed Perplexity or server secrets in the APK. Analyze stays on the deployed host.

---

## Task 0: Preflight (read-only)

- [ ] **Step 1: Read the design spec end-to-end**

Path: `docs/superpowers/specs/2026-07-17-mobile-capacitor-scanner-overlay-design.md`

Confirm you understand: default-off bubble, half-hide, no WebView in overlay, still-image OCR only, absolute API base URL.

- [ ] **Step 2: Confirm web analyze + DB entrypoints**

```
src/lib/ai/analyze.ts          → POST /api/analyze
src/lib/db.ts                  → sqlite | supabase via VITE_DB_PROVIDER
src/routes/_authenticated/verify.tsx
```

- [ ] **Step 3: Check tooling**

```bash
node -v    # >= 22 preferred (see root package.json engines)
java -version
# Android Studio / SDK recommended for emulator
```

---

## Task 1: Scaffold `mobile/` Capacitor project

**Files:**
- Create: `mobile/package.json`
- Create: `mobile/capacitor.config.ts`
- Create: `mobile/README.md`
- Create: `mobile/.gitignore`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "trustlens-mobile",
  "private": true,
  "version": "0.1.0",
  "description": "TrustLensAI Capacitor shell — see docs/superpowers/specs/2026-07-17-mobile-capacitor-scanner-overlay-design.md",
  "scripts": {
    "sync": "npx cap sync",
    "open:android": "npx cap open android",
    "copy": "npx cap copy"
  },
  "dependencies": {
    "@capacitor/android": "^7.0.0",
    "@capacitor/app": "^7.0.0",
    "@capacitor/camera": "^7.0.0",
    "@capacitor/clipboard": "^7.0.0",
    "@capacitor/core": "^7.0.0",
    "@capacitor/splash-screen": "^7.0.0",
    "@capacitor/status-bar": "^7.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "^7.0.0",
    "typescript": "^5.8.3"
  }
}
```

Pin to latest stable Capacitor 7.x available at implement time if 7 is not published; Capacitor 6 is acceptable — keep major consistent across packages.

- [ ] **Step 2: Create capacitor.config.ts**

```ts
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.trustlens.app",
  appName: "TrustLensAI",
  webDir: "www",
  server: {
    // Production: load bundled www. For live-reload dev only, temporarily set url.
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0c2340",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0c2340",
    },
  },
};

export default config;
```

- [ ] **Step 3: Create mobile/.gitignore**

```
node_modules/
www/
.idea/
*.apk
*.aab
local.properties
.DS_Store
```

- [ ] **Step 4: Install and add Android platform**

```bash
cd mobile
npm install
mkdir www
echo "<html><body>TrustLens placeholder — run root mobile:sync</body></html>" > www/index.html
npx cap add android
```

Expected: `mobile/android/` created.

- [ ] **Step 5: Write mobile/README.md** with: design doc link, env vars, `mobile:sync` from root, open Android Studio, permission list, perf QA checklist from design §18.7.

- [ ] **Step 6: Commit** (if using git)

```bash
git add mobile/package.json mobile/capacitor.config.ts mobile/README.md mobile/.gitignore
git commit -m "chore(mobile): scaffold Capacitor project"
```

---

## Task 2: Root sync script (web build → mobile/www)

**Files:**
- Create: `scripts/sync-mobile.mjs`
- Modify: root `package.json` scripts

- [ ] **Step 1: Add sync-mobile.mjs**

```js
/**
 * Build TrustLens web for mobile and copy assets into mobile/www.
 * Usage (from repo root):
 *   node scripts/sync-mobile.mjs
 *   node scripts/sync-mobile.mjs --cap-sync
 *
 * Requires env for device-capable builds (see mobile/README.md).
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distCandidates = [
  path.join(root, "dist", "client"),
  path.join(root, "dist"),
  path.join(root, ".output", "public"),
];
const www = path.join(root, "mobile", "www");
const doCapSync = process.argv.includes("--cap-sync");

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

// Prefer supabase + API base for mobile artifacts
const mobileEnv = {
  VITE_DB_PROVIDER: process.env.VITE_DB_PROVIDER || "supabase",
};

run("bun", ["run", "build"], mobileEnv);

const dist = distCandidates.find((p) => existsSync(p));
if (!dist) {
  console.error("No web build output found. Checked:", distCandidates);
  console.error("Inspect vite/nitro output after build and update distCandidates.");
  process.exit(1);
}

console.log("Using build output:", dist);
if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(path.dirname(www), { recursive: true });
cpSync(dist, www, { recursive: true });
console.log("Copied →", www);

if (doCapSync) {
  run("npx", ["cap", "sync"], {});
  // run from mobile directory:
  spawnSync("npx", ["cap", "sync"], {
    cwd: path.join(root, "mobile"),
    stdio: "inherit",
    shell: true,
  });
}

console.log("Done. Open Android: cd mobile && npx cap open android");
```

**Important:** After first real `bun run build`, verify which folder contains `index.html` + assets. Update `distCandidates` if the TanStack/Nitro output path differs (common: `.output/public` or `dist/client`).

- [ ] **Step 2: Root package.json scripts**

```json
"mobile:sync": "node scripts/sync-mobile.mjs",
"mobile:sync:cap": "node scripts/sync-mobile.mjs --cap-sync",
"mobile:android": "npm run mobile:sync:cap && npm --prefix mobile run open:android"
```

- [ ] **Step 3: Run once and fix dist path**

```bash
# With env vars set for supabase + API if available
node scripts/sync-mobile.mjs
```

Expected: `mobile/www/index.html` exists.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync-mobile.mjs package.json
git commit -m "chore(mobile): add web→www sync script"
```

---

## Task 3: Absolute analyze API base URL

**Files:**
- Create: `src/lib/mobile/env.ts`
- Modify: `src/lib/ai/analyze.ts`

- [ ] **Step 1: Create env helper**

```ts
// src/lib/mobile/env.ts
export function getApiBaseUrl(): string {
  const raw =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) ||
    "";
  return String(raw).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function isProbablyNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor injects this
  return !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.();
}
```

- [ ] **Step 2: Patch analyzeContent fetch**

In `src/lib/ai/analyze.ts`, change:

```ts
const res = await fetch("/api/analyze", {
```

to:

```ts
import { apiUrl } from "@/lib/mobile/env";
// ...
const res = await fetch(apiUrl("/api/analyze"), {
```

- [ ] **Step 3: Manual verify in browser**

Without `VITE_API_BASE_URL`, relative `/api/analyze` still works in dev.

With `VITE_API_BASE_URL=https://example.com`, network tab should hit `https://example.com/api/analyze`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mobile/env.ts src/lib/ai/analyze.ts
git commit -m "feat(mobile): support absolute API base for Capacitor"
```

---

## Task 4: Safe areas + mobile shell CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Add safe-area utilities** (near other `@utility` blocks)

```css
@utility pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
@utility pb-safe {
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
@utility px-safe {
  padding-left: env(safe-area-inset-left, 0px);
  padding-right: env(safe-area-inset-right, 0px);
}
```

- [ ] **Step 2: Ensure root layout uses safe padding on main chrome**

If `src/components/site-header.tsx` or authenticated layout wraps content, add `pt-safe` / `pb-safe` on the outer shell used when `isProbablyNativeShell()` is true — or always apply safe padding (harmless on desktop).

- [ ] **Step 3: Lint**

```bash
bun run lint
```

---

## Task 5: Deep links into verify

**Files:**
- Modify: `src/routes/_authenticated/verify.tsx`
- Modify: `src/routes/__root.tsx` or create `src/lib/mobile/deep-links.ts`
- Android: intent filter in manifest (Task 11 dependency — add app URL scheme)

**Search params contract:**

```
/verify?tab=scan|url|text|image
/verify?tab=text&prefill=...
/verify?source=clipboard|share|overlay|camera
```

Also support custom scheme later: `trustlens://verify?tab=scan`

- [ ] **Step 1: Extend zod search schema** in `verify.tsx`

```ts
const search = z.object({
  tab: z.enum(["url", "text", "image", "scan"]).optional(),
  source: z.enum(["clipboard", "share", "overlay", "camera", "gallery"]).optional(),
  prefill: z.string().optional(),
});
```

- [ ] **Step 2: On mount, if `prefill` and tab text/url, seed form state**

- [ ] **Step 3: Document scheme** in `mobile/README.md`: `trustlens://verify?tab=scan`

---

## Task 6: Image pipeline (performance)

**Files:**
- Create: `src/lib/mobile/image-pipeline.ts`

- [ ] **Step 1: Implement downscale + JPEG compress**

```ts
// src/lib/mobile/image-pipeline.ts
/** Max long-edge pixels before OCR/upload (design §18.5). */
export const MAX_LONG_EDGE = 1280;
export const JPEG_QUALITY = 0.78;

export async function prepareImageForAnalysis(
  fileOrBlob: Blob,
  opts?: { maxLongEdge?: number; quality?: number },
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxLongEdge = opts?.maxLongEdge ?? MAX_LONG_EDGE;
  const quality = opts?.quality ?? JPEG_QUALITY;

  const bitmap = await createImageBitmap(fileOrBlob);
  const scale = Math.min(1, maxLongEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Compress failed"))),
      "image/jpeg",
      quality,
    );
  });

  return { blob, width, height };
}
```

- [ ] **Step 2: Unit-style manual check** — load a large screenshot, assert output long edge ≤ 1280.

---

## Task 7: Scan panel UI (camera + gallery + review)

**Files:**
- Create: `src/components/verify-scan-panel.tsx`
- Modify: `src/routes/_authenticated/verify.tsx`
- Create: `src/lib/mobile/bridge.ts` (camera wrappers)

- [ ] **Step 1: bridge.ts camera helpers**

```ts
// src/lib/mobile/bridge.ts
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Clipboard } from "@capacitor/clipboard";

export async function capturePhoto(): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback: file input handled by caller
    return null;
  }
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Camera,
    width: 1600,
    correctOrientation: true,
  });
  if (!photo.webPath) return null;
  const res = await fetch(photo.webPath);
  return res.blob();
}

export async function pickFromGallery(): Promise<Blob | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const photo = await Camera.getPhoto({
    quality: 85,
    resultType: CameraResultType.Uri,
    source: CameraSource.Photos,
    width: 1600,
    correctOrientation: true,
  });
  if (!photo.webPath) return null;
  const res = await fetch(photo.webPath);
  return res.blob();
}

export async function readClipboardText(): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Clipboard.read();
    return value?.trim() ?? "";
  }
  try {
    return (await navigator.clipboard.readText()).trim();
  } catch {
    return "";
  }
}
```

Note: Web package.json does not include Capacitor packages — either:

**Option A (recommended):** add Capacitor core/camera/clipboard as **optional** root dependencies so the web build can import them, with dynamic import + try/catch for browser-only.

**Option B:** keep bridge only in mobile and use `window.TrustLensNative` injected by Android.

For simplest Claude execution: **Option A** — add to root:

```bash
bun add @capacitor/core @capacitor/camera @capacitor/clipboard @capacitor/app
```

Guard all calls with `Capacitor.isNativePlatform()`.

- [ ] **Step 2: Build VerifyScanPanel**

UI flow (design §5.3):

1. Buttons: **Take photo** · **Choose screenshot**
2. On capture → `prepareImageForAnalysis`
3. Optional OCR: if native plugin available call it; else skip to manual text + image analyze
4. Review: image preview, editable textarea, consent, **Run TrustLens**
5. Reuse existing `submitAndRedirect` / analyze path from verify.tsx (export helpers or duplicate carefully — prefer extracting shared `submitVerification` to `src/lib/verify/submit.ts` if file is large)

Keep visual language: navy/teal, `font-display`, existing Card/Button components — not generic purple UI.

- [ ] **Step 3: Wire Scan tab in verify.tsx**

Add fourth tab `scan` with `VerifyScanPanel`.

- [ ] **Step 4: Manual test on web** — gallery file input fallback works; analyze still succeeds for text path.

---

## Task 8: OCR integration (still image only)

**Files:**
- Create: `mobile/android/.../ocr/` (ML Kit) **or** use a Capacitor community ML Kit plugin
- Create: `src/lib/mobile/ocr.ts`

**Rules (design §18):** OCR only on one prepared bitmap; background thread; cancelable; no live multi-frame OCR.

- [ ] **Step 1: Prefer community plugin if maintained** e.g. search `capacitor-mlkit` barcode/text — if text recognition exists, wrap it.

- [ ] **Step 2: ocr.ts API**

```ts
export async function recognizeTextFromBlob(blob: Blob): Promise<string> {
  // 1) prepareImageForAnalysis
  // 2) if native plugin: call it
  // 3) else return "" (user types manually)
}
```

- [ ] **Step 3: Wire into VerifyScanPanel review step**

Show progress “Reading text…”, allow skip/edit.

- [ ] **Step 4: Perf check** — 10 consecutive scans must not grow memory unbounded; release object URLs with `URL.revokeObjectURL`.

---

## Task 9: Clipboard verify entry

**Files:**
- Modify: `verify.tsx` / scan or text tab
- Modify: `profile.tsx` or verify header with “Paste from clipboard” button when native

- [ ] **Step 1: Button “Verify clipboard”**

Calls `readClipboardText()`:

- If starts with `http` → tab url + prefill
- Else if length > 0 → tab text + prefill
- Else toast: “Copy a caption or link first.”

- [ ] **Step 2: No polling** — only on user tap (design §18.4).

---

## Task 10: Android share intent → app

**Files:**
- `mobile/android/app/src/main/AndroidManifest.xml`
- MainActivity / a small plugin to pass shared text/image into WebView URL

- [ ] **Step 1: Intent filters** for `SEND` text/plain and image/*

- [ ] **Step 2: On share, open**

`https://localhost/verify?tab=text&prefill=...&source=share`  
(or Capacitor server path equivalent)

- [ ] **Step 3: Test** with Android Sharesheet from Chrome (copy link → Share → TrustLens).

---

## Task 11: Floating assist — native bubble (calm + fast)

**Files:**
- `AssistBubbleService.kt`, `AssistBubbleView.kt`, `AssistPanelView.kt`
- AndroidManifest permissions: `SYSTEM_ALERT_WINDOW`, foreground service types as required by target SDK
- JS bridge method `TrustLensAssist.setEnabled(boolean)` / `isEnabled`

**Must implement design §6.3 anti-annoyance + §18.4 perf:**

| Requirement | Implementation note |
| --- | --- |
| Default off | Preference `assist_enabled=false` |
| 40–48dp icon | ImageView, no text |
| Edge snap + remember side | SharedPreferences |
| Auto half-hide ~2.5s | One-shot Handler, not a 16ms loop |
| No auto-expand | Only on tap |
| Long-press menu | Hide now / 1 hour / Turn off |
| Mini panel ≤ 35% height | Bottom sheet style panel |
| No WebView in bubble | Native views only |
| No clipboard polling | Read clipboard only on action |
| Idle ≈ 0 CPU | No animations loop; no OCR |

- [ ] **Step 1: Request overlay permission** via settings intent when user enables in Profile/Settings.

- [ ] **Step 2: Implement service + bubble view**

Idle state: show bubble, schedule half-hide, **no network**.

- [ ] **Step 3: Actions on panel**

1. Scan → `startActivity` deep link `trustlens://verify?tab=scan&source=overlay` and **hide bubble while camera open**
2. Screenshot → gallery picker / verify image tab
3. Clipboard → deep link with prefill or broadcast to WebView
4. Open app → main activity
5. (Defer) Capture screen

- [ ] **Step 4: Result UX**

After analyze completes **in the full app**, optional: show compact result in app only for MVP.  
Phase stretch: send broadcast back to bubble for mini score card + auto-dismiss 10s.

MVP acceptable: bubble opens app for full result (still calm; no spam).

- [ ] **Step 5: Foreground notification**

If required: low-importance channel, text exactly:  
`TrustLens assist is on — tap to manage.`  
No marketing, no badge counts.

- [ ] **Step 6: Perf QA**

- Assist on, idle 10+ minutes while using another app — TrustLens CPU near 0  
- Side-by-side scroll smoothness  
- Hide / turn off in ≤ 2 taps  

---

## Task 12: In-app settings for Floating Assist

**Files:**
- Modify: `src/routes/_authenticated/profile.tsx` (or new settings route)

- [ ] **Step 1: Section “Floating Assist (Android)”**

Copy:

> Show a small bubble while you use other apps. TrustLens does not read your feed by itself. You choose what to scan, paste, or import. Default is off.

Controls:

- Toggle enable (calls native bridge)
- Button “Hide for 1 hour”
- Button “Open system overlay permission”
- Link to privacy/disclaimer

- [ ] **Step 2: Only show section when `Capacitor.getPlatform() === 'android'`**

---

## Task 13: Compact result component (web)

**Files:**
- Create: `src/components/compact-trust-result.tsx`

- [ ] **Step 1: Props**

```ts
type Props = {
  trustScore: number;
  category: string;
  summary: string;
  onDetails?: () => void;
  onDismiss?: () => void;
};
```

Use existing `TrustGauge` if lightweight enough; otherwise small ring + `trustLabel` colors from tokens.

- [ ] **Step 2: Use on verify result page mobile layout** as a sticky summary (optional).

---

## Task 14: Performance pass on web shell

**Files:**
- `src/routes/_authenticated/dashboard.tsx` (lazy charts)
- Possibly dynamic `import("recharts")` only on dashboard

- [ ] **Step 1: Ensure production mobile builds** never include devtools.

- [ ] **Step 2: Lazy-load recharts** inside dashboard so Verify route doesn’t pay chart cost.

Example pattern:

```ts
const DashboardCharts = lazy(() => import("@/components/dashboard-charts"));
```

Extract chart JSX into `src/components/dashboard-charts.tsx` if needed.

- [ ] **Step 3: Measure cold start on device** after `mobile:sync` — target ≤ 3s interactive on mid-range (design §18.2). If over, disable heavy landing animations when `isProbablyNativeShell()`.

---

## Task 15: Deferred (do not block MVP)

Document in `mobile/README.md` only unless time remains:

- [ ] Android MediaProjection one-shot capture (design Phase 4)
- [ ] iOS Share Extension + widget (Phase 5)
- [ ] Bubble mini-result without opening full app
- [ ] Separate process for overlay if profiling demands it

---

## Task 16: End-to-end QA checklist

Run through and check off in a short `mobile/QA.md` note:

### Functional

- [ ] Install APK / run emulator
- [ ] Login (Supabase)
- [ ] Verify URL, text, image (gallery)
- [ ] Scan: camera → review → TrustScore
- [ ] Clipboard path
- [ ] Share intent path (Android)
- [ ] Floating assist default **off**
- [ ] Enable assist → system permission → bubble appears
- [ ] Half-hide works; drag + edge snap works
- [ ] Long-press hide / turn off works
- [ ] No unsolicited popups for 10 minutes of social scrolling

### Performance / annoyance (design §18.7)

- [ ] Cold start budget
- [ ] 10× scan without crash/OOM
- [ ] Idle assist battery/CPU
- [ ] Scroll side-by-side test
- [ ] 3 testers: “not distracting” pass

### Ethics

- [ ] No silent capture
- [ ] AI consent still required
- [ ] Disclaimers reachable

---

## Suggested implementation order (for Claude)

```
Task 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 14 → 10 → 11 → 12 → 13 → 16
                                                      └─ 15 deferred
```

Ship criteria for “MVP mobile”:

1. `mobile/` installs on Android  
2. Core verify works against deployed API + Supabase  
3. Scan + clipboard work  
4. Floating assist optional, calm, idle-cheap  
5. QA checklist mostly green  

---

## Commands cheat sheet

```bash
# From repo root — build web into mobile/www and cap sync
set VITE_DB_PROVIDER=supabase
set VITE_API_BASE_URL=https://YOUR_HOST
set VITE_SUPABASE_URL=...
set VITE_SUPABASE_PUBLISHABLE_KEY=...
node scripts/sync-mobile.mjs --cap-sync

cd mobile
npx cap open android
```

---

## Self-review (plan vs spec)

| Spec requirement | Covered? |
| --- | --- |
| Separate `mobile/` dir | Task 1 |
| Capacitor wraps web build | Task 2 |
| Remote API + Supabase | Env + Task 3 |
| Camera + text reader | Tasks 6–8 |
| Screenshot/share/clipboard | Tasks 9–10 |
| Floating bubble Android | Task 11–12 |
| Not annoying | Task 11 table + QA |
| Performance / no lag | Tasks 6, 8, 11, 14, 16 |
| No silent surveillance | Tasks 9, 11, 16 |
| iOS / MediaProjection | Task 15 deferred |

---

## Handoff

**Design:** `docs/superpowers/specs/2026-07-17-mobile-capacitor-scanner-overlay-design.md`  
**This plan:** `docs/superpowers/plans/2026-07-17-mobile-capacitor-scanner-overlay.md`

Claude (or any agent) should implement **task-by-task**, check boxes as done, and stop for human review after Task 2 (shell sync works) and after Task 11 (bubble behavior + perf).

---

*End of implementation plan.*
