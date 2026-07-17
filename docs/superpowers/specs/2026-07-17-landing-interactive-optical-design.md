# Landing Redesign — Interactive & Optical

**Date:** 2026-07-17
**Scope:** Marketing landing page (`/`) only. UI/UX only — no backend changes.

## Goal

Make the TrustLensAI landing page more striking by leaning into the "lens / optics"
theme: glassmorphism, light refraction, an animated TrustGauge, and a hands-on
**live-analysis demo** as the hero centerpiece. A visitor can paste a claim (or click
a preset) and watch a real TrustScore compute in place.

## Constraints & Non-Goals

- **Backend untouched.** The hero reuses the existing client entrypoint
  `analyzeContent()` → `POST /api/analyze` exactly as `verify.tsx` does. No server,
  routing, or analyze-logic changes.
- **In scope (files):**
  - `src/routes/index.tsx` — recompose hero, apply optical language to existing sections.
  - `src/components/hero-lens-demo.tsx` — **new** interactive demo component.
  - `src/components/trust-gauge.tsx` — add optional count-up / draw-on animation.
  - `src/styles.css` — add glass + refraction utilities and a gauge-draw keyframe.
- **Out of scope:** authenticated app pages, backend, auth/consent flow, copy rewrites.

## Key facts verified

- `POST /api/analyze` requires **no auth and no consent** (`analyze-handler.ts`);
  a landing-page call with `{ type: "text", text }` is valid.
- Client `analyzeContent()` already enforces a **90s timeout** and returns typed
  `AnalysisResult` (`trust_score`, `category`, `summary`, `concerns[]`, `evidence[]`,
  `provider`, `citations[]`).
- If `PERPLEXITY_API_KEY` is unset, the server falls back to a mock analyzer — this
  only makes the demo *more* reliable. No handling needed on our side.
- Design tokens exist: `--navy`, `--teal`, `--accent`, `--trust-*`, `--gradient-hero`,
  `--gradient-primary`, `shadow-elegant`, `shadow-glow`, `font-display`, fade/scale
  animations, and a `prefers-reduced-motion` reset. Reuse these; do not invent a new palette.

## Section 1 — Hero: the interactive optical console

Two-column hero (keep the existing editorial left column largely intact):

- **Left column:** unchanged intent — kicker (`001 — Media literacy, quietly`),
  `Think before you trust.` display headline, subcopy, CTA buttons, the 3 stats row.
  Retain glass-image background treatment.
- **Right column:** replace the static `LensCard` with `<HeroLensDemo />` — a **glass
  instrument panel** the visitor operates:
  - Textarea on a `.glass` surface + a row of **preset example chips** (2–4 claims,
    reusing the sample tone already in the app, e.g. the household-cure claim and a
    Reuters-style neutral claim).
  - "Analyze" button. Clicking a chip fills the textarea; submitting runs analysis.

### Demo states (all inside the right panel)

1. **Idle** — textarea + preset chips + "Analyze" button. A soft prism/refraction
   sheen animates behind the glass.
2. **Running** — button shows spinner + disabled; a stepped status ticker cycles
   through labels (`Reading the source` → `Weighing the language` → `Cross-checking
   claims`) purely as visual pacing (not tied to real backend phases). The prism
   animation intensifies. Runs until the promise resolves (up to the existing 90s).
3. **Result** — animated `TrustGauge` sweeps 0 → real `trust_score`, category color
   applied; below it, the real `summary` and up to 3 `concerns`/`evidence` lines fade
   in. A "Verify your own content" CTA links to `/verify` (or `/auth?mode=signup`).
   A small "Analyze another" resets to idle.
4. **Error / timeout** — clean inline state: "The live engine is busy right now."
   with a retry button and the same "Verify your own content" CTA. Never a broken look.

### Interaction safeguards (client-side only)

- Button disabled while a request is in flight (prevents double-submit).
- Minimum input length check (reuse verify's ≥10 chars) with inline hint, no toast.
- Rely on the built-in 90s timeout; show state 4 on reject.

## Section 2 — Optical design-system additions (`styles.css`)

Add, consistent with existing token style:

- `@utility glass` — `backdrop-blur`, semi-transparent `--card` background, hairline
  border via `color-mix`, subtle inner top highlight. Works in light and dark.
- `@utility prism-sheen` + a `@keyframes tl-prism` — slow-moving conic/linear gradient
  keyed to `--teal`/`--accent`, low opacity, sits behind the demo glass.
- `@keyframes tl-gauge-draw` — used by TrustGauge draw-on (progressive `stroke-dasharray`).
- All new motion must be disabled by the existing `prefers-reduced-motion` block
  (extend it if a new animation name needs explicit coverage).

## Section 3 — TrustGauge animation

Extend `TrustGauge` with an optional `animate?: boolean` prop (default off, so existing
usages are unaffected):

- When `animate`, the number **counts up** from 0 to `score` and the arc **draws on**
  over ~700ms (matches existing gauge transition timing).
- Respect reduced-motion: snap to final value, no count-up.

## Section 4 — Unify the rest of the page

Reusing existing content/copy, apply the optical language for cohesion:

- **Signal-flow banner, feature index, closing CTA:** keep structure. Apply `.glass`
  to the two feature `figure`s and add a scroll-reveal (IntersectionObserver-driven
  `animate-fade-up`) to the feature `<ol>` items.
- Echo the gauge motif softly in the closing CTA (small decorative gauge or arc).
- No new copy; no layout restructuring beyond the hero.

## Testing / verification

- Manual: run the app, exercise all four hero states (idle → running → result →
  error). Force the error path by submitting with the network offline.
- Confirm reduced-motion (OS setting) disables count-up, prism, and scroll-reveal.
- Confirm light and dark themes both read well on the glass surfaces.
- Confirm existing `TrustGauge` usages (results page) are visually unchanged (new
  prop defaults off).
- `bun run build` (or project's typecheck/lint) passes with no new errors.

## Risks

- Live call latency on a marketing page — mitigated by the running-state pacing,
  preset chips (fast, reliable inputs), and the error fallback state.
- Glass/blur performance on low-end devices — keep blur radii modest; the sheen is a
  single low-opacity layer.
