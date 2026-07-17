# Landing Redesign — Interactive & Optical — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `/` landing page around a "lens/optics" theme — glass surfaces, prism refraction, an animated TrustGauge, and a hands-on hero demo that calls the real `/api/analyze` endpoint.

**Architecture:** Add reusable optical CSS utilities to the existing Ocean Deep token system, extend `TrustGauge` with an opt-in animation, build a new self-contained `HeroLensDemo` client component that owns the idle→running→result→error state machine, then recompose `index.tsx` to mount the demo in the hero and apply the glass/reveal language to the existing sections. Backend and all other pages are untouched.

**Tech Stack:** React 19, TanStack Router/Start, Tailwind CSS v4 (`@utility`/`@theme` in `styles.css`), shadcn/ui, lucide-react. No test runner — verification is `bun run lint` + `bun run build` plus manual observation via `bun run dev`.

**Notes for the engineer:**
- This project is **not a git repo** (Lovable-managed) — there are **no commit steps**. After each task, run lint + build instead.
- Tailwind v4 here uses CSS-first config: custom utilities are declared with `@utility name { ... }` in `src/styles.css` (see existing `@utility glass`-style examples like `bg-gradient-hero`, `shadow-glow`). There is no `tailwind.config.js`.
- Design tokens already exist — **use them, don't invent colors**: `--navy`, `--teal`, `--accent`, `--trust-high/medium/low/danger`, `--card`, `--border`, `--muted`, `--gradient-hero`, `--gradient-primary`, `shadow-elegant`, `shadow-glow`, `font-display`. Reduced-motion is already globally reset at the bottom of `styles.css`.
- The real analyze entrypoint is `analyzeContent(input: AnalysisInput)` from `@/lib/ai/analyze`. For the hero use `{ type: "text", text }`. It returns `AnalysisResult` and already enforces a 90s timeout and throws on failure/timeout.

---

## File Structure

- `src/styles.css` — **Modify.** Add `@utility glass`, `@utility prism-sheen`, `@keyframes tl-prism`, `@keyframes tl-gauge-draw`, and extend the reduced-motion block if needed. Responsibility: visual primitives only.
- `src/components/trust-gauge.tsx` — **Modify.** Add opt-in `animate` prop (count-up + arc draw-on). Responsibility: the gauge visual, reused by hero and results page.
- `src/components/hero-lens-demo.tsx` — **Create.** Self-contained client component owning the hero demo state machine and its own presentation. Responsibility: the interactive instrument.
- `src/routes/index.tsx` — **Modify.** Mount `HeroLensDemo` in the hero right column, apply `.glass` to feature figures, add scroll-reveal to the feature list, echo the gauge motif in the closing CTA. Responsibility: page composition.

---

## Task 1: Optical CSS utilities

**Files:**
- Modify: `src/styles.css` (append near the other `@utility`/`@keyframes` blocks, before the `prefers-reduced-motion` block at the end)

- [ ] **Step 1: Add glass + prism utilities and keyframes**

Insert after the existing `@utility grid-lines { ... }` block (around line 162) and before the `/* On-load animations */` comment:

```css
@utility glass {
  background: color-mix(in oklab, var(--card) 62%, transparent);
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
  border: 1px solid color-mix(in oklab, var(--foreground) 10%, transparent);
  box-shadow:
    0 1px 0 0 color-mix(in oklab, #fff 45%, transparent) inset,
    var(--shadow-elegant);
}
@utility prism-sheen {
  position: relative;
  isolation: isolate;
}
```

- [ ] **Step 2: Add the prism + gauge keyframes**

Inside the existing `/* On-load animations */` group (after `@keyframes tl-shimmer`), add:

```css
@keyframes tl-prism {
  0%   { transform: translate3d(-8%, -6%, 0) rotate(0deg); opacity: 0.55; }
  50%  { transform: translate3d(8%, 6%, 0) rotate(180deg); opacity: 0.9; }
  100% { transform: translate3d(-8%, -6%, 0) rotate(360deg); opacity: 0.55; }
}
@keyframes tl-gauge-draw {
  from { stroke-dashoffset: var(--tl-gauge-c, 999); }
  to   { stroke-dashoffset: var(--tl-gauge-target, 0); }
}
```

- [ ] **Step 3: Add the prism sheen layer utility + animation utility**

After the `@utility animate-float { ... }` block, add:

```css
@utility prism-layer {
  content: "";
  position: absolute;
  inset: -40%;
  z-index: -1;
  border-radius: 9999px;
  background: conic-gradient(
    from 0deg,
    color-mix(in oklab, var(--teal) 55%, transparent),
    color-mix(in oklab, var(--accent) 50%, transparent),
    color-mix(in oklab, var(--navy) 30%, transparent),
    color-mix(in oklab, var(--teal) 55%, transparent)
  );
  filter: blur(40px);
  animation: tl-prism 14s ease-in-out infinite;
}
```

- [ ] **Step 4: Extend reduced-motion coverage**

The existing `@media (prefers-reduced-motion: reduce)` block already zeroes all `animation-duration`, so `tl-prism` and `tl-gauge-draw` are covered. Verify that block is still the last block in the file and unchanged. No edit needed unless it was moved.

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: build succeeds, no CSS/unknown-utility errors. (Tailwind v4 compiles `@utility` at build time; a typo surfaces here.)

---

## Task 2: Animated TrustGauge

**Files:**
- Modify: `src/components/trust-gauge.tsx`

- [ ] **Step 1: Add an `animate` prop and count-up state**

Replace the entire contents of `src/components/trust-gauge.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import type { TrustCategory } from "@/lib/db";
import { trustColorVar, trustLabel } from "@/lib/ai/mock-analyze";

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function TrustGauge({
  score,
  category,
  size = 220,
  animate = false,
}: {
  score: number;
  category: TrustCategory;
  size?: number;
  animate?: boolean;
}) {
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const reduced = usePrefersReducedMotion();

  const [display, setDisplay] = useState(animate && !reduced ? 0 : score);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animate || reduced) {
      setDisplay(score);
      return;
    }
    const start = performance.now();
    const duration = 900;
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (score - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [animate, reduced, score]);

  const pct = Math.max(0, Math.min(100, display)) / 100;
  const dash = c * pct;
  const color = trustColorVar(category);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke="var(--muted)"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={color}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ transition: "stroke-dasharray 300ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-black tabular-nums" style={{ color }}>
          {display}
        </div>
        <div className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          TrustScore
        </div>
        <div
          className="mt-2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ background: `color-mix(in oklab, ${color} 15%, transparent)`, color }}
        >
          {trustLabel(category)}
        </div>
      </div>
    </div>
  );
}
```

Rationale: count-up drives both the number and the arc (arc reads `display`), so they animate together. Existing callers pass no `animate` prop → defaults to `false` → identical to today's behavior.

- [ ] **Step 2: Verify existing usages are unaffected**

Run: `bun run lint`
Expected: no errors. Confirm the only prop added is optional (`animate = false`).

- [ ] **Step 3: Verify build**

Run: `bun run build`
Expected: success.

---

## Task 3: HeroLensDemo component — scaffold + idle state

**Files:**
- Create: `src/components/hero-lens-demo.tsx`

- [ ] **Step 1: Create the component with presets and idle UI**

Create `src/components/hero-lens-demo.tsx`:

```tsx
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TrustGauge } from "@/components/trust-gauge";
import { analyzeContent, type AnalysisResult } from "@/lib/ai/analyze";

type DemoState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "result"; result: AnalysisResult }
  | { phase: "error"; message: string };

const PRESETS = [
  "Scientists confirm this common household item cures every known disease overnight.",
  "Reuters reports the central bank held interest rates steady, citing multiple officials.",
  "Anonymous viral post claims local election results were secretly altered — no evidence given.",
];

const MIN_LEN = 10;

export function HeroLensDemo() {
  const [text, setText] = useState("");
  const [state, setState] = useState<DemoState>({ phase: "idle" });

  const running = state.phase === "running";

  async function run(input: string) {
    const trimmed = input.trim();
    if (trimmed.length < MIN_LEN) return;
    setState({ phase: "running" });
    try {
      const result = await analyzeContent({ type: "text", text: trimmed });
      setState({ phase: "result", result });
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "The live engine is busy right now.",
      });
    }
  }

  function reset() {
    setState({ phase: "idle" });
  }

  return (
    <figure className="prism-sheen w-full max-w-md">
      <div className="prism-layer" aria-hidden="true" />
      <div className="glass relative rounded-2xl p-6">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>Live TrustLens</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            {running ? "Analyzing" : "Ready"}
          </span>
        </div>

        {state.phase === "idle" && (
          <IdleView text={text} setText={setText} onRun={() => run(text)} onPreset={(p) => { setText(p); run(p); }} />
        )}
        {state.phase === "running" && <RunningView />}
        {state.phase === "result" && <ResultView result={state.result} onReset={reset} />}
        {state.phase === "error" && <ErrorView message={state.message} onRetry={() => run(text || PRESETS[0])} onReset={reset} />}
      </div>
      <figcaption className="mt-4 px-2 text-xs text-muted-foreground">
        Live analysis of a text claim. TrustLensAI supports critical thinking; it does not replace
        independent fact-checking.
      </figcaption>
    </figure>
  );
}

function IdleView({
  text,
  setText,
  onRun,
  onPreset,
}: {
  text: string;
  setText: (v: string) => void;
  onRun: () => void;
  onPreset: (p: string) => void;
}) {
  const tooShort = text.trim().length > 0 && text.trim().length < MIN_LEN;
  return (
    <div className="mt-5">
      <Textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a claim or headline to analyze…"
        className="resize-none bg-background/60"
      />
      {tooShort && (
        <p className="mt-1 text-xs text-muted-foreground">Enter at least {MIN_LEN} characters.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPreset(p)}
            className="rounded-full border border-border px-3 py-1 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Example {i + 1}
          </button>
        ))}
      </div>
      <Button onClick={onRun} disabled={text.trim().length < MIN_LEN} className="mt-4 w-full rounded-full">
        <Sparkles className="mr-2 h-4 w-4" />
        Analyze
      </Button>
    </div>
  );
}

function RunningView() {
  return (
    <div className="mt-6 flex flex-col items-center py-6 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-teal" />
      <StatusTicker />
      <p className="mt-4 text-xs text-muted-foreground">Live analysis can take 10–30 seconds.</p>
    </div>
  );
}

function ResultView({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const points = (result.concerns?.length ? result.concerns : result.evidence) ?? [];
  return (
    <div className="mt-5 flex flex-col items-center">
      <TrustGauge score={result.trust_score} category={result.category} size={180} animate />
      {result.summary && (
        <p className="mt-4 text-center text-sm text-muted-foreground">{result.summary}</p>
      )}
      <ul className="mt-4 w-full space-y-2 text-sm text-muted-foreground">
        {points.slice(0, 3).map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground" />
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-6 flex w-full flex-col gap-2">
        <Link to="/verify" className="w-full">
          <Button className="w-full rounded-full">
            Verify your own content
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
        <Button variant="ghost" onClick={onReset} className="w-full rounded-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Analyze another
        </Button>
      </div>
    </div>
  );
}

function ErrorView({
  message,
  onRetry,
  onReset,
}: {
  message: string;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col items-center py-4 text-center">
      <p className="text-sm font-medium text-foreground">The live engine is busy right now.</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      <div className="mt-5 flex w-full flex-col gap-2">
        <Button onClick={onRetry} className="w-full rounded-full">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Link to="/verify" className="w-full">
          <Button variant="ghost" className="w-full rounded-full">
            Verify your own content
            <ArrowUpRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
        <button type="button" onClick={onReset} className="mt-1 text-xs text-muted-foreground underline">
          Back to start
        </button>
      </div>
    </div>
  );
}

function StatusTicker() {
  const steps = ["Reading the source", "Weighing the language", "Cross-checking claims"];
  const [i, setI] = useState(0);
  useState(() => {
    // interval owned via effect below; placeholder to keep hook order stable
    return 0;
  });
  useTicker(setI, steps.length);
  return (
    <p className="mt-4 h-5 text-sm font-medium text-foreground transition-all">{steps[i]}…</p>
  );
}

function useTicker(setI: (fn: (n: number) => number) => void, len: number) {
  // Advance every 2.2s; cleared on unmount.
  useIntervalEffect(() => setI((n) => (n + 1) % len), 2200);
}

export {};
```

Note: `StatusTicker` above references `useIntervalEffect`/`useTicker` — replace that whole ticker section in the next step with a clean implementation (kept separate so the file stays readable). Proceed to Step 2 before building.

- [ ] **Step 2: Replace the ticker helpers with a clean interval hook**

Remove the `StatusTicker`, `useTicker`, and the stray `useState(() => {...})` placeholder and `export {};` from Step 1, and replace with this correct implementation (also add `useEffect`, `useRef` to the top-of-file React import):

Change the import line at the top of the file to:

```tsx
import { useEffect, useRef, useState } from "react";
```

Then define `StatusTicker` as:

```tsx
function StatusTicker() {
  const steps = ["Reading the source", "Weighing the language", "Cross-checking claims"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % steps.length), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <p className="mt-4 h-5 text-sm font-medium text-foreground">{steps[i]}…</p>
  );
}
```

And delete the `export {};` line at the end (not needed; the file already has a named export). `useRef` is imported for parity with other components but if lint flags it as unused, drop it from the import.

- [ ] **Step 3: Verify lint**

Run: `bun run lint`
Expected: no errors. If `useRef` is reported unused, change the import to `import { useEffect, useState } from "react";`.

- [ ] **Step 4: Verify build**

Run: `bun run build`
Expected: success.

---

## Task 4: Mount HeroLensDemo in the landing hero

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Import the demo component**

Add to the imports block near the top of `src/routes/index.tsx` (after the existing `SiteFooter` import):

```tsx
import { HeroLensDemo } from "@/components/hero-lens-demo";
```

- [ ] **Step 2: Swap the static LensCard for the live demo**

In the hero's right column, replace this line (currently inside `<div className="relative animate-scale-in delay-300">`):

```tsx
            <LensCard />
```

with:

```tsx
            <HeroLensDemo />
```

- [ ] **Step 3: Remove the now-unused LensCard**

Delete the entire `function LensCard() { ... }` definition (the `<figure>`-returning function near the bottom of the file). Leave `Stat` and the `features` array intact.

- [ ] **Step 4: Verify lint (catches unused imports/vars)**

Run: `bun run lint`
Expected: no errors. If any icon import (e.g. those only used by `LensCard`) is now unused, remove it from the lucide-react import list. Check specifically that every name in the `lucide-react` import is still referenced.

- [ ] **Step 5: Verify build**

Run: `bun run build`
Expected: success.

- [ ] **Step 6: Manual check — hero states**

Run: `bun run dev`, open the site. Confirm:
- Idle: glass panel with textarea, 3 example chips, Analyze button (disabled until 10+ chars). Prism sheen animates behind the panel.
- Click "Example 1" → running state (spinner + rotating status lines) → result with the gauge counting up and category color.
- With DevTools network offline, submit → error state with "Try again" + "Verify your own content".

---

## Task 5: Apply optical language to the rest of the page

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Add glass to the two feature figures**

In the "Visual pair" grid, both `<figure>` elements currently use `className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-elegant"`. Change `bg-card shadow-elegant` to `glass` on both (keep the rest):

```tsx
            <figure className="glass relative flex h-full flex-col overflow-hidden rounded-2xl">
```

Apply the identical change to the second `<figure>`.

- [ ] **Step 2: Add a scroll-reveal hook for the feature list**

Add this small hook near the top of the file (after imports, before `export const Route`):

```tsx
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-fade-up");
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    el.querySelectorAll("[data-reveal]").forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
  return ref;
}
```

Add `useEffect, useRef` to the React import at the top of the file. If there is no existing `react` import line, add:

```tsx
import { useEffect, useRef } from "react";
```

- [ ] **Step 3: Wire the reveal to the feature list**

In `Landing()`, get a ref: add `const revealRef = useReveal<HTMLOListElement>();` at the top of the component body (with the existing `const { user } = useSession();`).

Attach it to the feature `<ol>` and mark each `<li>` with `data-reveal` and an initial hidden style. Change the `<ol>` opening tag to:

```tsx
          <ol ref={revealRef} className="mt-16 divide-y divide-border border-y border-border">
```

And add `data-reveal` plus a starting-opacity class to each feature `<li>` — change its className to include `opacity-0 [&.animate-fade-up]:opacity-100` and add the attribute:

```tsx
              <li
                key={f.title}
                data-reveal
                className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 py-8 opacity-0 transition-transform duration-300 hover:translate-x-1 [&.animate-fade-up]:opacity-100 sm:grid-cols-[3rem_1fr_auto_2.5rem] sm:gap-10"
              >
```

Rationale: items start at `opacity-0`; when the observer adds `animate-fade-up`, the existing keyframe (which ends at `opacity:1`) plays and the `[&.animate-fade-up]:opacity-100` guard holds the final state. Reduced-motion users: the global reset makes the animation instant, and the opacity-100 guard still applies, so content is always visible.

- [ ] **Step 4: Echo the gauge motif in the closing CTA**

In the "Closing CTA" section, the grid currently has the headline and a text/button block. Add a subtle decorative gauge next to the headline. Import is already present (`TrustGauge` — add it if missing: `import { TrustGauge } from "@/components/trust-gauge";`). Inside the closing CTA's left cell, after the `<h2>`, add:

```tsx
              <div className="mt-8 hidden sm:block opacity-70">
                <TrustGauge score={82} category="high_trust" size={140} />
              </div>
```

- [ ] **Step 5: Verify lint**

Run: `bun run lint`
Expected: no errors (watch for unused imports).

- [ ] **Step 6: Verify build**

Run: `bun run build`
Expected: success.

- [ ] **Step 7: Manual check — full page**

Run `bun run dev`. Scroll the page: feature list items fade up on entry; feature figures show the glass treatment; closing CTA shows the decorative gauge. Toggle OS reduced-motion and confirm everything is still visible (no permanently-hidden items) and motion is disabled. Toggle dark mode and confirm glass surfaces read well in both themes.

---

## Task 6: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Lint the whole project**

Run: `bun run lint`
Expected: clean.

- [ ] **Step 2: Production build**

Run: `bun run build`
Expected: success, no type errors.

- [ ] **Step 3: Regression check on the results page gauge**

Run `bun run dev`, open an existing verification result (or seed sample data from the dashboard and open one). Confirm the `TrustGauge` there looks identical to before (no unexpected count-up, since `animate` defaults off).

- [ ] **Step 4: Cross-check spec acceptance**

Confirm against the spec: hero has all four states (idle/running/result/error), glass + prism utilities exist and are used, gauge animates only when opted-in, feature section uses glass + scroll-reveal, reduced-motion and dark mode both hold up.

---

## Self-Review Notes

- **Spec coverage:** Hero interactive demo (Tasks 3–4), real API call via `analyzeContent` (Task 3), four states incl. error/timeout fallback (Task 3), optical utilities glass/prism/gauge-draw (Task 1), animated gauge opt-in (Task 2), rest-of-page glass + scroll-reveal + gauge motif (Task 5), reduced-motion + dark mode + regression verification (Tasks 5–6). All spec sections mapped.
- **Type consistency:** `AnalysisResult`, `analyzeContent`, `TrustCategory`, `trustLabel`, `trustColorVar` used exactly as exported. `TrustGauge` prop `animate` defined in Task 2 and consumed in Tasks 3 & 5. `DemoState` phases (`idle|running|result|error`) consistent across component.
- **No commits:** intentional — project is not a git repo (Lovable-managed). Verification via lint+build replaces the commit/test cycle.
- **Note on `tl-gauge-draw`:** the keyframe is added for the optical system per spec, but the shipped gauge animation is JS-driven (count-up drives the arc) for reliable count synchronization; the keyframe is available for future CSS-only use and harmless if unused. Kept to satisfy the spec's optical-utilities list without over-engineering the gauge.
