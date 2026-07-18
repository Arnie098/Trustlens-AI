import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrustGauge } from "@/components/trust-gauge";
import { CompactTrustResult } from "@/components/compact-trust-result";
import { db } from "@/lib/db";
import { trustLabel } from "@/lib/ai/mock-analyze";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Rewind,
  GraduationCap,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { parseEvidenceItems } from "@/lib/evidence";
import { sanitizeAnalysisProse, sanitizeDisplayList } from "@/lib/ai/sanitize-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Flat route: /verify/$id is a sibling of /verify (not nested under it).
// Nested verify.$id never rendered because verify.tsx had no <Outlet />.
export const Route = createFileRoute("/_authenticated/verify_/$id")({
  head: () => ({ meta: [{ title: "Verification results — TrustLensAI" }] }),
  component: ResultsPage,
});

function ResultsPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [waitedMs, setWaitedMs] = useState(0);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["verify", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("verification_results")
        .select("*, verification_requests(*)")
        .eq("request_id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (q) => (q.state.data ? false : 1500),
    retry: 3,
  });

  const [pauseOpen, setPauseOpen] = useState(false);

  useEffect(() => {
    if (data) return;
    const t0 = Date.now();
    const t = setInterval(() => setWaitedMs(Date.now() - t0), 1000);
    return () => clearInterval(t);
  }, [data, id]);

  useEffect(() => {
    if (data?.category === "low_confidence" || data?.category === "potentially_misleading") {
      setPauseOpen(true);
    }
  }, [data?.category]);

  if (isLoading || !data) {
    const timedOut = waitedMs > 45_000;
    return (
      <main className="mx-auto grid min-h-[60vh] max-w-3xl place-items-center px-4">
        <div className="prism-sheen relative text-center">
          <div className="prism-layer" aria-hidden="true" />
          <Sparkles className="mx-auto h-8 w-8 animate-pulse text-teal" />
          <p className="mt-3 text-muted-foreground">
            {timedOut ? "Still waiting for results…" : "Loading verification results…"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {Math.floor(waitedMs / 1000)}s · request {id.slice(0, 8)}…
          </p>
          {(timedOut || isError) && (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                {isError
                  ? (error as Error)?.message || "Could not load results."
                  : "No results yet. Analysis may have failed or is still running."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => refetch()}>
                  Retry
                </Button>
                <Button variant="outline" onClick={() => navigate({ to: "/verify" })}>
                  New verification
                </Button>
                <Button variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
                  Dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  const req = data.verification_requests;
  const concerns = sanitizeDisplayList(data.concerns);
  const nextSteps = sanitizeDisplayList(data.next_steps);
  const summaryText = sanitizeAnalysisProse(data.summary, "summary");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Mobile sticky compact summary (Task 13) — full gauge remains in sidebar on lg+ */}
      <div className="sticky top-[var(--site-header-offset,4rem)] z-20 -mx-1 mb-6 lg:hidden">
        <CompactTrustResult
          trustScore={data.trust_score}
          category={data.category}
          summary={summaryText}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <div className="hidden lg:sticky lg:top-[var(--site-header-offset)] lg:block lg:self-start">
          <div className="prism-sheen relative animate-scale-in">
            <div className="prism-layer" aria-hidden="true" />
            <div className="glass flex flex-col items-center rounded-2xl p-6 shadow-glow">
              <TrustGauge score={data.trust_score} category={data.category} animate />
              <div className="mt-4 w-full border-t border-border pt-4 text-center">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Confidence
                </div>
                <div className="mt-1 font-display text-3xl font-semibold tracking-tight">
                  {data.confidence}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="animate-fade-up delay-200">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {req?.type === "url" ? "URL" : req?.type === "text" ? "Text" : "Image"}
          </div>
          <ResultTitle text={req?.input_url ?? req?.input_text ?? "Image submission"} />

          <div className="glass mt-5 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-teal" /> Assessment summary
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{summaryText}</p>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <InfoCard
              title="Source assessment"
              body={sanitizeAnalysisProse(data.source_assessment, "source_assessment")}
            />
            <InfoCard
              title="Context analysis"
              body={sanitizeAnalysisProse(data.context_analysis, "context_analysis")}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="outline">
              AI-generated detected: {data.ai_generated_detected ? "Yes" : "No"}
            </Badge>
            <Badge variant="outline">{trustLabel(data.category)}</Badge>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <List icon={AlertTriangle} tone="warn" title="Potential concerns" items={concerns} />
            <EvidenceList items={data.evidence ?? []} />
          </div>

          <div className="glass mt-6 rounded-2xl p-5">
            <div className="text-sm font-semibold">Recommended next steps</div>
            {nextSteps.length ? (
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                {nextSteps.map((s: string, i: number) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal/15 text-xs font-bold text-teal">
                      {i + 1}
                    </span>
                    <span className="min-w-0 break-words">{s}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No recommended steps for this result.
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              onClick={() => navigate({ to: "/verify" })}
              className="min-h-11 rounded-full shadow-glow transition-transform hover:scale-[1.02]"
            >
              <Search className="mr-2 h-4 w-4" /> Verify another
            </Button>
            <Link to="/trust-replay/$id" params={{ id: data.id }}>
              <Button variant="outline" className="min-h-11 rounded-full">
                <Rewind className="mr-2 h-4 w-4" /> View TrustReplay
              </Button>
            </Link>
            <Link to="/learn">
              <Button variant="ghost" className="min-h-11 rounded-full">
                <GraduationCap className="mr-2 h-4 w-4" /> Related lesson
              </Button>
            </Link>
          </div>

          <p className="mt-6 rounded-xl border border-border bg-background/40 p-4 text-xs text-muted-foreground">
            AI analysis may be incomplete, inaccurate, or biased. TrustLensAI supports critical
            thinking and does not replace independent fact-checking or human judgment.
          </p>
        </div>
      </div>

      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-trust-medium/15 text-trust-medium">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center">Pause Before Sharing</DialogTitle>
            <DialogDescription className="text-center">
              This content may need further verification. Review the evidence before sharing it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button className="w-full min-h-11" onClick={() => setPauseOpen(false)}>
              Review evidence
            </Button>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Link to="/learn" className="flex-1">
                <Button variant="outline" className="w-full min-h-11">
                  Learn how to verify
                </Button>
              </Link>
              <Button
                variant="ghost"
                className="flex-1 min-h-11"
                onClick={() => setPauseOpen(false)}
              >
                Dismiss
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ResultTitle({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > 120;
  return (
    <div className="mt-2">
      <h1
        className={`font-display text-2xl font-semibold tracking-tight sm:text-3xl ${
          expanded ? "break-words whitespace-pre-wrap" : "line-clamp-2 break-words"
        }`}
      >
        {text}
      </h1>
      {long && (
        <button
          type="button"
          className="mt-1 text-xs font-medium text-teal underline-offset-2 hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function InfoCard({ title, body }: { title: string; body: string | null }) {
  const text = (body ?? "").trim() || "—";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground break-words whitespace-pre-wrap">
        {text}
      </p>
    </div>
  );
}

function List({
  icon: Icon,
  tone,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "warn" | "ok";
  title: string;
  items: string[];
}) {
  const color = tone === "warn" ? "text-trust-medium" : "text-trust-high";
  const dot = tone === "warn" ? "bg-trust-medium" : "bg-trust-high";
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className={`h-4 w-4 ${color}`} /> {title}
      </div>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.length ? (
          items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
              <span className="min-w-0 break-words">{it}</span>
            </li>
          ))
        ) : (
          <li className="text-xs text-muted-foreground">None detected.</li>
        )}
      </ul>
    </div>
  );
}

/** Evidence with prose bullets + clean, clickable source links (no raw Citation: dumps). */
function EvidenceList({ items }: { items: string[] }) {
  const { prose, sources } = parseEvidenceItems(items);
  const empty = prose.length === 0 && sources.length === 0;

  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <CheckCircle2 className="h-4 w-4 text-trust-high" /> Supporting evidence
      </div>

      {empty ? (
        <p className="mt-3 text-xs text-muted-foreground">None detected.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {prose.length > 0 && (
            <ul className="space-y-2 text-sm text-muted-foreground">
              {prose.map((it, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-trust-high" />
                  <span className="min-w-0 break-words">{it.text}</span>
                </li>
              ))}
            </ul>
          )}

          {sources.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Sources
              </div>
              <ul className="mt-2 space-y-1.5">
                {sources.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2 text-sm transition-colors hover:border-teal/40 hover:bg-teal/5"
                      title={s.url}
                    >
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-teal" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground group-hover:text-teal">
                          {s.hostname}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.label}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
