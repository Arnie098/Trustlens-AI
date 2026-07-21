import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Loader2, Sparkles, ArrowUpRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TrustGauge } from "@/components/trust-gauge";
import { analyzeContent, type AnalysisResult } from "@/lib/ai/analyze";
import {
  sanitizeAnalysisProse,
  sanitizeDisplayList,
} from "@/lib/ai/sanitize-text";

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
      <div className="glass cursor-lens relative rounded-2xl p-6">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <span>Live VeriSphere</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" />
            {running ? "Analyzing" : "Ready"}
          </span>
        </div>

        {state.phase === "idle" && (
          <IdleView
            text={text}
            setText={setText}
            onRun={() => run(text)}
            onPreset={(p) => {
              setText(p);
              run(p);
            }}
          />
        )}
        {state.phase === "running" && <RunningView />}
        {state.phase === "result" && <ResultView result={state.result} onReset={reset} />}
        {state.phase === "error" && (
          <ErrorView
            message={state.message}
            onRetry={() => run(text || PRESETS[0])}
            onReset={reset}
          />
        )}
      </div>
      <figcaption className="mt-4 px-2 text-xs text-muted-foreground">
        Live analysis of a text claim. VeriSphere AI supports critical thinking; it does not replace
        independent fact-checking.
      </figcaption>
    </figure>
  );
}

const PRESET_LABELS = ["Miracle cure claim", "Reuters rate decision", "Election conspiracy"];

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
  const len = text.trim().length;
  const canRun = len >= MIN_LEN;
  return (
    <div className="mt-5">
      <label htmlFor="hero-claim" className="text-sm font-medium text-foreground">
        Claim or headline
      </label>
      <Textarea
        id="hero-claim"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a claim or headline to analyze…"
        className="mt-1.5 resize-none bg-background/60"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {canRun
          ? `${len} characters`
          : `Enter at least ${MIN_LEN} characters to analyze${len > 0 ? ` (${len}/${MIN_LEN})` : ""}.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PRESETS.map((p, i) => (
          <button
            key={i}
            type="button"
            title={p}
            onClick={() => onPreset(p)}
            className="min-h-9 rounded-full border border-border px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {PRESET_LABELS[i] ?? `Example ${i + 1}`}
          </button>
        ))}
      </div>
      <Button
        onClick={onRun}
        disabled={!canRun}
        title={!canRun ? `Enter at least ${MIN_LEN} characters` : "Analyze claim"}
        className="mt-4 min-h-11 w-full rounded-full"
      >
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
  const summary = sanitizeAnalysisProse(result.summary, "summary");
  const concerns = sanitizeDisplayList(result.concerns);
  const evidence = sanitizeDisplayList(result.evidence);
  const points = (concerns.length ? concerns : evidence).slice(0, 3);
  return (
    <div className="mt-5 flex flex-col items-center">
      <TrustGauge score={result.trust_score} category={result.category} size={180} animate />
      {summary && (
        <p className="mt-4 text-center text-sm text-muted-foreground break-words">{summary}</p>
      )}
      <ul className="mt-4 w-full space-y-2 text-sm text-muted-foreground">
        {points.map((p, i) => (
          <li key={i} className="flex gap-3">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground" />
            <span className="min-w-0 break-words">{p}</span>
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
        <button
          type="button"
          onClick={onReset}
          className="mt-1 text-xs text-muted-foreground underline"
        >
          Back to start
        </button>
      </div>
    </div>
  );
}

function StatusTicker() {
  const steps = ["Reading the source", "Weighing the language", "Cross-checking claims"];
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % steps.length), 2200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <p className="mt-4 h-5 text-sm font-medium text-foreground">{steps[i]}…</p>;
}
