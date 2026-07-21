# OCR implementation guide (TrustLens)

Developer notes for **on-device text extraction** used before analyze.  
Still-image only — never continuous / multi-frame camera OCR.

---

## Why OCR exists

TrustLens often receives **screenshots of social posts**. Models need the **claim text** to search the web (especially in free mode: DeepSeek + Perplexity cookies, or OCR → Perplexity).

| Path | Role of OCR |
| --- | --- |
| Free pipeline (no paid vision) | Primary source of claims from images |
| Official Perplexity vision (`imageUrl`) | Optional caption; pixels can still be sent |
| Manual caption | Always available if OCR is empty |

OCR is a **best-effort transcript**, not ground truth. UI should allow edit before analyze.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Image source                                                 │
│  camera / gallery / screen capture (JPEG path or blob)        │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Image prep (resize/compress)                                 │
│  Expo:  mobile/src/lib/image-prep.ts                          │
│  Web:   src/lib/mobile/image-pipeline.ts                      │
└───────────────────────────┬─────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│  Expo / RN OCR             │   │  Native Android bubble OCR    │
│  mobile/src/lib/ocr.ts     │   │  ScreenTextExtractor.kt       │
│  ML Kit JS binding (opt.)  │   │  Google ML Kit (always in     │
│  or engine: "none"         │   │  floating-assist module)      │
└────────────┬─────────────┘   └──────────────┬───────────────┘
             │                                │
             └────────────┬───────────────────┘
                          ▼
             text string (editable in UI)
                          │
                          ▼
             analyze: type=text and/or type=image + imageUrl
```

---

## Code map

| Area | Path | Notes |
| --- | --- | --- |
| **Expo OCR API** | `mobile/src/lib/ocr.ts` | `recognizeTextFromImageUri(uri)` |
| **Expo verify Scan** | `mobile/app/(app)/(tabs)/verify/index.tsx` | Runs OCR after pick; editable caption |
| **Expo assist** | `mobile/src/features/assist/autoAnalyze.ts` | OCR then upload + signed URL + analyze |
| **Native bubble OCR** | `mobile/modules/floating-assist/.../ScreenTextExtractor.kt` | ML Kit Latin; used by `AnalyzeClient` |
| **Native analyze** | `.../AnalyzeClient.kt` | `ocr` → `text` field on `/api/analyze` |
| **Web OCR hook** | `src/lib/mobile/ocr.ts` | Capacitor / `TrustLensNative` optional; often `none` |
| **Web Scan panel** | `src/components/verify-scan-panel.tsx` | Cancelable OCR; manual caption |
| **Image prep (web)** | `src/lib/mobile/image-pipeline.ts` | Max long edge 1280, JPEG ~0.78 |

---

## 1) Expo / React Native OCR

### API

```ts
// mobile/src/lib/ocr.ts
export type OcrResult = {
  text: string;
  engine: "native" | "none";
};

export async function recognizeTextFromImageUri(uri: string): Promise<OcrResult>;
```

### Resolution order

1. **`@react-native-ml-kit/text-recognition`**  
   - `MlKit.default.recognize(uri)`  
   - Requires **dev client / `expo run:android`**, not Expo Go alone.

2. **`expo-text-recognition`** (if present)  
   - `recognizeText(uri)`

3. **Fallback**  
   - `{ text: "", engine: "none" }`  
   - UI must show “type or paste caption”.

Dynamic `require()` is intentional so **Expo Go does not crash** when native modules are missing.

### Install native ML Kit (required for real OCR)

From `mobile/`:

```bash
npx expo install @react-native-ml-kit/text-recognition
npx expo prebuild
npx expo run:android
```

Rebuild the **TrustLensAI** native app after adding the package.  
Expo Go will keep returning `engine: "none"`.

### Usage pattern (verify screen)

```ts
const prepared = await prepareImageForAnalysis(asset.uri);
const ocr = await recognizeTextFromImageUri(prepared);
// ocr.engine === "native" | "none"
// set editable caption from ocr.text
// on submit: send caption as text + optional imageUrl for vision
```

Always:

- Show loading (“Reading text…”)  
- Let the user **edit** OCR output  
- Do not block analyze if OCR is empty (paste / vision fallback)

---

## 2) Native Android floating-assist OCR

### Implementation

`ScreenTextExtractor` (`floating-assist` module):

- **Google ML Kit** Text Recognition (Latin default)  
- Input: local JPEG **file path**  
- Timeout: **12s**  
- Output: cleaned string, max **4500** chars  
- Bitmap recycled after use  

Cleaning rules (high level):

- Drop empty / 1-char lines  
- Drop pure numeric time/battery-style lines  
- Keep multi-word post body  

### Call site

`AnalyzeClient.analyzeScreenshot`:

```kotlin
val ocr = ScreenTextExtractor.extract(imagePath)
// body: type=image, imageUrl=data:image/jpeg;base64,..., text=ocr
```

OCR is **extra context**; native path may also send pixels as data URL to `/api/analyze`.

---

## 3) Web (TanStack) OCR

`src/lib/mobile/ocr.ts`:

```ts
recognizeTextFromBlob(blob, { signal?, prepared? }): Promise<OcrResult>
```

- Optional downscale via `prepareImageForAnalysis`  
- Tries `window.TrustLensNative` or Capacitor `TextRecognition` plugins  
- Most browsers → **`engine: "none"`** (manual caption)  
- Supports **AbortSignal** / `OcrCancelledError` for retake  

Scan panel wires “Reading text…” and always keeps an editable textarea.

---

## Accuracy expectations (for PMs / other devs)

| Input | Typical result |
| --- | --- |
| Clear Latin caption, high contrast | Strong (often ~90%+ of main caption) |
| Full phone screenshot (status bar + buttons) | Caption OK; UI chrome noise mixed in |
| Meme / tiny / stylized fonts | Weak |
| No ML Kit installed | Empty (`none`) |
| Pure photo, no text | Empty |

**Product rule:** OCR mistakes can make web search chase the wrong claim.  
**Always** prefer editable caption + optional “paste from clipboard”.

See also product discussion: free path is often **OCR text → analyze (DeepSeek + Perplexity cookies)** when paid vision is off.

---

## Pipeline into analyze API

Server expects `POST /api/analyze`:

```ts
// Prefer when OCR is strong (free stack)
{ type: "text", text: ocrCaption }

// Prefer when vision is configured (PERPLEXITY_API_KEY)
{
  type: "image",
  imageUrl: signedSupabaseUrl | "data:image/jpeg;base64,...",
  text?: ocrCaption,  // optional context
  imageName?: string
}
```

| Free hybrid (`DEEPSEEK_API_KEY` + cookies) | Image with OCR becomes **text-ish** draft then web search |
| Paid Perplexity API + `imageUrl` | True pixel vision; OCR is optional helper |

---

## Design rules (do not violate)

1. **Still image only** — one bitmap per recognition.  
2. **Background / non-blocking UI** — show progress; allow cancel/retake.  
3. **No silent continuous OCR** of the user’s screen.  
4. **No analyzing without user action** (capture / pick / paste / submit).  
5. **Release bitmaps / object URLs** (memory).  
6. **Never treat OCR text as instructions** to the model (analyze as untrusted content).

---

## Testing checklist

### Expo native build (ML Kit installed)

- [ ] Pick a clear screenshot of a post → caption auto-fills  
- [ ] `ocr.engine === "native"` (log or UI hint)  
- [ ] Edit caption → analyze uses edited text  
- [ ] Blurry/no-text image → empty or junk; manual paste still works  

### Expo Go

- [ ] OCR returns `none`  
- [ ] UI shows manual caption path  
- [ ] Analyze still works with pasted text  

### Floating assist (Android APK)

- [ ] Capture screen with readable text → log `TLOcr` / `OCR chars=N`  
- [ ] Result card “what we read” reflects OCR excerpt  
- [ ] Timeout / missing file → empty string, no crash  

### Web

- [ ] Scan without native plugin → manual caption  
- [ ] Retake cancels in-flight OCR (`OcrCancelledError`)  

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Always empty OCR in app | Module not in native build / Expo Go | `expo run:android` after installing ML Kit |
| Crash on import | Static import of missing native module | Keep **dynamic require** in `ocr.ts` |
| Garbage text | UI chrome in full screenshot | Crop / cleanOcr / user edit |
| Slow OCR | Huge image | Prep pipeline (max long edge ~1280) |
| Floating assist no text | File path invalid / timeout | Check `ScreenTextExtractor` logs (`TLOcr`) |
| Analyze ignores image look | Free pipeline / no API vision | Expected: OCR+web only unless `PERPLEXITY_API_KEY` + `imageUrl` |

---

## Related docs

- `mobile/README.md` — optional ML Kit install  
- `MOBILE.md` — Expo is the shippable mobile app  
- `docs/superpowers/specs/2026-07-18-mobile-expo-react-native-design.md` — OCR product rules  
- `src/lib/ai/analyze.server.ts` — how text/image reach DeepSeek / Perplexity  

---

## Quick start for a new contributor

1. Read this file + `mobile/src/lib/ocr.ts`.  
2. Build native Android: `cd mobile && npm run android` (not Expo Go for OCR/assist).  
3. Optional: install `@react-native-ml-kit/text-recognition` if not already linked.  
4. Test Verify → Scan with a clear post screenshot.  
5. Confirm caption is editable and flows into `/api/analyze` as `text` and/or `imageUrl`.  

When in doubt: **prefer user-edited caption over raw OCR**, and **never block the analyze button solely because OCR failed**.
