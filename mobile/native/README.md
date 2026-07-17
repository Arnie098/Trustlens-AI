# TrustLens Mobile — Native Android code

This folder documents where the **custom** Android native code lives and the
non-negotiable performance rules it must follow. The actual Kotlin/Java sources
live in the generated Android project so Gradle compiles them:

```
../android/app/src/main/java/ai/trustlens/app/
  MainActivity.java              # Capacitor bridge + deep links + share intents
  overlay/AssistPlugin.kt        # @CapacitorPlugin: JS bridge (setEnabled/isEnabled/hideFor)
  overlay/AssistBubbleService.kt # Foreground service, WindowManager bubble lifecycle
  overlay/AssistBubbleView.kt    # Tiny icon view: drag, edge-snap, auto half-hide, long-press menu
  overlay/AssistPanelView.kt     # Mini action sheet (≤ 35% screen height)
  ocr/OcrHelper.kt               # ML Kit still-image text recognition
```

> The `.kt`/native files are added by the floating-assist and OCR tasks. When
> generating a fresh `android/` with `npx cap add android`, re-copy these files
> from version control (they are committed under `android/app/src/main/java/...`).

---

## Why native (not a second WebView) — design §18.3–18.4

The floating assist bubble is **native views only**. Putting a Capacitor/WebView
in the overlay would keep a whole browser in memory just to show a 44 dp icon and
would compete with TikTok/IG for GPU. WebView is used **only** for the full app.

## Idle state machine (design §18.4)

| State | Running | NOT running |
| --- | --- | --- |
| **Off** | nothing | no service, no overlay |
| **Idle half-hidden** | one parked `WindowManager` view | OCR, camera, WebView, network, clipboard watchers, animation loops |
| **Expanded panel** | lightweight native layout | full WebView (unless user taps Open/Scan) |
| **Analyzing** | one network job + progress | a second analyze, live camera |
| **Hidden (timed)** | one alarm/WorkManager to restore | overlay view (removed until then) |

## Hard rules (design §6.3 + §18.4)

- **Default off.** Preference `assist_enabled=false`. Never self-re-enable.
- **No WebView in the bubble.** No React, no charts.
- **No 16 ms loops.** Half-hide is a **one-shot** `Handler.postDelayed` (~2.5 s),
  not a per-frame timer. No 60 fps bubble animation.
- **No clipboard polling.** Read clipboard only when the user taps "Clipboard".
- **No accessibility service** ("read all text on screen") — Play policy + perf.
- **No periodic screenshot / MediaProjection** while idle.
- **Edge-snap + remember side** in `SharedPreferences`.
- **Long-press menu:** Hide now · Hide 1 hour · Turn off assist · Settings
  (≤ 2 taps to turn off).
- **Mini panel ≤ 35% screen height;** backdrop dim ≤ 20%; tap-outside closes.
- **Foreground notification** (only if the target SDK forces a FG service):
  low-importance channel, neutral text `TrustLens assist is on — tap to manage.`
- **Release aggressively:** stop the service and remove the overlay when the user
  turns assist off or a timed-hide elapses; recycle bitmaps; cancel in-flight work.
- **Hide the bubble while the camera is open** (Scan) to avoid GPU/camera contention.

## OCR rules (design §18.5)

- ML Kit Text Recognition on **one** downscaled still bitmap (≤ 1280 px long edge).
- Runs on a **background thread**, shows progress, is **cancelable**.
- **No** live multi-frame / preview OCR.
- Fail soft: if OCR is slow or fails, allow manual text entry + image-only analyze.

## Deferred (design Phase 4–5, not MVP)

- Android MediaProjection one-shot "Capture screen now" (explicit consent dialog).
- Bubble mini-result card without opening the full app.
- Separate process for the overlay **only** if profiling proves it helps.
- iOS Share Extension + Shortcuts/widget (no true iOS floating bubble).
