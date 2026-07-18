# TrustLens Mobile (Expo + React Native)

**This is the only mobile app in the monorepo.**  
Do not use or recreate `mobile-expo/` (empty scaffold — removed).  
Native client — **not** Capacitor.

Full monorepo note: see `../MOBILE.md`.

## Features

| Feature | Status |
| --- | --- |
| Auth (Supabase) | Yes |
| Verify URL / text / image / scan | Yes |
| Image prep (resize/compress) | Yes |
| OCR (still image) | Tries ML Kit if installed; else manual caption |
| Clipboard verify | Yes |
| Deep links `trustlens://verify?...` | Yes |
| Results + Trust Replay | Yes |
| Learn catalog + course player | Yes |
| Quiz + pass badges | Yes |
| Achievements | Yes |
| Floating Assist (capture screen / text → auto analyze) | Yes — native bubble captures screen (with permission) + AI; demo FAB in Expo Go |

## Setup (Supabase — default)

```bash
cd mobile
cp .env.example .env
# Fill:
#   EXPO_PUBLIC_DB_PROVIDER=supabase
#   EXPO_PUBLIC_SUPABASE_URL=...
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=...
#   EXPO_PUBLIC_API_BASE_URL=...   # host that serves POST /api/analyze

npm install
npx expo start --web
```

Auth, profiles, verifications, learn, quizzes, badges, and image storage all go through **Supabase**.  
`EXPO_PUBLIC_API_BASE_URL` is only for the analyze engine (API key stays on the server).

Create a user via **Create account** in the app, or in the Supabase Auth dashboard.

## Floating Assist (desired UX)

1. Enable **Floating Assist** in Profile (default off).
2. On **Android native build** (`npx expo run:android`): grant **Display over other apps**. A **TL** bubble floats over Facebook.
3. Tap the floating window → **Analyze content on my screen**.
4. The floating window takes a **screenshot** (Android asks permission once).
5. AI analyzes that screenshot → **compact result** (score, category, summary) that auto-closes in ~14s.
6. Optional: **Use copied text instead** if you already copied a caption.

On **Expo Go / web**: demo bubble only; auto screen capture requires the native Android build. Photo pick is offered as a fallback.

## Optional native OCR

```bash
npx expo install @react-native-ml-kit/text-recognition
npx expo prebuild
npx expo run:android
```

Without this, Scan / screenshot still works with image analysis + manual caption if OCR is missing.

## Scripts

- `npm start` — Expo Go / Metro only (no custom native screenshot)
- `npm run android` — **build & install TrustLensAI** on a USB phone (required for floating screenshot)
- `npm run android:go` — open Expo Go (limited)
- `npm run typecheck` — TypeScript

### Install native app (required for “Analyze content on my screen”)

Expo Go **cannot** screenshot Facebook. You need the real app:

1. On the phone: enable **Developer options** → **USB debugging**
2. USB-connect the phone to this PC (`adb devices` should list it)
3. From `mobile/`:

```bash
npm run android
```

4. Open the **TrustLensAI** icon on the phone (not Expo Go)
5. Profile → enable Floating Assist → on Facebook tap bubble → **Analyze content on my screen**
