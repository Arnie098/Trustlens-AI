# Mobile Claude-only screenshot vision — design

**Date:** 2026-07-20
**Branch:** feat/mobile-capacitor-scanner-overlay
**Status:** approved (design)

## Goal

The floating-assist screen analyzer on mobile must use **Claude image vision and
nothing else**. Remove every fallback for the mobile screenshot path:

- No Perplexity vision
- No OCR (on-device ML Kit) or OCR-text server fallback
- No DeepSeek / cookie / mock degraded path

If Claude vision fails, the mobile card shows an error and the user retries.
The shared web app (`/api/analyze`) must remain **completely unchanged**.

## Approach

A **new isolated server route** `/api/analyze/vision` that calls
`claudeVisionAnalyze()` directly, bypassing `analyzeContentServer()` (which owns
the whole fallback chain). The mobile client switches its screenshot POST to this
route. Web keeps using `/api/analyze`.

This keeps the blast radius to: one new server file, two dispatcher edits, and the
mobile client — with zero risk to the web analysis flow.

## Changes

### 1. Server — new handler `src/lib/ai/analyze-vision-handler.ts`

`handleAnalyzeVisionApi(request)`:

- `OPTIONS` → 204 with the same CORS headers as `analyze-handler.ts`.
- `GET` → small JSON status `{ ok, engine: "claude-vision-only", vision: hasClaudeKey() }`.
- Non-POST → 405.
- Parse body as `AnalysisInput`. Require:
  - `type === "image"` (else 400)
  - non-empty `imageBase64` (else 400 — `imageUrl` / `imageName` / OCR text are NOT accepted)
- If `!hasClaudeKey()` → 500 with a clear message
  (`"Screenshot vision needs ANTHROPIC_API_KEY / CLAUDE_API_KEY on the server."`).
- Call `claudeVisionAnalyze(body)` directly. On success return the same envelope
  the mobile client already parses:
  `{ data, error: null, engine_path: "claude_vision", provider: "claude", engine_detail }`.
- On throw → reuse the Claude-specific branches of the existing error-mapping
  (missing key, api-cc rejected, `Claude API NNN`, non-JSON/parse) and return a 500
  with `{ error: { message }, engine_path: null, engine_detail }`. No fallback call.

Export `isAnalyzeVisionApiPath(pathname)` returning
`pathname === "/api/analyze/vision"`.

Reuse imports: `claudeVisionAnalyze`, `hasClaudeKey` from `./claude-vision`;
`AnalysisInput` from `./types`.

### 2. Server — dispatcher wiring (match BEFORE generic `/api/analyze`)

- `src/server.ts` (~line 30): add a check for `/api/analyze/vision` that imports and
  calls `handleAnalyzeVisionApi`, placed **above** the existing
  `/api/analyze` / `startsWith("/api/analyze/")` block so it wins.
- `vite.config.ts` (~line 29): same ordering — add the `/api/analyze/vision` branch
  before the existing analyze branch, using `server.ssrLoadModule` like the current one.

### 3. Mobile — `AnalyzeClient.kt`

- `analyzeScreenshot()` (line ~93): change POST path `"/api/analyze"` →
  `"/api/analyze/vision"`. Body is unchanged (already `type:image` + `imageBase64`).
- Simplify `pathLabel` (lines ~99-107): since only Claude can run now, collapse to
  `"Claude vision · screenshot"` on success; the error case is handled by the thrown
  exception path as today.
- `analyzeText()` stays on `/api/analyze` (unchanged — text is not in scope).
- Update the stale class doc comment (lines 35-42, and line 39's `/api/analyze` note)
  to describe the direct Claude-only path.

### 4. Mobile — remove on-device OCR (floating-assist module only)

- Delete `mobile/modules/floating-assist/android/src/main/java/ai/trustlens/floatingassist/ScreenTextExtractor.kt`
  (already unused by the capture path — the `text` field is a bare marker).
- Remove the ML Kit dependency from
  `mobile/modules/floating-assist/android/build.gradle:27`
  (`com.google.mlkit:text-recognition:16.0.1`) and its comment on line 26.

**Out of scope (untouched):** `mobile/src/lib/ocr.ts` and `src/lib/mobile/ocr.ts`
are the separate Expo/Capacitor OCR path, not the floating bubble.

## What stays untouched

- `/api/analyze`, `analyze-handler.ts`, `analyze.server.ts`, the whole web app.
- `claude-vision.ts` transport logic (freemodel/official) — reused as-is.

## Verification (build-check only)

- Web: typecheck / build the new route; hit `GET /api/analyze/vision` for status and
  confirm a `type:image` POST without `imageBase64` returns 400.
- Mobile: confirm the Kotlin edits are internally consistent and no remaining
  references to `ScreenTextExtractor` or `com.google.mlkit` exist in the
  floating-assist module. Device test (real screen capture) is run by the user.
