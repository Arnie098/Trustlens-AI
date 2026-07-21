# TrustLens Mobile — React Native + Expo (from scratch)

**Date:** 2026-07-18  
**Status:** Active plan (replaces Capacitor approach)  
**Product:** TrustLensAI (UNESCO Youth Hackathon 2026)  
**Supersedes:** `docs/superpowers/specs/2026-07-17-mobile-capacitor-scanner-overlay-design.md`

---

## 1. Goal

Create a **new native mobile app from scratch** in a separate directory (`mobile/`) using **React Native + Expo**. Port TrustLens product flows (auth, verify, results, dashboard, learn, profile) into native UI—not a WebView wrap of the website.

Must include:

1. **Camera / image scanner** — photograph or import a post → analyze (image + OCR text path).
2. **Text reader (OCR)** — extract caption text from a still image; user edits before analyze.
3. **Floating Verify Assist (Android)** — optional, calm bubble while user scrolls social apps.
4. **Share + clipboard** — receive content from other apps; verify on user action only.
5. **Performance** — mid-range phones stay smooth; assist idle ≈ zero cost.
6. **Non-annoying overlay** — default off, half-hide, no spam, easy dismiss.

**Non-negotiable product bar:**

- Snappy on mid-range Android (not only flagships).
- Floating bubble on → TikTok/IG still scroll smoothly (no lag complaints).
- Bubble = quiet tool, never a billboard.

---

## 2. Why Expo (changed from Capacitor)

| | Capacitor (old plan) | **Expo / React Native (this plan)** |
| --- | --- | --- |
| UI | Reuse web DOM in WebView | **Native components** built for touch |
| Feel | Website-in-a-shell | Real app navigation, lists, gestures |
| Camera / OCR | Plugins + bridge | First-class Expo modules |
| Floating overlay | Custom Android + WebView app | Custom native module + RN UI for in-app |
| Code reuse | High (same React web) | **Logic/types/API reuse**; UI rewritten |
| Scope | Faster shell | More work; better mobile UX |

**Reuse from web (not copy-paste UI):**

- Product concepts: TrustScore, categories, verify types, learning loop  
- API contracts: `POST /api/analyze`, Supabase tables  
- Types / scoring labels (`trustLabel`, category thresholds) — shared or duplicated lightly  
- Design tokens: Ocean Deep navy/teal/aqua, Space Grotesk + DM Sans if licensed for RN (or close system fonts)

**Do not:** ship TanStack web routes inside a WebView as the main app.

---

## 3. What exists on web (reference only)

| Surface | Role for mobile port |
| --- | --- |
| Auth (Supabase) | Same backend |
| `/verify` URL · Text · Image | Core screens |
| Results + Trust Replay | Result + replay screens |
| Dashboard · Learn · Quiz · Achievements · Profile | Tab / stack screens |
| `POST /api/analyze` | Remote HTTPS only on device |
| `verification_requests` / `verification_results` | Same Supabase schema |

**Device path:** `Supabase Auth + DB` + **deployed** analyze API. No local Node SQLite on phone.

---

## 4. Architecture overview

```
Trustlens-Web/                    # existing web (unchanged product source of truth for API)
mobile/                           # NEW Expo app (from scratch)
  app/                            # Expo Router file routes
  src/
    components/
    features/                     # auth, verify, scan, learn, assist settings
    lib/                          # api, supabase, types, theme
    native/                       # Android overlay module bridge (TS)
  modules/                        # optional Expo config plugin / native code
    floating-assist/              # Android SYSTEM_ALERT_WINDOW bubble
```

```
┌─────────────────────────────────────────────┐
│  mobile/  Expo (React Native)               │
│  ┌───────────────────────────────────────┐  │
│  │  Expo Router screens (native UI)      │  │
│  │  Auth · Verify · Scan · Results · …   │  │
│  └───────────────────────────────────────┘  │
│  expo-camera · expo-image-picker · OCR      │
│  expo-clipboard · expo-sharing / intents    │
│  Android: FloatingAssist native module      │
└──────────────────┬──────────────────────────┘
                   │ HTTPS
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
 Deployed API   Supabase      Supabase
 /api/analyze   Auth          DB / storage
```

### 4.1 Stack (recommended defaults)

| Layer | Choice |
| --- | --- |
| Framework | **Expo SDK 53+** (or current stable), **Expo Router** |
| Language | TypeScript |
| Navigation | Expo Router (tabs + stacks) |
| Auth / DB | `@supabase/supabase-js` |
| Server state | TanStack Query (optional) or simple hooks |
| UI | React Native primitives + custom theme (not web shadcn) |
| Icons | `@expo/vector-icons` / lucide-react-native |
| Camera | `expo-camera` / `expo-image-picker` |
| Clipboard | `expo-clipboard` |
| Secure store | `expo-secure-store` for session if needed |
| OCR | `expo-text-extractor` / ML Kit community module / cloud fallback |
| Overlay | Custom Expo Module (Android Kotlin) |
| Build | EAS Build for store; `npx expo start` for dev |

### 4.2 Directory layout

```
mobile/
  package.json
  app.json / app.config.ts
  tsconfig.json
  babel.config.js
  app/
    _layout.tsx                 # root providers
    (auth)/
      login.tsx
      register.tsx
    (app)/
      _layout.tsx               # bottom tabs
      index.tsx                 # dashboard home
      verify/
        index.tsx               # tabs: url | text | image | scan
        [id].tsx                # result
      learn/
        index.tsx
        [slug].tsx
      achievements.tsx
      profile.tsx
  src/
    theme/
      colors.ts                 # Ocean Deep tokens
      typography.ts
    lib/
      supabase.ts
      api/analyze.ts
      types/analysis.ts         # mirrored from web types
      trust.ts                  # categoryFor, trustLabel
    features/
      verify/
      scan/
      auth/
      assist/                   # settings + native bridge
  modules/floating-assist/      # Android native (optional phase)
  README.md
```

Web repo stays independent; mobile only **calls** the same backend.

---

## 5. Verification input methods (“via what?”)

Same product truth as before—**user-initiated only**:

| Method | How | Platform |
| --- | --- | --- |
| Share → TrustLens | OS share sheet / intent | Android + iOS |
| Camera scan | In-app camera | Both |
| Gallery / screenshot | Image picker | Both |
| Clipboard | Read on button tap only | Both |
| URL / text paste | In-app forms | Both |
| Floating bubble actions | Scan / screenshot / clipboard / open app | **Android** |
| MediaProjection one-shot | Optional later | Android Phase 4 |

**Not allowed:** silent feed scraping, accessibility “read all text,” continuous screen OCR while scrolling.

---

## 6. Screens & navigation (MVP)

**Tabs (authenticated):**

1. **Home** — recent verifications, quick actions (Verify, Scan, Clipboard)  
2. **Verify** — URL / Text / Image / Scan  
3. **Learn** — modules list + detail + quiz entry  
4. **Profile** — consent, badges summary, Floating Assist settings (Android)

**Stacks:** result detail, Trust Replay (simplified native list/timeline), quiz.

**Auth stack:** login / register / forgot password (Supabase).

Visual language: Ocean Deep (`#0c2340` navy, teal accents), distinct—not generic purple AI template. Prefer deliberate typography hierarchy over default Expo starter look.

---

## 7. Camera scanner & text reader

| Feature | Spec |
| --- | --- |
| Capture | `expo-image-picker` / camera; still photo only for OCR |
| Prep | Downscale long edge ≤ ~1280px; JPEG compress before upload |
| OCR | On-device preferred; one still frame; background; cancelable |
| Review | Image preview + editable text + consent + Run TrustLens |
| Analyze | Same API as web: `type: "text" \| "image" \| hybrid` |

No live multi-frame OCR in MVP.

---

## 8. Floating Verify Assist (Android)

### Intent

Available while scrolling social apps; **not** attention-seeking.

### Anti-annoyance (hard rules)

| Rule | Spec |
| --- | --- |
| Default | **Off** |
| Size | ~40–48 dp icon, no labels/badges/pulse loops |
| Position | Edge-dock; remember side; never center-default |
| Idle | Auto **half-hide** after ~2.5s |
| Expand | **Only on tap**; panel ≤ ~35% height |
| No spam | No auto “misinfo detected,” no clipboard polling, no sound |
| Dismiss | Long-press → Hide now / 1 hour / Turn off (≤ 2 taps) |
| Results | Compact card; auto-dismiss ~10s if ignored |
| iOS | No system-wide bubble; Share + Shortcuts instead |

### Implementation note (Expo)

- Overlay **cannot** be pure JS. Use an **Expo Module** (Kotlin) with `SYSTEM_ALERT_WINDOW`.  
- Bubble UI = **native views**, not a second React Native root if that causes lag (prefer pure Android View for idle bubble).  
- Actions deep-link into Expo app: `trustlens://verify?tab=scan|clipboard|…`  
- Idle: no JS bridge chat, no network, no camera.

---

## 9. Performance & battery

Same budgets spirit as prior design:

| Scenario | Target |
| --- | --- |
| Cold start to interactive | ≤ ~3s mid-range (warm better) |
| Assist idle CPU | ≈ 0% sustained |
| Assist idle RAM | Minimal native service only |
| OCR still (downscaled) | ≤ ~2s typical |
| Social scroll + half-hidden bubble | No visible extra jank |

**Rules:**

- No WebView for main app or bubble.  
- Heavy work only after user action.  
- Flat lists (`FlashList` / RN `FlatList`) for history.  
- Avoid huge re-renders on dashboard.  
- Release camera and bitmaps on leave scan screen.

---

## 10. Data & API

```ts
// src/lib/api/analyze.ts
export async function analyzeContent(input: AnalysisInput): Promise<AnalysisResult> {
  const res = await fetch(`${EXPO_PUBLIC_API_BASE_URL}/api/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  // same error handling spirit as web
}
```

Env (EAS / `.env`):

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=https://your-deployed-host
```

Never ship Perplexity/server secrets in the app binary.

---

## 11. Phased delivery

| Phase | Deliverable |
| --- | --- |
| **0** | `npx create-expo-app` in `mobile/`; theme; Expo Router shell; env; Supabase auth screens |
| **1** | Verify URL + text + image gallery; call analyze API; save results; result screen |
| **2** | Scan camera + image prep + OCR + review sheet |
| **3** | Share intent receive + clipboard verify button |
| **4** | Dashboard, learn list/detail, basic quiz/achievements (parity subset) |
| **5** | Android Floating Assist module + settings; anti-annoyance + perf QA |
| **6** | Optional MediaProjection; iOS share extension polish; store assets |

MVP ship bar: Phases 0–3 solid; 4 partial OK for hackathon; 5 if time.

---

## 12. Success criteria

- [ ] Separate `mobile/` Expo app runs on Android emulator/device  
- [ ] Login + verify URL/text/image end-to-end against real API  
- [ ] Scan path: capture → OCR/edit → TrustScore  
- [ ] Clipboard / share path works on Android  
- [ ] Floating assist default off; calm; idle cheap (if Phase 5 done)  
- [ ] No silent surveillance  
- [ ] Mid-range scroll/perf QA pass  

---

## 13. Out of scope

- Capacitor / WebView shell (cancelled approach)  
- Full pixel-perfect clone of every web marketing page  
- Admin panel in mobile  
- Offline full AI without server  
- iOS true system floating bubble  

---

## 14. Open defaults

| Topic | Default |
| --- | --- |
| First OS | **Android** |
| App id | `ai.trustlens.app` |
| Router | Expo Router |
| Styling | StyleSheet + theme tokens (NativeWind optional if team prefers) |
| Bubble default | Off |
| OCR | On-device still image first |

---

## 15. Related docs

- **Implementation plan:** `docs/superpowers/plans/2026-07-18-mobile-expo-react-native.md`  
- **Superseded:** Capacitor design + plan (2026-07-17) — keep for history only  

---

*TrustLens mobile is a native Expo app that speaks the same API as the web, with camera/OCR, share/clipboard, and a calm Android floating assist—built from scratch for real mobile performance and UX.*
