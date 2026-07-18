# TrustLens Mobile (Expo + React Native) — Implementation Plan

> **For agentic workers (Claude, Grok, etc.):** Use `superpowers:subagent-driven-development` or `superpowers:executing-plans`. Track steps with checkboxes.
>
> **Read first:** `docs/superpowers/specs/2026-07-18-mobile-expo-react-native-design.md`  
> **Supersedes:** Capacitor plan `docs/superpowers/plans/2026-07-17-mobile-capacitor-scanner-overlay.md` — **do not implement Capacitor.**

**Goal:** Build a **new** TrustLens Android-first mobile app **from scratch** with **Expo + React Native** in `mobile/`: auth, verify (URL/text/image/scan), results, share/clipboard, optional floating assist—calling the existing deployed API + Supabase.

**Architecture:** Expo Router native screens. Shared **API/types** concepts with web; **UI rewritten** in RN. No WebView product shell. Floating assist = Android Expo Module (native), not RN overlay over other apps.

**Tech stack:** Expo (current stable SDK), Expo Router, TypeScript, Supabase JS, expo-image-picker / expo-camera, expo-clipboard, TanStack Query (optional), EAS optional.

**Repo notes:**

- Root is Lovable-connected web app — do not force-push / rewrite published history.  
- Mobile lives only under `mobile/`; avoid breaking web `src/`.  
- Mid-range Android is the performance reference device.

---

## Spec coverage

| Design | Tasks |
| --- | --- |
| Expo scaffold + theme | 1–2 |
| Auth + Supabase | 3 |
| Analyze API + types | 4 |
| Verify URL/text/image + results | 5–6 |
| Scan + OCR + image prep | 7–8 |
| Clipboard + share | 9–10 |
| Dashboard / learn subset | 11 |
| Floating assist + settings | 12–13 |
| Perf QA | 14 |

---

## File structure (target)

```
mobile/
  package.json
  app.config.ts
  app/
    _layout.tsx
    (auth)/login.tsx
    (auth)/register.tsx
    (app)/_layout.tsx          # tabs
    (app)/index.tsx            # home
    (app)/verify/index.tsx
    (app)/verify/[id].tsx
    (app)/learn/index.tsx
    (app)/profile.tsx
  src/
    theme/colors.ts
    theme/typography.ts
    lib/supabase.ts
    lib/api/analyze.ts
    lib/types/analysis.ts
    lib/trust.ts
    lib/image-prep.ts
    features/auth/session.tsx
    features/verify/VerifyForm.tsx
    features/scan/ScanScreen.tsx
    features/assist/bridge.ts
    components/TrustGauge.tsx
    components/CompactTrustResult.tsx
  modules/floating-assist/     # Phase 5
  README.md
  .env.example
```

---

## Task 0: Preflight

- [ ] **Step 1:** Read design `docs/superpowers/specs/2026-07-18-mobile-expo-react-native-design.md`
- [ ] **Step 2:** Confirm web API shapes in:
  - `src/lib/ai/types.ts`
  - `src/lib/ai/analyze.ts`
  - Supabase auth client patterns in `src/integrations/supabase/`
- [ ] **Step 3:** Ensure Node 20+ / 22+, `npx expo` available; Android Studio or Expo Go for device

---

## Task 1: Scaffold Expo app in `mobile/`

- [ ] **Step 1:** Create app (from repo root)

```bash
npx create-expo-app@latest mobile -t tabs
```

If interactive prompts block CI, use defaults. Prefer TypeScript template with Expo Router.

Alternative:

```bash
cd mobile
npx create-expo-app@latest . -t tabs
```

- [ ] **Step 2:** Set app identity in `app.config.ts` / `app.json`:

```json
{
  "expo": {
    "name": "TrustLensAI",
    "slug": "trustlens",
    "scheme": "trustlens",
    "android": {
      "package": "ai.trustlens.app"
    },
    "ios": {
      "bundleIdentifier": "ai.trustlens.app"
    }
  }
}
```

- [ ] **Step 3:** Add deps

```bash
cd mobile
npx expo install @supabase/supabase-js expo-secure-store expo-image-picker expo-clipboard expo-linking expo-constants
npm install @tanstack/react-query zod
```

- [ ] **Step 4:** `mobile/README.md` — how to run, env vars, link to design doc

- [ ] **Step 5:** `npx expo start` — app launches in Expo Go / emulator

- [ ] **Step 6:** Commit on feature branch if using git:

```bash
git add mobile
git commit -m "chore(mobile): scaffold Expo React Native app"
```

---

## Task 2: Theme (Ocean Deep, non-generic)

**Files:** `mobile/src/theme/colors.ts`, `typography.ts`, use in `_layout` / components

- [ ] **Step 1:** Colors

```ts
// mobile/src/theme/colors.ts
export const colors = {
  navy: "#0c2340",
  teal: "#2d8a9e",
  aqua: "#5cbdb9",
  background: "#f5f9fb",
  foreground: "#1a2b3c",
  card: "#ffffff",
  muted: "#5a6b7c",
  border: "#d5e0e8",
  trustHigh: "#1f8a5b",
  trustMedium: "#c49212",
  trustLow: "#c45c26",
  trustDanger: "#b83232",
};
```

- [ ] **Step 2:** Root layout background + status bar style (dark content on light Ocean Deep)

- [ ] **Step 3:** Replace default Expo starter purple/tabs with TrustLens labels: Home, Verify, Learn, Profile

---

## Task 3: Supabase auth

**Files:** `src/lib/supabase.ts`, `features/auth/session.tsx`, `(auth)/login.tsx`, `(auth)/register.tsx`

- [ ] **Step 1:** Client

```ts
// mobile/src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: Platform.OS === "web" ? undefined : ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

- [ ] **Step 2:** Session provider + gate: unauthenticated → `(auth)`, else → `(app)` tabs

- [ ] **Step 3:** Email/password login + register (match web capability)

- [ ] **Step 4:** `.env.example`

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=
```

- [ ] **Step 5:** Manual test: sign up / sign in / session persists after reload

---

## Task 4: Types + analyze API client

**Files:** `src/lib/types/analysis.ts`, `src/lib/trust.ts`, `src/lib/api/analyze.ts`

- [ ] **Step 1:** Mirror web types from `src/lib/ai/types.ts` (AnalysisInput, AnalysisResult, categoryFor, trustLabel)

- [ ] **Step 2:** Analyze client

```ts
// mobile/src/lib/api/analyze.ts
import type { AnalysisInput, AnalysisResult } from "../types/analysis";

const base = (process.env.EXPO_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export async function analyzeContent(input: AnalysisInput): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    const json = (await res.json()) as {
      data?: AnalysisResult;
      error?: { message: string };
    };
    if (!res.ok || !json.data) {
      throw new Error(json.error?.message || `Analysis failed (${res.status})`);
    }
    return json.data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Analysis timed out. Try shorter text or another URL.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 3:** Unit-smoke: with valid env, text analyze returns score (device or Node fetch script)

---

## Task 5: Verify screens (URL / Text / Image)

**Files:** `app/(app)/verify/index.tsx`, form components, consent checkbox

- [ ] **Step 1:** Segmented control / tabs: URL | Text | Image | Scan (Scan stub → Task 7)

- [ ] **Step 2:** On submit:
  1. Ensure AI consent (profile `ai_consent` or local + insert `consent_records` like web)
  2. Insert `verification_requests` via Supabase
  3. Call `analyzeContent`
  4. Insert `verification_results`
  5. Navigate to `/verify/[id]`

- [ ] **Step 3:** Image: `ImagePicker.launchImageLibraryAsync` → upload or send as API expects (match web image path; if API only gets `imageName` today, document gap and send text description or extend API for base64/URL)

**Important:** Inspect web image upload flow (`verify.tsx` ImageForm). Port the same storage + analyze contract. If mobile needs base64 body, extend **server** analyze handler carefully without breaking web.

- [ ] **Step 4:** Loading + error toasts (`Alert` or `react-native` friendly toast lib)

---

## Task 6: Result screen + TrustGauge

**Files:** `app/(app)/verify/[id].tsx`, `components/TrustGauge.tsx`, `CompactTrustResult.tsx`

- [ ] **Step 1:** Load result by id from Supabase for current user

- [ ] **Step 2:** Show score, category chip, summary, concerns, evidence, next_steps

- [ ] **Step 3:** Simple Trust Replay list if `replay_data` present (native ScrollView cards—not full web graph)

---

## Task 7: Image prep (performance)

**File:** `src/lib/image-prep.ts`

- [ ] **Step 1:** Use `expo-image-manipulator` to resize max long edge 1280 and compress

```bash
npx expo install expo-image-manipulator
```

```ts
import * as ImageManipulator from "expo-image-manipulator";

export async function prepareImageForAnalysis(uri: string) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }], // height auto; clamp if needed
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}
```

- [ ] **Step 2:** Always run prep before OCR/upload

---

## Task 8: Scan screen + OCR

**Files:** `features/scan/ScanScreen.tsx`, verify Scan tab

- [ ] **Step 1:** Camera or `launchCameraAsync` + guided copy: “Align the post in frame”

- [ ] **Step 2:** After capture → prep → OCR

Pick one OCR approach (document choice in README):

- A) Community Expo/ML Kit text recognition module  
- B) Defer OCR: user types/edits caption; still send image  
- C) Server-side OCR only if privacy/consent OK  

**MVP acceptable:** B if A is blocked; still ship review UI.

- [ ] **Step 3:** Review UI: image, TextInput multiline, consent, Run

- [ ] **Step 4:** Wire to same submit pipeline as Task 5

- [ ] **Step 5:** Cancel / unmount releases camera

---

## Task 9: Clipboard verify

- [ ] **Step 1:** Button “Verify clipboard” on Home + Verify

```ts
import * as Clipboard from "expo-clipboard";

const text = (await Clipboard.getStringAsync()).trim();
// if http → URL flow; else if length → text flow; else Alert
```

- [ ] **Step 2:** **No polling** — only on press

---

## Task 10: Android share intent / deep links

- [ ] **Step 1:** Configure intent filters / Expo scheme `trustlens://`

- [ ] **Step 2:** On app open with shared text/url/image, route to Verify with prefill

- [ ] **Step 3:** Test with Android Sharesheet from Chrome

Docs: Expo Linking + Android intent filters in `app.config.ts`

---

## Task 11: Home dashboard + Learn subset

- [ ] **Step 1:** Home: recent 5 verifications from Supabase, quick actions

- [ ] **Step 2:** Learn: list `learning_modules`, open detail, mark progress if tables exist

- [ ] **Step 3:** Skip heavy web charts in MVP; simple counts OK

---

## Task 12: Floating Assist settings (in-app)

**Files:** `app/(app)/profile.tsx` section, `features/assist/bridge.ts`

- [ ] **Step 1:** Copy:

> Floating Assist shows a small bubble over other apps. TrustLens does not read your feed. You choose what to scan, paste, or import. Default is off.

- [ ] **Step 2:** Toggle calls native module `FloatingAssist.setEnabled(true|false)`

- [ ] **Step 3:** Buttons: Open overlay permission settings; Hide 1 hour; Turn off

- [ ] **Step 4:** Show section only on `Platform.OS === "android"`

---

## Task 13: Android floating assist native module

**Only after Tasks 1–10 stable.**

- [ ] **Step 1:** Create Expo Module `modules/floating-assist` (Kotlin)

Requirements from design §8:

- 40–48 dp bubble, edge snap, half-hide ~2.5s  
- Tap → native mini panel (scan / screenshot / clipboard / open app)  
- Long-press hide menu  
- Deep link into Expo activity  
- No WebView in bubble; idle ≈ zero work  
- Foreground notification text if required: `TrustLens assist is on — tap to manage.`

- [ ] **Step 2:** Config plugin so EAS/dev client includes module (`npx expo prebuild` / dev client—not Expo Go for overlay)

- [ ] **Step 3:** Perf QA: idle 10 min + side-by-side scroll test

---

## Task 14: QA checklist

Write results in `mobile/QA.md`:

### Functional
- [ ] Expo app runs on device/emulator  
- [ ] Auth  
- [ ] Verify URL / text / image  
- [ ] Scan + review  
- [ ] Clipboard  
- [ ] Share intent (Android)  
- [ ] Result + history  

### Assist (if built)
- [ ] Default off  
- [ ] Half-hide / hide / turn off  
- [ ] No unsolicited popups  

### Perf / ethics
- [ ] No main-thread freeze on analyze  
- [ ] Image prep keeps payloads small  
- [ ] No silent capture  

---

## Suggested order

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14
```

**Hackathon MVP:** Tasks 1–9 (+ 11 partial).  
**Assist:** 12–13 if time.

---

## Commands cheat sheet

```bash
cd mobile
cp .env.example .env   # fill values
npx expo start
npx expo run:android   # dev client when native modules needed
```

---

## Self-review vs design

| Requirement | Covered |
| --- | --- |
| From scratch Expo RN | Task 1 |
| Not Capacitor | Explicit supersession |
| Camera / OCR / review | Tasks 7–8 |
| Share / clipboard | Tasks 9–10 |
| Floating assist calm + fast | Tasks 12–13 |
| Same API + Supabase | Tasks 3–5 |
| Perf | Tasks 7, 13–14 |

---

## Handoff for Claude

Implement **this** plan only:

1. `docs/superpowers/specs/2026-07-18-mobile-expo-react-native-design.md`  
2. `docs/superpowers/plans/2026-07-18-mobile-expo-react-native.md`  

**Ignore** Capacitor `www/` sync and WebView shell tasks from 2026-07-17 docs.

---

*End of Expo implementation plan.*
