import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowLeft, Globe } from "lucide-react";
import type { ReplayNode } from "@/lib/ai/types";

export const Route = createFileRoute("/_authenticated/trust-replay/$id")({
  head: () => ({ meta: [{ title: "TrustReplay — TrustLensAI" }] }),
  component: TrustReplay,
});

function TrustReplay() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["replay", id],
    queryFn: async () => {
      const { data } = await db.from("verification_results").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  if (!data) {
    return (
      <main className="mx-auto grid min-h-[50vh] max-w-4xl place-items-center px-4">
        <div className="prism-sheen relative text-center">
          <div className="prism-layer" aria-hidden="true" />
          <Globe className="mx-auto h-8 w-8 animate-pulse text-teal" />
          <p className="mt-3 text-muted-foreground">Loading TrustReplay…</p>
        </div>
      </main>
    );
  }
  const nodes: ReplayNode[] = (data.replay_data as ReplayNode[]) ?? [];
  const totalReach = nodes.reduce((s, n) => s + n.reach, 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link to="/verify/$id" params={{ id: data.request_id }}>
        <Button variant="ghost" size="sm" className="rounded-full">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to results
        </Button>
      </Link>
      <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-in-slow">
        <span className="inline-block h-px w-8 bg-foreground/40" />
        <span>How this content travelled</span>
      </div>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl animate-fade-up delay-100">
        TrustReplay
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground animate-fade-up delay-200">
        A visualization of how this content may have spread. Data shown is illustrative and based on
        modeled amplification patterns.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <Stat label="Estimated reach" value={totalReach.toLocaleString()} />
        <Stat label="Nodes tracked" value={String(nodes.length)} />
        <Stat
          label="Warning nodes"
          value={String(nodes.filter((n) => n.warning).length)}
          tone="warn"
        />
      </div>

      <div className="prism-sheen relative mt-8 animate-scale-in delay-300">
        <div className="prism-layer" aria-hidden="true" />
        <div className="glass rounded-2xl p-6 shadow-glow">
          <div className="text-lg font-semibold tracking-tight">Timeline & source graph</div>
          <div className="relative mt-5">
            <div
              className="absolute inset-y-0 left-4 w-px bg-gradient-to-b from-teal/60 via-border to-transparent"
              aria-hidden
            />
            <ol className="space-y-4">
              {nodes.map((n) => (
                <li key={n.id} className="relative pl-12">
                  <div
                    className={`absolute left-0 top-1 grid h-9 w-9 place-items-center rounded-full border-2 ${n.warning ? "border-trust-medium bg-trust-medium/10 text-trust-medium" : "border-teal bg-teal/10 text-teal shadow-glow"}`}
                  >
                    {n.warning ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </div>
                  <div className="rounded-xl border border-border bg-background/40 p-4 transition-colors hover:border-teal/40">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{n.label}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{n.platform}</span>
                      <span className="text-xs text-muted-foreground">{n.timestamp}</span>
                      {n.warning && (
                        <span className="rounded-md bg-trust-medium/15 px-2 py-0.5 text-xs font-medium text-trust-medium">
                          Questionable source
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Potential reach:{" "}
                      <span className="font-semibold text-foreground">
                        {n.reach.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <p className="mt-6 rounded-xl border border-border bg-background/40 p-4 text-xs text-muted-foreground">
        This visualization uses illustrative data for MVP purposes. Real amplification analysis
        would require platform-provided signals and consented public data.
      </p>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-display text-3xl font-semibold tracking-tight ${tone === "warn" ? "text-trust-medium" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
