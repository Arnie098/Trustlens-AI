# TrustLens Mobile

**Only one mobile project:** `mobile/`

| Path | Status |
| --- | --- |
| **`mobile/`** | ✅ **Ship this** — Expo + React Native (11 screens, Supabase, verify, learn, assist) |
| `mobile-expo/` | ❌ Removed — was an empty create-expo-app scaffold that caused confusion |

This is **not** Capacitor. Capacitor was abandoned; do not recreate a Capacitor shell unless product direction changes.

## Expo Go SDK note

This project targets **Expo SDK 54** so it works with the **Expo Go** app from the Play Store / App Store.

If you see **“Project is incompatible with this version of Expo Go”**:

1. Update **Expo Go** from the store, **or**
2. Your phone’s Expo Go may only support an older SDK — tell us which SDK Expo Go shows in its settings.

SDK 57 is not always available in store Expo Go yet (App Store review lag).

## Run (web or device)

```powershell
cd mobile
npm install          # first time
npx expo start       # QR for Expo Go, or press w for web
```


From repo root:

```powershell
npm run mobile
```

## Env

Copy `mobile/.env.example` → `mobile/.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL` (host that serves `POST /api/analyze`)
- `EXPO_PUBLIC_DB_PROVIDER=supabase`

## Screens (11)

Auth: login, register  
Tabs: home, verify, learn, badges, profile  
Stack: verify result, course, quiz, floating assist

See `mobile/README.md` for features and floating assist notes.
