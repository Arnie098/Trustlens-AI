# VeriSphere Mobile — Feature Inventory

**Branch:** `feat/mobile-capacitor-scanner-overlay`  
**App path:** `mobile/`  
**Stack:** Expo SDK 54 · React Native 0.81 · Expo Router · Supabase  
**Package id:** `ai.VeriSphere.app` · App name: **VeriSphere AI**  
**Scheme:** `VeriSphere://`

> Despite the branch name, this is **not Capacitor**. Capacitor was abandoned in favor of a native Expo / React Native app. See `MOBILE.md` and `mobile/README.md` for setup.

---

## 1. Product summary

VeriSphere AI mobile is a media-literacy companion that lets users:

1. **Verify** links, claims, screenshots, and camera scans with a TrustScore + evidence.
2. **Learn** media literacy via courses, lessons, and quizzes.
3. **Earn badges** for verification and learning milestones.
4. On **Android native builds**, use **Floating Assist** — a teal “TL” bubble over other apps (e.g. Facebook) that can screenshot the screen and run AI analysis without leaving the social app.

Backend split:

| Concern | Backend |
| --- | --- |
| Auth, profiles, verifications, learn, badges, image storage | **Supabase** |
| AI analysis (`POST /api/analyze`) | **Web API** via `EXPO_PUBLIC_API_BASE_URL` |

---

## 2. Navigation map (11 screens)

### Auth stack (`app/(auth)/`)

| Screen | Route | Status |
| --- | --- | --- |
| Login | `/(auth)/login` | ✅ Implemented |
| Register | `/(auth)/register` | ✅ Implemented |

### Main tabs (`app/(app)/(tabs)/`)

| Tab | Route | Status |
| --- | --- | --- |
| Home | `/(app)/(tabs)/` | ✅ Implemented |
| Verify | `/(app)/(tabs)/verify` | ✅ Implemented |
| Learn | `/(app)/(tabs)/learn` | ✅ Implemented |
| Badges | `/(app)/(tabs)/achievements` | ✅ Implemented |
| Profile | `/(app)/(tabs)/profile` | ✅ Implemented |

### Stack (modals / detail)

| Screen | Route | Status |
| --- | --- | --- |
| Verification result | `/(app)/verify/[id]` | ✅ Implemented |
| Course player | `/(app)/learn/[slug]` | ✅ Implemented |
| Quiz | `/(app)/quiz/[moduleId]` | ✅ Implemented |
| Floating Assist sheet | `/(app)/assist` | ✅ Implemented |

Entry routing: `app/index.tsx` + session gate in `app/(app)/_layout.tsx`.

---

## 3. Feature details

### 3.1 Authentication & session

| Capability | Details | Status |
| --- | --- | --- |
| Email/password sign-in | Supabase Auth via `SessionProvider` | ✅ |
| Sign-up | Email, password, optional full name | ✅ |
| Session persistence | Supabase client + auth state listener | ✅ |
| Profile load | `profiles` (full_name, email, ai_consent) | ✅ |
| Sign-out | Clears session → login | ✅ |
| Demo accounts | Login screen one-tap demo user / admin (create-if-missing) | ✅ |
| Config guard | Clear alert if Supabase env missing | ✅ |

**Demo credentials (login screen):**

- Learner: `learner@trustlensai.app` / `demo-trustlens-2026`
- Admin: `admin@trustlensai.app` / `demo-trustlens-2026`

---

### 3.2 Home dashboard

| Capability | Details | Status |
| --- | --- | --- |
| Branding | VeriSphere AI logo + wordmark | ✅ |
| Quick actions | Verify content · Scan post · Verify clipboard · Achievements | ✅ |
| Recent verifications | Last 8 requests for signed-in user | ✅ |
| TrustScore preview | Score + category color/label per row | ✅ |
| Pull-to-refresh | Refetch on focus + pull | ✅ |
| Open result | Tap row → result screen | ✅ |

---

### 3.3 Verify (core product)

Four input modes on one screen:

| Mode | What users do | Status |
| --- | --- | --- |
| **URL** | Paste / type a link; normalized before submit | ✅ |
| **Text** | Paste a claim or caption | ✅ |
| **Image** | Pick from gallery; resize/compress; upload + analyze | ✅ |
| **Scan** | Camera capture of a post; same image pipeline | ✅ |

Supporting behaviors:

| Capability | Details | Status |
| --- | --- | --- |
| AI consent gate | Toggle required before analyze; written to `consent_records` + profile | ✅ |
| Clipboard paste | Fills URL or Text tab automatically | ✅ |
| Prefill from routes | `tab` + `prefill` query params (home, deep links, share) | ✅ |
| Image prep | Resize/compress via `expo-image-manipulator` | ✅ |
| Storage upload | JPEG → Supabase `verification-uploads` bucket + `uploaded_content` row | ✅ |
| OCR (OCR.space) | Primary: server `OCR_SPACE_API_KEY` → `POST /api/ocr` (mobile + website Verify) | ✅ |
| OCR (UNESCO server) | Optional: `EXPO_PUBLIC_OCR_URL` → local Flask Tesseract | ✅ Optional |
| OCR (on-device optional) | ML Kit / expo-text-recognition if installed | ✅ Optional |
| OCR manual fallback | Caption field always editable; image-only analyze if no text | ✅ |
| Analyze pipeline | Create `verification_requests` → `POST /api/analyze` → save `verification_results` | ✅ |
| First-verification badge | Upserts `first-verification` on success | ✅ |

**OCR note:** Primary path is the **UNESCO OCR** Flask service (`D:\Hackaton\App\UNESCO\OCR\ocr-prototype`) via `EXPO_PUBLIC_OCR_URL`. Optional on-device ML Kit is a fallback. Without either, scan/image still works via image analysis and/or manual caption.

---

### 3.4 Verification results (Trust assessment)

| Capability | Details | Status |
| --- | --- | --- |
| TrustGauge | Visual score + category | ✅ |
| Confidence | Shown as percent | ✅ |
| AI-generated flag | Highlight when detected | ✅ |
| Summary | Free-text summary | ✅ |
| Source assessment | Source quality narrative | ✅ |
| Context analysis | Context section | ✅ |
| Concerns | Bullet list | ✅ |
| Evidence | Bullet list (+ citations when present) | ✅ |
| Next steps | Recommended actions | ✅ |
| Trust Replay | Timeline-style `replay_data` nodes (platform, reach, warnings) | ✅ |
| New verification CTA | Back to Verify | ✅ |

---

### 3.5 Learn (courses)

| Capability | Details | Status |
| --- | --- | --- |
| Module catalog | From `learning_modules` ordered by `sort_order` | ✅ |
| Progress display | From `user_learning_progress` (%, completed) | ✅ |
| Course player | Lessons by slug; progress bar | ✅ |
| Lesson body | `content` / `body` fields | ✅ |
| Mark complete | Advances lesson; upserts progress | ✅ |
| Quiz entry | Link to quiz when module has a quiz | ✅ |
| Pull-to-refresh | Catalog refresh | ✅ |

---

### 3.6 Quiz

| Capability | Details | Status |
| --- | --- | --- |
| Question flow | One question at a time; options from DB | ✅ |
| Score / pass | Pass threshold from quiz (`pass_score`, default 70%) | ✅ |
| Persist attempt | `quiz_attempts` (score, total, passed, answers) | ✅ |
| Critical-thinker badge | On pass | ✅ |
| Learning progress | Upsert progress when passed | ✅ |
| Explanations | Shown after answer when present | ✅ |

---

### 3.7 Achievements (badges)

| Capability | Details | Status |
| --- | --- | --- |
| Badge catalog | All rows from `badges` | ✅ |
| Earned state | Join with `user_badges` | ✅ |
| Progress count | “X of Y earned” | ✅ |
| Locked / earned UI | Visual distinction + award date | ✅ |
| Known award slugs | `first-verification`, `critical-thinker` | ✅ |

---

### 3.8 Profile & settings

| Capability | Details | Status |
| --- | --- | --- |
| Account info | Email, display name, AI consent status | ✅ |
| Floating Assist toggle | Default **off**; persisted in SecureStore / localStorage | ✅ |
| Overlay permission shortcut | Android: open “Display over other apps” settings | ✅ |
| Screen capture permission | Android: MediaProjection grant | ✅ |
| Hide for 1 hour | Suppresses bubble temporarily | ✅ |
| Try assist now | Opens in-app Assist sheet | ✅ |
| Config diagnostics | Backend label, analyze API URL, native capture linked? | ✅ |
| Sign out | ✅ |

---

### 3.9 Floating Assist (flagship mobile feature)

#### Product UX (intended)

1. User enables **Floating Assist** in Profile (off by default).
2. On Android **native** install, grants **Display over other apps**.
3. Teal **TL** bubble docks on the right edge (works over Facebook etc.).
4. Tap bubble → menu:
   - **Analyze content on my screen** (primary)
   - **Use copied text instead**
5. App captures the screen (MediaProjection; permission once).
6. AI analyzes capture → compact result (score, category, summary).
7. Result can appear as floating card / in-app sheet; auto-dismiss ~14s for overlay results.

#### Implementation layers

| Layer | Path | Status |
| --- | --- | --- |
| Expo config plugin | `mobile/plugins/withFloatingAssist.js` | ✅ |
| Local Expo module | `mobile/modules/floating-assist/` | ✅ |
| JS bridge | `src/features/assist/bridge.ts` + module `src/index.ts` | ✅ |
| Auto-analyze helpers | `src/features/assist/autoAnalyze.ts` | ✅ |
| In-app Assist UI | `app/(app)/assist.tsx` | ✅ |
| Demo FAB (Expo Go / web) | `AssistDemoBubble` in tab layout | ✅ |
| Native bubble service | `FloatingBubbleService.kt` | ✅ |
| Screen capture | MediaProjection services + activities | ✅ |
| Overlay result card | `FloatingResultOverlay.kt` | ✅ |
| Native analyze client | `AnalyzeClient.kt` (uses shared API base URL) | ✅ |
| Foreground notification | “VeriSphere assist is on” channel | ✅ |

#### Platform matrix

| Environment | Floating bubble over other apps | Screen capture | In-app assist |
| --- | --- | --- | --- |
| Android native (`npm run android`) | ✅ Full | ✅ Full | ✅ |
| Expo Go | ❌ | ❌ | ✅ Demo FAB + clipboard/gallery |
| Web | ❌ | ❌ | ✅ Demo FAB + clipboard/gallery |
| iOS | ❌ (system limit) | ❌ | ✅ Share / copy + assist sheet |

---

### 3.10 Deep links & share

Scheme: **`VeriSphere://`**

| Entry | Behavior | Status |
| --- | --- | --- |
| `VeriSphere://assist` | Open Assist menu | ✅ |
| `VeriSphere://assist?action=clipboard` | Analyze clipboard | ✅ |
| `VeriSphere://assist?action=capture` (+ optional `path`) | Analyze capture file | ✅ |
| `VeriSphere://verify?tab=...&prefill=...` | Open Verify prefilled | ✅ |
| Android `SEND` intent | `text/plain` and `image/*` filters in `app.json` | ✅ Declared |
| Incoming URL handler | `useIncomingShare` via `expo-linking` | ✅ |

---

### 3.11 Design system & UX polish

| Item | Status |
| --- | --- |
| Dark “Ocean Deep” theme (navy/teal) | ✅ |
| Fonts: Space Grotesk + DM Sans | ✅ |
| Shared UI primitives (`Screen`, `Card`, `Button`, `Input`, …) | ✅ |
| TrustGauge component | ✅ |
| Category color mapping | ✅ |
| Safe-area aware tab bar (gesture nav) | ✅ |
| Portrait orientation, branded splash/icons | ✅ |
| Adaptive Android icons | ✅ |

---

## 4. Technical architecture

```
mobile/
  app/                         # Expo Router screens
  src/
    components/                # TrustGauge, ui primitives
    features/
      auth/                    # SessionProvider
      assist/                  # Floating Assist bridge + auto-analyze
      share/                   # Deep link / share handler
    lib/
      api/analyze.ts           # POST /api/analyze client
      verify/submit.ts         # Request + result persistence
      image-prep.ts            # Resize/compress
      image-upload.ts          # Bytes for storage
      ocr.ts                   # UNESCO OCR client + optional ML Kit
      unesco-ocr/              # HTTP client for ocr-prototype
      supabase.ts / db.ts      # Backend access
      trust.ts                 # Labels / confidence helpers
      types/analysis.ts        # Shared analysis types
    theme/                     # colors, typography
  modules/floating-assist/     # Android native Expo module
  plugins/withFloatingAssist.js
  android/                     # Prebuild native project (committed)
```

### Monorepo scripts (repo root `package.json`)

| Script | Action |
| --- | --- |
| `npm run mobile` | `expo start` in `mobile/` |
| `npm run mobile:web` | Expo web |
| `npm run mobile:android` | Native Android build/install |
| `npm run mobile:ios` | Native iOS build |

### Environment (`mobile/.env`)

| Variable | Role |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `EXPO_PUBLIC_API_BASE_URL` | Host for `POST /api/analyze` |
| `EXPO_PUBLIC_OCR_URL` | UNESCO OCR base URL (e.g. `http://localhost:5001`) |
| `EXPO_PUBLIC_OCR_API_KEY` | Optional if OCR server requires `X-API-Key` |
| `EXPO_PUBLIC_DB_PROVIDER` | Default `supabase` (`sqlite` only for rare local hacks) |

Android emulator rewrites `localhost` → `10.0.2.2` for the analyze API.

---

## 5. Data surfaces used

| Table / storage | Used by |
| --- | --- |
| Auth (Supabase) | Login, session |
| `profiles` | Profile, consent |
| `consent_records` | AI consent audit |
| `verification_requests` | Verify pipeline, Home recent |
| `verification_results` | Results, Assist |
| `uploaded_content` + `verification-uploads` | Image/scan |
| `learning_modules`, `lessons` | Learn |
| `quizzes`, `quiz_questions`, `quiz_attempts` | Quiz |
| `user_learning_progress` | Learn progress |
| `badges`, `user_badges` | Achievements |

---

## 6. Permissions (Android)

Declared in `app.json` / manifests:

- Camera
- Read media images
- System alert window (overlay)
- Foreground service (+ special use, media projection)
- Post notifications

iOS Info.plist usage strings: camera, photo library (for scan/import only).

---

## 7. Known limits / not shipping yet

| Item | Notes |
| --- | --- |
| Capacitor shell | Abandoned; branch name is historical |
| iOS over-app bubble | Not possible with same UX; use Share / copy / in-app assist |
| OCR without UNESCO service running | Set `EXPO_PUBLIC_OCR_URL` + run `python api.py`; falls back to manual caption |
| Offline-first SQLite mode | Env switch exists; not the product default |
| Expo Go native capture | Requires `npm run android` install of VeriSphere AI |
| Web as primary product | Web demo only; not a substitute for native assist |

---

## 8. Related docs

| Doc | Purpose |
| --- | --- |
| `MOBILE.md` | Monorepo mobile pointer + quick start |
| `mobile/README.md` | Setup, scripts, Floating Assist runbook |
| `docs/superpowers/specs/2026-07-18-mobile-expo-react-native-design.md` | Original Expo design (supersedes Capacitor) |
| `docs/superpowers/plans/2026-07-18-mobile-expo-react-native.md` | Implementation plan |
| `docs/superpowers/specs/2026-07-17-mobile-capacitor-scanner-overlay-design.md` | Historical Capacitor design (superseded) |

---

## 9. Feature checklist (at-a-glance)

| Feature | Status |
| --- | --- |
| Auth (sign-in / sign-up / session) | ✅ |
| Demo login accounts | ✅ |
| Home + recent history | ✅ |
| Verify URL | ✅ |
| Verify text | ✅ |
| Verify image (gallery) | ✅ |
| Verify scan (camera) | ✅ |
| Image prep (resize/compress) | ✅ |
| UNESCO OCR server (Tesseract) | ✅ via `EXPO_PUBLIC_OCR_URL` |
| OCR (optional ML Kit) | ✅ Optional |
| Clipboard verify | ✅ |
| Deep links `VeriSphere://` | ✅ |
| Android share intents (declared) | ✅ |
| Results + TrustGauge | ✅ |
| Trust Replay | ✅ |
| Learn catalog + course player | ✅ |
| Quiz + pass badges | ✅ |
| Achievements | ✅ |
| Profile + consent display | ✅ |
| Floating Assist (Android native) | ✅ |
| Floating Assist demo (Expo Go / web) | ✅ |
| Analyze API client | ✅ |
| Supabase as system of record | ✅ |
