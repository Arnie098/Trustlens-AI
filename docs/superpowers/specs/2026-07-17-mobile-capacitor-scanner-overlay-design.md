# TrustLens Mobile — Capacitor Shell, Camera Scanner & Floating Verify Assist

**Date:** 2026-07-17  
**Status:** Draft for review  
**Product:** TrustLensAI (UNESCO Youth Hackathon 2026)  
**Parent approach:** Approach A — Capacitor shell over the existing web build  

---

## 1. Goal

Ship a **separate mobile app directory** (`mobile/`) that wraps the TrustLens web product with **Capacitor**, then extend it with mobile-native verification flows:

1. **Camera / image scanner** — photograph or import a post (or on-screen content) and run TrustLens analysis (image + OCR text reader path).
2. **Text reader** — extract readable text from the camera frame or a captured image, then verify that text.
3. **Floating assist window** — a bubble / mini panel that stays available while the user is in social apps, so they can verify a post **without fully abandoning the scroll context**.

This document is the plan for architecture, capture methods (screenshot vs alternatives), platform limits, UX, **performance (no laggy phones)**, **non-annoying floating assist**, and phased delivery.

**Non-negotiable product bar:**

- The full app must feel snappy on mid-range Android (not only flagships).
- With the floating bubble **on**, social apps (TikTok, IG, FB, browser) must remain as scrollable and playable as without TrustLens — no jank, no heat, no “my phone is lagging” complaints.
- The bubble must feel like a **quiet tool**, never a billboard: not blocking content, not nagging, not competing with the feed.

---

## 2. What already exists (web)

| Surface | Role |
| --- | --- |
| Landing, About, legal | Marketing / trust framing |
| Auth | Supabase or local SQLite session |
| `/verify` | URL · Text · Image analysis |
| Results + Trust Replay | TrustScore, evidence, concerns |
| Dashboard · Learn · Quiz · Achievements · Profile | Habit loop / literacy |

**Analyze pipeline today:** client `POST /api/analyze` with `{ type: "url" \| "text" \| "image", ... }`. Server holds the model key. Results persist to `verification_requests` / `verification_results`.

**Mobile implication:** the Capacitor app is a **client**. SQLite-on-device is not the production path. Device builds use **Supabase + a deployed analyze API**.

---

## 3. Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  mobile/  (Capacitor Android / optional iOS)                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  www/  ← production build of Trustlens-Web            │  │
│  │  (same React UI: verify, dashboard, learn, …)         │  │
│  └───────────────────────────────────────────────────────┘  │
│  + native plugins: Camera, Filesystem, Share,              │
│    Clipboard, App, StatusBar, (Android) Overlay / Bubble   │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTPS
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
   Deployed web API     Supabase Auth       Supabase DB
   POST /api/analyze    + storage           + profiles,
                                            requests, results
```

### 3.1 Directory layout

```
Trustlens-Web/
  src/                    # existing web app (source of truth for UI)
  mobile/
    package.json          # @capacitor/core, cli, android plugins
    capacitor.config.ts   # appId, appName, webDir: "www"
    www/                  # synced web build output (generated)
    android/              # native Android project
    ios/                  # optional later (Mac required)
    native/               # custom Android overlay service (if needed)
    README.md             # run / build / permissions guide
  scripts/
    sync-mobile.mjs       # web build → mobile/www → cap sync
```

### 3.2 Build pipeline

1. Build web with mobile env:  
   `VITE_DB_PROVIDER=supabase`  
   `VITE_API_BASE_URL=https://<deployed-host>`  
   `VITE_SUPABASE_URL=…` / `VITE_SUPABASE_PUBLISHABLE_KEY=…`
2. Copy/output static client assets into `mobile/www`.
3. `npx cap sync`.
4. Open Android Studio / Xcode → run device or emulator.

### 3.3 Web changes required for the shell

- **Absolute analyze URL** when `import.meta.env.VITE_API_BASE_URL` is set (Capacitor `file://` or `https://localhost` origin cannot use relative `/api/analyze` against a remote host without this).
- **Deep links** into verify with prefilled payload, e.g.  
  `trustlens://verify?mode=text|image|url&source=camera|share|clipboard|overlay`
- **Safe-area / status-bar CSS** so existing pages work under notches.
- Thin **native bridge module** (optional JS layer) that detects Capacitor and exposes: open camera, pick image, read clipboard, toggle floating assist, import last screenshot.

UI components stay shared; we **adapt**, not rewrite in React Native.

---

## 4. Verification input methods (the “via what?” answer)

Users will **not** rely on a single magic “read Instagram’s private feed API.” OS security blocks that. TrustLens mobile uses **user-initiated capture** only.

| Method | How it works | Best for | Platform notes |
| --- | --- | --- | --- |
| **A. Share sheet → TrustLens** | From IG/TikTok/FB/X, user taps Share → TrustLens | Links, some images/text | Primary path on **iOS and Android**. Most reliable. |
| **B. Camera scanner** | In-app camera: photograph the phone screen or a printed post | Posts user can point at | Works everywhere; quality depends on glare/angle. |
| **C. Gallery / screenshot import** | User takes OS screenshot, picks it in TrustLens | Exact pixels of a post | Simple; requires user to screenshot then open app (or bubble). |
| **D. Clipboard assist** | User long-press copies caption/URL; bubble or in-app “Verify clipboard” | Captions, links | Fast when text is selectable. |
| **E. URL paste** | Existing web verify URL tab | Articles, shared post links | Already implemented. |
| **F. Floating window + capture** | Bubble over other apps → quick actions | In-feed verification while scrolling | **Android-first** (true overlay). iOS uses Share / Shortcuts instead. |

### 4.1 Recommended default story (user-facing)

> While scrolling social media, tap the **TrustLens bubble** → choose **Scan with camera**, **Import screenshot**, or **Verify clipboard**.  
> We run OCR + AI signals and show a compact TrustScore card. Expand to full results anytime.

### 4.2 Screenshot: yes, but not silent

- **Yes:** screenshots are a first-class input (gallery pick + “use recent screenshot” when OS allows).
- **No:** silent continuous screenshot of other apps without consent (blocked / store-policy risk / privacy).
- **Android optional advanced:** one-shot **MediaProjection** screen capture after explicit system permission dialog (“Allow TrustLens to capture your screen?”). Session-based, user can revoke. Use only for “Capture screen now” from the bubble — not background spying.
- **iOS:** no general “capture other apps” API for third-party bubbles. Use **Share Extension**, **photo library**, and **camera**.

---

## 5. Camera scanner & text reader

### 5.1 Features

| Feature | Description |
| --- | --- |
| **Image scan** | Capture or pick image → send as `type: "image"` to `/api/analyze` (existing path). |
| **Text reader (OCR)** | Run on-device OCR on the frame/image → fill `type: "text"` with extracted caption + optional user edit before analyze. |
| **Hybrid** | OCR text + original image both stored; analyze prefers text for claims, image for visual/AI-media signals. |
| **Guided frame** | Overlay UI: “Align the post inside the frame,” torch toggle, lens tips (reduce glare). |
| **Review step** | Always show editable extracted text + image thumbnail before “Run TrustLens.” |

### 5.2 Tech choices (Capacitor)

| Concern | Choice |
| --- | --- |
| Camera / gallery | `@capacitor/camera` (+ Android permissions `CAMERA`, `READ_MEDIA_IMAGES`) |
| OCR | Prefer **on-device**: Google ML Kit Text Recognition (Android) / Vision framework (iOS via plugin or community). Fallback: cloud OCR only if on-device fails and user consents. |
| Image prep | Resize/compress before upload (bandwidth + analyze latency). |
| Bridge | Small Capacitor plugin or community OCR plugin; JS API `NativeScan.scanText(uri)`. |

### 5.3 UX flow — Scan

```
Verify tab "Scan" (new)
  → permission check
  → camera viewfinder + guide frame
  → Capture
  → OCR progress
  → Review screen:
        [image preview]
        [editable text area]
        [mode: Text analysis | Image analysis | Both]
        [consent checkbox if needed]
  → Analyze → full result page (existing verify result UX, mobile-compact)
```

Deep link: `trustlens://verify?mode=scan` opens this flow directly from the floating bubble.

---

## 6. Floating window (“verify while you scroll”)

### 6.1 Product intent

A **persistent, non-blocking assist** so media-literacy verification is available **in the moment** of social scrolling—not only after opening a separate full-screen web flow.

**Design north star:** *available, not attention-seeking.*  
If a user forgets the bubble is there until they need it, we succeeded. If they disable it after one session because it covered captions, blocked likes, or felt like adware, we failed.

### 6.2 Platform reality (must design for)

| Platform | True floating over Instagram/TikTok? | Plan |
| --- | --- | --- |
| **Android** | Yes, with `SYSTEM_ALERT_WINDOW` (“Display over other apps”) | Implement **bubble + mini panel**. |
| **iOS** | No third-party always-on overlay over other apps | **Share Extension** + optional home-screen widget / Shortcuts “Verify clipboard.” No fake floating window. |

Marketing copy must not claim a universal “float over every app on iPhone” capability.

### 6.3 Anti-annoyance rules (floating assist)

These are **hard UX requirements**, not polish.

| Rule | Spec |
| --- | --- |
| **Default off** | Floating assist is **opt-in**. Never force-enable after install. Never re-enable itself after user turns it off. |
| **Tiny by default** | Collapsed size ~**40–48 dp** diameter. Smaller than a thumb tip. No labels, no badge spam, no pulsing “look at me” glow loops. |
| **Edge-docked, not center** | Snaps to left/right screen edge (user’s last side remembered). Never restarts in the middle of a video. |
| **Auto half-hide** | After **~2.5s idle**, slide ~60% off-screen so only a thin “tab” of the bubble remains. One swipe/tap brings it fully back. |
| **Low visual noise** | ~**70–85% opacity** when idle; full opacity only when touched. No continuous animation, confetti, or bouncing. Subtle single fade-in on show only. |
| **Never block primary UI chrome** | Default dock: **mid-right or mid-left**, avoiding top status/camera cutout, bottom nav (IG/TikTok bars), and common like/comment columns when possible. User can drag anywhere; position persists. |
| **Smart hide zones** | Optional: auto-collapse fully when user is in **fullscreen landscape video** or when keyboard is open (if detectable). Manual “Hide for 1 hour / until tomorrow” from long-press menu. |
| **No unsolicited panels** | Bubble **never auto-expands**. No popups while scrolling. No “We noticed you might be reading misinformation!” prompts. No clipboard polling popups unless user taps Verify clipboard. |
| **No notification spam** | Do not fire heads-up notifications for “still active,” tips, or marketing. Optional single silent notification channel only if Android requires a foreground service — text must be neutral: “TrustLens assist is on — tap to manage.” |
| **One-tap dismiss paths** | Long-press → **Hide now** · **Hide 1 hour** · **Turn off assist** · **Settings**. Turning off is two taps max, never buried. |
| **Expand only on demand** | Tap → compact action sheet (**≤ ~35% screen height**, bottom or near bubble). Backdrop is light dim (**≤ 20%**), tap outside to close instantly. No full-screen takeover for choosing an action. |
| **Results stay compact** | TrustScore mini-card is short (score + one line + Details/Dismiss). Auto-dismiss mini result after **8–12s** if user ignores it (result still saved in app). Never sticky-block the feed. |
| **Haptics, not noise** | Optional light haptic on snap/expand only. **No sounds.** |
| **Respect Focus / DND spirit** | If user disables overlay permission or force-stops app, assist stays off until they deliberately re-enable. |
| **First-run education once** | One short coach mark inside TrustLens settings when enabling — never a tutorial overlay on top of Instagram. |

**Anti-patterns we explicitly forbid**

- Chat-head stacks with unread badges counting “unverified posts”
- Persistent bottom banners over Reels/TikTok
- Auto OCR of the screen while user scrolls
- Moving bubble that “avoids finger” in a jumpy way (causes distraction)
- Ads, upsells, or learn-module nags from the bubble

### 6.4 Android floating UX (calm interaction model)

**Collapsed bubble (idle — 99% of the time)**

- Circular TrustLens mark only, edge-snapped, auto half-hidden when idle.
- **Drag** to reposition (with light magnetic snap to edges; no fling chaos).
- **Single tap** → action sheet (mini panel).
- **Long-press** → hide / schedule hide / turn off menu.
- Double-tap (optional): Verify clipboard if non-empty, else open action sheet — **no error toast spam**.

**Expanded mini panel** (only after tap)

Height budget: **≤ 35% of screen** for actions; result card **≤ 40%**.

Actions (icons + short labels, 2-column grid if needed):

1. **Scan** → camera scanner (opens TrustLens scanner activity; bubble can hide while camera is open).
2. **Screenshot** → photo picker / recent screenshot.
3. **Clipboard** → analyze clipboard text/URL if present.
4. **Open app** → full TrustLens.
5. *(Phase 4)* **Capture screen** → one-shot MediaProjection.

**While analyzing**

- Tiny progress on mini card only; **do not** freeze the underlying social app (work on background thread / separate process where possible — see §18).
- User can dismiss the panel and keep scrolling; completion shows a **brief** mini result or quiet badge on bubble (single small checkmark for 3s, then clear — not a red notification count).

**After analysis (compact result)**

- TrustScore ring + category chip + 1-line summary.
- Buttons: **Details** · **Dismiss**.
- Auto-fade if ignored. Does **not** auto-share or auto-post.

### 6.5 Privacy & permissions (floating + capture)

- Overlay permission is **optional**; app works fully without it.
- On first enable: plain-language screen  
  > “TrustLens can show a small bubble while you use other apps. It does **not** read your feed by itself. You choose what to scan, screenshot, or paste. You can hide or turn it off anytime.”
- No accessibility-service “read all text on screen” approach (Play policy / invasive).
- No storing screenshots of other apps longer than needed for the verification request (retain per existing product retention / user delete).
- AI consent (`ai_consent`) still required before analyze (same as web).

### 6.6 iOS substitute (parity of intent, different chrome)

| Android | iOS equivalent |
| --- | --- |
| Floating bubble | Share → TrustLens; Shortcuts icon; optional widget “Verify clipboard” |
| Screen capture button | Screenshot → Share to TrustLens / open in app |
| Camera scan | Same in-app scanner |

---

## 7. End-to-end scenarios

### Scenario A — Scroll TikTok, verify a claim (Android)

1. User enables Floating Assist once.
2. While watching a video with a bold claim, they screenshot **or** tap bubble → **Scan post** and photograph the screen.
3. OCR extracts caption text; user trims junk UI chrome (“For You”, likes counts).
4. Analyze runs → compact TrustScore on mini panel → optional open full evidence page.

### Scenario B — Share from Instagram (iOS/Android)

1. Post → Share → TrustLens.
2. App receives URL and/or image.
3. Prefills verify form; user confirms consent → analyze.

### Scenario C — Copy caption only

1. Long-press caption → Copy.
2. Bubble / widget → Verify clipboard → text analysis.

### Scenario D — News article link

1. Paste or share URL → existing URL pipeline (strongest source signals).

---

## 8. Data flow (scanner / overlay → existing product)

```
Capture (camera | gallery | share | clipboard | mediaProjection)
        │
        ▼
  Normalize payload
  { type, text?, url?, imageBlob/uri? }
        │
        ├─ optional OCR ──► editable text
        │
        ▼
  POST {API_BASE}/api/analyze   (+ auth headers if required)
        │
        ▼
  Insert verification_requests / verification_results (Supabase)
        │
        ▼
  UI: compact card (overlay) and/or full /verify/$id result
```

Reuse existing result schema: `trust_score`, `category`, `summary`, `concerns`, `evidence`, `next_steps`, etc. No parallel “mobile-only” scoring engine.

---

## 9. Mobile UI surfaces to add/adapt

| Surface | Notes |
| --- | --- |
| Verify → **Scan** tab | New fourth tab beside URL / Text / Image, or replace Image with Scan (camera-first). **Recommendation:** keep Image (gallery) and add **Scan** (camera + OCR). |
| Review & confirm sheet | Shared component for all capture paths. |
| Compact result card | Used by overlay mini panel and share-extension result. |
| Settings → **Floating Assist** | Android toggle + permission deep link to system settings. |
| Onboarding carousel | One screen teaches bubble + screenshot + share. |

Visual language stays **Ocean Deep** (navy / teal / aqua), Space Grotesk + DM Sans — same as web, not a generic purple mobile template.

---

## 10. Security, store policy, ethics

- User-initiated capture only; no feed scraping.
- Transparent about AI limits (existing disclaimer).
- Overlay + screen-capture permissions explained and revocable.
- Don’t request Accessibility Service for “read all apps.”
- Don’t claim “detects fake news automatically while you scroll” without user action.
- Uploaded images/text subject to same privacy policy as web.
- HTTPS only for API; no embedding secrets in the APK (Perplexity key stays server-side).

---

## 11. Phased delivery plan

### Phase 0 — Mobile shell (foundation) + performance baseline

- Create `mobile/` Capacitor project (Android first).
- Web build → `mobile/www` sync script.
- Env: Supabase + `VITE_API_BASE_URL`.
- Fix analyze client for absolute API base.
- Status bar, splash, app id `ai.trustlens.app` (or chosen id).
- Smoke: login, verify URL/text, open result.
- **Perf baseline:** production build only on device; measure cold start & route transitions on a mid-range phone; fix worst WebView jank before feature pile-on.

### Phase 1 — Camera scanner + text reader (perf-aware)

- Capacitor Camera + gallery permissions.
- Scan UI + review step.
- On-device OCR **on single still image only** (no live multi-frame OCR).
- Image downscale/compress pipeline before upload/OCR.
- Wire to existing analyze (`text` / `image` / hybrid).
- Deep link `trustlens://verify?mode=scan`.

### Phase 2 — Share + clipboard

- Android intent filters / iOS share extension (or Capacitor Share receive pattern).
- Clipboard verify action in-app and from assist entry points.
- Prefill verify from shared URL/image/text.

### Phase 3 — Android floating assist (calm + lightweight)

- SYSTEM_ALERT_WINDOW onboarding (**default off**).
- Native-only collapsed bubble: tiny, edge-snap, **auto half-hide**, no animation loops.
- Long-press hide menu (1 hour / until tomorrow / turn off).
- Mini action panel ≤ 35% height; no unsolicited expand.
- Actions: scan, import screenshot, verify clipboard, open app.
- Compact TrustScore card + auto-dismiss; analyze off main/UI thread.
- Idle CPU/RAM budgets from §18 enforced in QA.
- Persist bubble preference + last dock side in local storage.

### Phase 4 — Optional advanced capture + perf polish

- Android MediaProjection “Capture screen now” (one-shot, explicit consent).
- Recent-screenshot helper if OEM APIs allow.
- Offline “queued when back online,” light haptics only.
- Battery drain A/B: half-hide timings, process isolation tweaks.
- Remove dead JS, lazy-load heavy dashboard charts.

### Phase 5 — iOS parity (intent, not identical chrome)

- Share Extension + scanner in app.
- Shortcuts / widget for clipboard.
- App Store assets & privacy nutrition labels.

---

## 12. Success criteria

| Criterion | Measure |
| --- | --- |
| Separate mobile dir | `mobile/` builds and installs on Android emulator/device |
| Feature parity (core) | Auth, verify URL/text/image, results, dashboard reachable in shell |
| Scanner | User can capture a post image, OCR text, edit, and get a TrustScore |
| Floating assist (Android) | Bubble shows over another app; one full path (clipboard or screenshot import) completes verify |
| **No lag complaints (assist on)** | Idle assist meets §18 budgets; TikTok/IG scroll still feels smooth in side-by-side test |
| **Not annoying** | Default off; half-hide; no auto popups; hide/off ≤ 2 taps; usability pass with 3+ testers (“not distracting”) |
| **App snappy** | Cold start & route targets in §18.2 on mid-range device |
| No silent surveillance | No capture without explicit user action + required OS dialogs |
| Ethics | Disclaimers and consent identical to web product intent |

---

## 13. Out of scope (for this plan)

- React Native rewrite.
- Reading Instagram/TikTok private APIs or accessibility scraping.
- iOS true system-wide floating bubble.
- Offline full AI analysis without a server.
- Admin panel as a priority mobile surface.
- Redesigning the marketing landing for stores (can ship later).
- Live always-on screen OCR / “AI watching your feed.”
- Gamified bubble badges, streaks, or push nags from the overlay.

---

## 14. Open decisions (defaults if you don’t override)

| Topic | Default |
| --- | --- |
| First OS | **Android** |
| App id | `ai.trustlens.app` |
| Scan vs Image tabs | **Both** (Scan = camera+OCR, Image = gallery upload) |
| OCR | On-device first, **still image only** |
| Floating bubble default | **Off** until user enables |
| Idle bubble behavior | Edge-dock + **auto half-hide ~2.5s** |
| Result mini-card | Auto-dismiss **~10s** if ignored |
| Screen capture (MediaProjection) | Phase 4, not MVP |
| Backend for device | Supabase + deployed analyze API |
| Perf reference device | Mid-range Android (~4–6 GB RAM class) |

---

## 15. Implementation checklist (summary)

1. [ ] Scaffold `mobile/` Capacitor + Android.
2. [ ] `scripts/sync-mobile.mjs` + package scripts.
3. [ ] Web: `VITE_API_BASE_URL`, deep links, safe areas.
4. [ ] Perf baseline on mid-range device (start, navigation, memory).
5. [ ] Camera + gallery permissions and Scan UI.
6. [ ] OCR bridge + review sheet + image downscale pipeline.
7. [ ] Share intent + clipboard verify.
8. [ ] Android **native** overlay: tiny bubble, half-hide, hide menu, low-power idle.
9. [ ] Mini panel + compact result (auto-dismiss, no spam).
10. [ ] Permission onboarding + privacy + anti-annoyance copy.
11. [ ] QA: §18 budgets, scroll side-by-side with assist on, “distraction” usability pass.
12. [ ] (Later) iOS share extension + App Store submission path.

---

## 16. One-line product pitch (mobile)

**TrustLens mobile wraps the same literacy product in Capacitor, adds a camera text/image scanner, and—on Android—a tiny, opt-in, half-hidden floating assist that stays out of the way until the user wants to verify a post via share, clipboard, screenshot, or scan—fast enough not to lag the phone, quiet enough not to ruin the scroll.**

---

## 17. Next step after approval

1. User reviews this spec and flags changes.
2. Write a detailed implementation plan under `docs/superpowers/plans/`.
3. Implement Phase 0 → Phase 1 first (shell + scanner + perf baseline), then calm floating assist.

---

## 18. Performance & battery plan (no laggy phones)

Users will abandon TrustLens (and leave bad reviews) if the phone heats up, scrolls stutter in TikTok, or the main app freezes during analysis. Performance is a **feature requirement**, not a late polish pass.

### 18.1 Design principles

1. **Idle costs almost nothing** — collapsed floating assist must not run AI, OCR, camera, WebView, or network loops.
2. **Heavy work only on user action** — OCR, upload, analyze start *after* explicit tap/confirm.
3. **Native bubble, not a second browser** — do **not** implement the floating window as a full Capacitor/WebView overlay. Collapsed bubble + mini panel = **lightweight native Android views** (or Compose). WebView only for the full app.
4. **One heavy job at a time** — no parallel OCR + full-res upload + dashboard refetch.
5. **Prefer stills over streams** — camera preview is short-lived; no continuous frame OCR while aiming (optional future: throttle preview OCR ≤ 1–2 fps only if we add live text boxes — **not MVP**).
6. **Release resources aggressively** — stop camera, recycle bitmaps, cancel requests when user leaves Scan or dismisses panel.

### 18.2 Target budgets (mid-range Android, ~4–6 GB RAM)

| Scenario | Target |
| --- | --- |
| Full app cold start to interactive shell | **≤ 3.0 s** (warm **≤ 1.5 s**) on production build |
| Navigate between main tabs (dashboard ↔ verify) | **≤ 200 ms** perceived; no multi-second white screens |
| Main thread blocked by our JS during scroll in-app | Avoid long tasks **> 50 ms** on interactive screens |
| **Assist idle** extra CPU | **≈ 0%** sustained (only rare alarm/heartbeat if OS forces FG service) |
| **Assist idle** extra RAM | **≤ 30–40 MB** for overlay process/service total if isolated; avoid holding full WebView in memory just for bubble |
| **Assist idle** battery | **No meaningful drain** over 1 hour screen-on social use vs control (subjective + Battery Historian) |
| OCR on downscaled still (1080px long edge) | **≤ 2 s** typical on mid-range |
| Image prep (resize/compress) | **≤ 300 ms** |
| Analyze API wait | Network-bound; UI must stay **responsive** (progress, cancel, user can leave) |
| TikTok/IG scroll with bubble half-hidden | **No visible extra jank** in side-by-side recording test |

If budgets miss on mid-range hardware, **cut work** (smaller images, fewer animations, defer charts) before shipping more features.

### 18.3 Full app (Capacitor WebView) optimizations

| Area | Plan |
| --- | --- |
| **Build** | Ship **production** minified builds only for device QA/release. Tree-shake; avoid shipping devtools. |
| **Code splitting** | Lazy-load heavy routes: dashboard charts (`recharts`), learn modules, admin (if ever linked), large marketing sections. Don’t load chart libs on Verify. |
| **Lists** | Virtualize long verification history; limit initial query sizes (already ~5–N on dashboard — keep caps). |
| **Images** | Compress team/hero assets for mobile; lazy-load below-fold; avoid full-res camera frames in DOM. |
| **Motion** | Respect `prefers-reduced-motion`; disable expensive blur/backdrop filters on low-end if janky; prefer transform/opacity. |
| **Charts** | Render dashboard charts only when section visible; static summary numbers first. |
| **Network** | Debounce refetch; React Query stale times; don’t poll analyze. Timeout + cancel already partly exist — surface **Cancel**. |
| **WebView settings** | Hardware acceleration on; avoid unnecessary `clearCache` thrash; consider mixed content off; limit DOM size on result pages. |
| **Memory** | On `app` background: pause noncritical timers, drop large blob URLs, optional trim. On low-memory callback: release image bitmaps / caches. |
| **Startup** | Defer noncritical third-party init; session restore without blocking first paint of shell. |
| **Bridge calls** | Batch native plugin calls; never call OCR/camera from render loops. |

### 18.4 Floating assist performance architecture

```
┌──────────────────────────────────────────┐
│  Full TrustLens app process (WebView)    │  ← only when user opens app
│  Heavy UI, analyze UI, history           │
└──────────────────────────────────────────┘
                    ▲ startActivity / deep link when needed
┌──────────────────────────────────────────┐
│  Assist (lightweight)                    │
│  • Foreground service ONLY if required   │
│  • Native bubble View (ImageView/icon)   │
│  • No React, no charts, no camera idle   │
│  • No clipboard polling loop             │
│  • No screen capture loop                │
│  • Touch handlers only when interacting  │
└──────────────────────────────────────────┘
```

**Idle state machine**

| State | What’s running | What’s not |
| --- | --- | --- |
| **Off** | Nothing | No service, no overlay |
| **Idle half-hidden** | WindowManager view parked; no timers except optional single hide animation completion | OCR, camera, WebView, network, clipboard watchers |
| **Expanded panel** | Lightweight native layout | Full app WebView unless user chose Open / Scan |
| **Analyzing** | One network job + progress UI | Second concurrent analyze; live camera |
| **Hidden (timed)** | Alarm/WorkManager to optionally restore if user asked “hide 1 hour” | Overlay view removed until then |

**Implementation rules**

- **No WebView inside the bubble.**
- **No 60fps animation** on the bubble; snap + single short slide for half-hide.
- **No accessibility-event listeners** for perf and policy.
- **No periodic screenshot / MediaProjection** while idle.
- **Clipboard:** read **only** when user taps “Clipboard,” not on an interval (also privacy-friendly).
- If Android requires a foreground service for ongoing overlay: use **minimal** service, `START_STICKY` carefully, low-importance notification, and stop service when user turns assist off or times hide.
- Prefer **separate process** for overlay only if it measurably reduces impact on social apps; re-measure — process isolation isn’t free. Choose based on profiling, not dogma.
- When user opens **Scan** from bubble: hide overlay during camera to free GPU/camera contention with the preview.

### 18.5 Camera, OCR & upload performance

| Step | Optimization |
| --- | --- |
| Capture | Use moderate resolution; prefer 1080–1440px long edge max for analysis |
| Downscale | Native or fast bitmap scale **before** OCR and **before** upload |
| Compress | JPEG ~0.7–0.85 quality for upload; strip EXIF if not needed |
| OCR | ML Kit on **one** bitmap; run on **background thread**; show skeleton/progress; allow cancel |
| Hybrid mode | Don’t run two full-res pipelines; OCR on downscaled; upload one compressed image |
| Fail soft | If OCR slow/fails, still allow manual text entry + image-only analyze |
| Cleanup | `recycle()` bitmaps; clear preview; abandon camera in `onPause` |

### 18.6 Network & analyze UX (perceived performance)

- Show **determinate or staged** progress (“Uploading” → “Analyzing” → “Saving”) so 10–30s waits feel intentional, not frozen.
- Keep mini-panel **draggable/dismissible** during wait so user can return to scrolling.
- Cache last N results locally for instant “Details” open.
- Retry with backoff on flaky networks; don’t spin hot loops.

### 18.7 QA protocol for lag & annoyance

**Devices:** at least one **mid-range** Android + one low-end if available.

**Performance tests**

1. Cold start × 10 — median within budget.
2. Dashboard open with many history rows — no freeze.
3. Scan → OCR → analyze — UI remains tappable; memory doesn’t climb unboundedly across 10 runs.
4. **Assist on, idle 30 min** while using TikTok — Battery Historian / simple “phone warmth” check; CPU of TrustLens near zero.
5. **Side-by-side scroll test:** same video feed with assist off vs on (half-hidden) — reviewer cannot reliably tell which recording has the bubble from scroll smoothness alone.
6. Expand/collapse bubble 50 times — no leaked windows or growing RAM.

**Annoyance / distraction tests (3+ testers)**

Script: enable assist, use IG/TikTok for **10 minutes**, try to verify **one** post.

Pass if testers agree:

- Bubble did not cover critical controls most of the time (or was easy to move).
- Nothing popped up unsolicited.
- Hiding / turning off was obvious.
- They would keep it enabled for a week (or at least not rate it “annoying”).

Fail → redesign size, default position, half-hide timing, or opacity before launch.

### 18.8 Performance checklist (engineering)

- [ ] Production builds only for perf claims.
- [ ] Lazy routes for heavy modules.
- [ ] Image pipeline: max dimension + compress.
- [ ] OCR off main thread; still frames only.
- [ ] Floating UI is native and idle-dormant.
- [ ] No clipboard/screenshot polling.
- [ ] Half-hide + hide timers don’t wake CPU every second (use one-shot handlers).
- [ ] Cancel in-flight work on dismiss/navigate away.
- [ ] Background: release camera and large bitmaps.
- [ ] Document profiling steps in `mobile/README.md`.

---

## 19. Spec self-review notes

- Performance and anti-annoyance are first-class acceptance criteria, not optional polish.
- Floating assist success = **useful when invoked**, **invisible when idle**, **cheap when on**.
- Screenshot/share/clipboard/camera remain the capture methods; none require continuous system load.

---

*Related approach: Capacitor shell over web build (Approach A). Web source of truth remains `src/`; `mobile/` owns native projects and plugins only.*
