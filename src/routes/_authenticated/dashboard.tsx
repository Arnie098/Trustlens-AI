import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Type,
  ImageIcon,
  GraduationCap,
  Trophy,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/lib/auth/session";
import { db, type TrustCategory } from "@/lib/db";
import { trustLabel, trustColorVar } from "@/lib/ai/mock-analyze";
import { formatDistanceToNow, format, subDays, startOfDay } from "date-fns";

// Lazy-load recharts so Verify and other routes never pay the chart bundle cost.
const DashboardCharts = lazy(() => import("@/components/dashboard-charts"));

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VeriSphere AI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useSession();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["dashboard", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [recent, allResults, attempts, progress, badges, modules, analytics] =
        await Promise.all([
          db
            .from("verification_requests")
            .select(
              "id, type, input_url, input_text, created_at, verification_results(trust_score, category)",
            )
            .eq("user_id", user!.id)
            .order("created_at", { ascending: false })
            .limit(5),
          db
            .from("verification_results")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id),
          db
            .from("quiz_attempts")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user!.id),
          db
            .from("user_learning_progress")
            .select("module_id, progress_pct, completed")
            .eq("user_id", user!.id),
          db
            .from("user_badges")
            .select("badge_id, awarded_at, badges(title, icon, description)")
            .eq("user_id", user!.id),
          db.from("learning_modules").select("*").order("sort_order"),
          db
            .from("verification_results")
            .select("trust_score, category, created_at")
            .eq("user_id", user!.id)
            .order("created_at", { ascending: true }),
        ]);
      return {
        recent: recent.data ?? [],
        totalVerifications: allResults.count ?? 0,
        totalQuizzes: attempts.count ?? 0,
        progress: progress.data ?? [],
        badges: badges.data ?? [],
        modules: modules.data ?? [],
        analytics: (analytics.data ?? []) as {
          trust_score: number;
          category: TrustCategory;
          created_at: string;
        }[],
      };
    },
  });

  const completedLessons =
    data?.progress.filter((p: { completed: boolean }) => p.completed).length ?? 0;
  const analytics = data?.analytics ?? [];

  // Verifications per day (last 14 days)
  const days = 14;
  const today = startOfDay(new Date());
  const trendData = Array.from({ length: days }, (_, i) => {
    const d = subDays(today, days - 1 - i);
    const dayStr = format(d, "yyyy-MM-dd");
    const count = analytics.filter(
      (a) => format(new Date(a.created_at), "yyyy-MM-dd") === dayStr,
    ).length;
    return { day: format(d, "MMM d"), count };
  });

  // Category distribution
  const CATS: TrustCategory[] = [
    "high_trust",
    "needs_verification",
    "low_confidence",
    "potentially_misleading",
  ];
  const catData = CATS.map((c) => ({
    category: trustLabel(c),
    key: c,
    count: analytics.filter((a) => a.category === c).length,
  }));

  const avgScore = analytics.length
    ? Math.round(analytics.reduce((s, a) => s + a.trust_score, 0) / analytics.length)
    : 0;
  const last7 = analytics.filter((a) => new Date(a.created_at) >= subDays(today, 7)).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 animate-fade-up">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="inline-block h-px w-8 bg-foreground/40" />
            <span>Your workspace</span>
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, <span className="break-words">{profile?.full_name ?? "friend"}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Verify content, track your learning, and earn badges.
          </p>
        </div>
        <Link to="/verify" className="shrink-0 self-start sm:self-auto">
          <Button
            size="lg"
            className="min-h-11 rounded-full shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Search className="mr-2 h-5 w-5" /> New Verification
          </Button>
        </Link>
      </div>

      {isError && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-foreground">Could not load your dashboard.</p>
          <p className="mt-1 text-muted-foreground">
            {(error as Error)?.message || "Something went wrong. Please try again."}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-full"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      <SampleDataBar userId={user?.id} hasData={(data?.totalVerifications ?? 0) > 0} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading && !data ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <Stat icon={ShieldCheck} label="Verifications" value={data?.totalVerifications ?? 0} />
            <Stat icon={CheckCircle2} label="Quizzes taken" value={data?.totalQuizzes ?? 0} />
            <Stat icon={BookOpen} label="Lessons completed" value={completedLessons} />
            <Stat icon={Trophy} label="Badges earned" value={data?.badges.length ?? 0} />
          </>
        )}
      </div>

      {/* Analytics */}
      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Your analytics
            </h2>
            <p className="text-sm text-muted-foreground">
              Trends across your verification activity.
            </p>
          </div>
          <div className="flex gap-6">
            <MiniStat icon={TrendingUp} label="Avg TrustScore" value={avgScore} />
            <MiniStat icon={Activity} label="Last 7 days" value={last7} />
          </div>
        </div>

        <Suspense
          fallback={
            <div className="grid h-72 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
              Loading charts…
            </div>
          }
        >
          <DashboardCharts
            trendData={trendData}
            catData={catData}
            hasAnalytics={analytics.length > 0}
          />
        </Suspense>
      </section>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="text-lg font-semibold tracking-tight">Quick actions</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ActionCard
              to="/verify"
              search={{ tab: "url" }}
              icon={Search}
              title="Verify a URL"
              body="Paste a link to analyze."
            />
            <ActionCard
              to="/verify"
              search={{ tab: "text" }}
              icon={Type}
              title="Verify text"
              body="Paste a claim or excerpt."
            />
            <ActionCard
              to="/verify"
              search={{ tab: "image" }}
              icon={ImageIcon}
              title="Upload an image"
              body="Check visual media."
            />
            <ActionCard
              to="/learn"
              icon={GraduationCap}
              title="Continue learning"
              body="Pick a module."
            />
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="text-lg font-semibold tracking-tight">Your badges</div>
          <div className="mt-4">
            {isLoading && !data ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading badges…</p>
            ) : data?.badges.length ? (
              <ul className="space-y-3">
                {data.badges
                  .slice(0, 5)
                  .map(
                    (b: { badge_id: string; badges: { title: string; description: string } }) => (
                      <li key={b.badge_id} className="flex items-start gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal">
                          <Trophy className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold">{b.badges?.title}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {b.badges?.description}
                          </div>
                        </div>
                      </li>
                    ),
                  )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete your first verification or quiz to unlock badges.
              </p>
            )}
            <Link to="/achievements" className="mt-4 block">
              <Button variant="outline" size="sm" className="w-full rounded-full">
                View all achievements
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="text-lg font-semibold tracking-tight">Recent verifications</div>
          <div className="mt-4">
            {isLoading && !data ? (
              <p className="text-sm text-muted-foreground animate-pulse">
                Loading recent activity…
              </p>
            ) : data?.recent.length ? (
              <ul className="space-y-3">
                {data.recent.map(
                  (r: {
                    id: string;
                    type: string;
                    input_url: string | null;
                    input_text: string | null;
                    created_at: string;
                    verification_results: {
                      trust_score: number;
                      category: import("@/lib/db").TrustCategory;
                    }[];
                  }) => {
                    const res = r.verification_results?.[0];
                    const c = res?.category;
                    const typeLabel =
                      r.type === "url" ? "URL" : r.type === "text" ? "Text" : "Image";
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-teal/40"
                      >
                        <div
                          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal"
                          title={typeLabel}
                          aria-label={typeLabel}
                        >
                          {r.type === "url" ? (
                            <Search className="h-4 w-4" />
                          ) : r.type === "text" ? (
                            <Type className="h-4 w-4" />
                          ) : (
                            <ImageIcon className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {r.input_url ?? r.input_text?.slice(0, 60) ?? "Image upload"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {typeLabel} ·{" "}
                            {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                          </div>
                        </div>
                        {res && (
                          <div className="flex flex-col items-end gap-1">
                            <div
                              className="text-lg font-bold tabular-nums"
                              style={{ color: trustColorVar(c!) }}
                            >
                              {res.trust_score}
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {trustLabel(c!)}
                            </Badge>
                          </div>
                        )}
                        <Link to="/verify/$id" params={{ id: r.id }}>
                          <Button variant="ghost" size="sm" className="rounded-full">
                            View
                          </Button>
                        </Link>
                      </li>
                    );
                  },
                )}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No verifications yet. Try your first one.
              </p>
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="text-lg font-semibold tracking-tight">Recommended lessons</div>
          <div className="mt-4 space-y-3">
            {isLoading && !data ? (
              <p className="text-sm text-muted-foreground animate-pulse">Loading lessons…</p>
            ) : data?.modules?.length ? (
              data.modules
                .slice(0, 3)
                .map(
                  (m: { id: string; slug: string; title: string; estimated_minutes: number }) => {
                    const p = data.progress.find(
                      (x: { module_id: string }) => x.module_id === m.id,
                    );
                    return (
                      <Link
                        key={m.id}
                        to="/learn/$slug"
                        params={{ slug: m.slug }}
                        className="block rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-teal/40"
                      >
                        <div className="text-sm font-semibold">{m.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {m.estimated_minutes} min
                        </div>
                        <Progress className="mt-2 h-1.5" value={p?.progress_pct ?? 0} />
                      </Link>
                    );
                  },
                )
            ) : (
              <p className="text-sm text-muted-foreground">
                No lessons available yet. Check back soon.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="glass flex items-center gap-4 rounded-2xl p-5 transition-transform hover:scale-[1.02]">
      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="font-display text-2xl font-semibold tabular-nums tracking-tight">
          {value}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function ActionCard({
  to,
  search,
  icon: Icon,
  title,
  body,
}: {
  to: string;
  search?: Record<string, string>;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      search={search as never}
      className="group rounded-xl border border-border bg-background/40 p-4 transition-all hover:border-teal/40 hover:shadow-glow"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-primary text-primary-foreground transition-transform group-hover:scale-110">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{title}</div>
          <div className="truncate text-xs text-muted-foreground">{body}</div>
        </div>
      </div>
    </Link>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div className="text-right">
        <div className="text-lg font-black tabular-nums leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="glass flex items-center gap-4 rounded-2xl p-5">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-muted" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-7 w-12 animate-pulse rounded bg-muted" />
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

const SAMPLE_TAG = "[SAMPLE]";

const SAMPLE_ITEMS: Array<{
  type: "url" | "text" | "image";
  input_url?: string;
  input_text?: string;
  imageName?: string;
}> = [
  { type: "url", input_url: "https://www.reuters.com/world/sample-report" },
  { type: "url", input_url: "https://apnews.com/article/sample-briefing" },
  { type: "url", input_url: "https://www.bbc.co.uk/news/sample-analysis" },
  { type: "url", input_url: "https://nature.com/articles/sample-study" },
  { type: "url", input_url: "https://example-blog.net/you-wont-believe-this" },
  { type: "url", input_url: "https://viral-news.example/shocking-headline" },
  { type: "url", input_url: "https://unknown-outlet.example/breaking" },
  {
    type: "text",
    input_text: `${SAMPLE_TAG} A viral post claims a new study proves miracle cures — no citations included.`,
  },
  {
    type: "text",
    input_text: `${SAMPLE_TAG} Official statement from the health ministry with sources listed.`,
  },
  {
    type: "text",
    input_text: `${SAMPLE_TAG} Anonymous forum thread alleging a conspiracy about local elections.`,
  },
  {
    type: "text",
    input_text: `${SAMPLE_TAG} Reuters wire quotes multiple experts on a technology trend.`,
  },
  { type: "image", imageName: `${SAMPLE_TAG}-portrait.jpg` },
  { type: "image", imageName: `${SAMPLE_TAG}-infographic.png` },
  { type: "image", imageName: `${SAMPLE_TAG}-screenshot.jpg` },
];

function SampleDataBar({ userId, hasData }: { userId: string | undefined; hasData: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<"seed" | "clear" | null>(null);
  // Collapse demo tools by default when the user already has data
  const [open, setOpen] = useState(!hasData);

  if (!userId) return null;

  async function seed() {
    if (!userId) return;
    setBusy("seed");
    try {
      const { analyzeContent } = await import("@/lib/ai/analyze");
      const today = new Date();
      for (let i = 0; i < SAMPLE_ITEMS.length; i++) {
        const item = SAMPLE_ITEMS[i];
        const daysAgo = Math.floor(
          (SAMPLE_ITEMS.length - 1 - i) * (13 / (SAMPLE_ITEMS.length - 1)),
        );
        const ts = new Date(today);
        ts.setDate(ts.getDate() - daysAgo);
        ts.setHours(9 + (i % 8), (i * 13) % 60, 0, 0);
        const iso = ts.toISOString();

        const { data: req, error } = await db
          .from("verification_requests")
          .insert({
            user_id: userId,
            type: item.type,
            input_url: item.input_url ?? null,
            input_text: item.input_text ?? null,
            status: "completed",
            created_at: iso,
          })
          .select()
          .single();
        if (error || !req) throw new Error(error?.message ?? "Failed to insert request");

        // Sample seed uses offline-friendly analyze (mock if no Perplexity key)
        const r = await analyzeContent({
          type: item.type,
          url: item.input_url,
          text: item.input_text,
          imageName: item.imageName,
        });
        await db.from("verification_results").insert({
          request_id: req.id,
          user_id: userId,
          trust_score: r.trust_score,
          category: r.category,
          confidence: r.confidence,
          summary: r.summary,
          source_assessment: r.source_assessment,
          context_analysis: r.context_analysis,
          ai_generated_detected: r.ai_generated_detected,
          concerns: r.concerns,
          evidence: r.evidence,
          next_steps: r.next_steps,
          replay_data: r.replay_data,
          created_at: iso,
        });
      }

      // A few quiz attempts too
      const { data: quizzes } = await db.from("quizzes").select("id").limit(3);
      if (quizzes?.length) {
        const attempts = quizzes.map((q: { id: string }, i: number) => ({
          user_id: userId,
          quiz_id: q.id,
          answers: {},
          score: 3 + i,
          total: 5,
          passed: i > 0,
        }));
        await db.from("quiz_attempts").insert(attempts);
      }

      toast.success("Sample data loaded");
      await qc.invalidateQueries({ queryKey: ["dashboard", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to seed sample data");
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    if (!userId) return;
    setBusy("clear");
    try {
      // Find sample verification_requests
      const { data: reqs } = await db
        .from("verification_requests")
        .select("id, input_url, input_text")
        .eq("user_id", userId);
      const sampleIds = (reqs ?? [])
        .filter(
          (r: { input_url: string | null; input_text: string | null }) =>
            (r.input_url &&
              (r.input_url.includes("example") ||
                r.input_url.includes("reuters.com/world/sample") ||
                r.input_url.includes("apnews.com/article/sample") ||
                r.input_url.includes("bbc.co.uk/news/sample") ||
                r.input_url.includes("nature.com/articles/sample"))) ||
            (r.input_text && r.input_text.startsWith(SAMPLE_TAG)),
        )
        .map((r: { id: string }) => r.id);
      if (sampleIds.length) {
        await db.from("verification_results").delete().in("request_id", sampleIds);
        await db.from("verification_requests").delete().in("id", sampleIds);
      }
      toast.success(
        sampleIds.length ? `Removed ${sampleIds.length} sample rows` : "No sample rows to remove",
      );
      await qc.invalidateQueries({ queryKey: ["dashboard", userId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear sample data");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 text-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="text-muted-foreground">
          {hasData
            ? "Demo tools (sample data)"
            : "New here? Load demo verifications to preview the dashboard."}
        </span>
        <span className="shrink-0 text-xs font-medium text-foreground/80">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-3 py-3">
          <span className="text-muted-foreground">
            {hasData
              ? "Load or clear illustrative verifications without affecting real analyses beyond matching sample URLs/tags."
              : "Seeds about two weeks of sample verifications and a few quiz attempts."}
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="secondary" onClick={seed} disabled={busy !== null}>
              {busy === "seed" ? "Loading…" : "Load sample data"}
            </Button>
            <Button size="sm" variant="ghost" onClick={clear} disabled={busy !== null}>
              {busy === "clear" ? "Clearing…" : "Clear samples"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
