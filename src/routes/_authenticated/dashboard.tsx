import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — TrustLensAI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useSession();

  const { data } = useQuery({
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
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0 animate-fade-up">
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="inline-block h-px w-8 bg-foreground/40" />
            <span>Your workspace</span>
          </div>
          <h1 className="mt-4 truncate font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Welcome back, {profile?.full_name ?? "friend"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Verify content, track your learning, and earn badges.
          </p>
        </div>
        <Link to="/verify">
          <Button
            size="lg"
            className="rounded-full shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Search className="mr-2 h-5 w-5" /> New Verification
          </Button>
        </Link>
      </div>

      <SampleDataBar userId={user?.id} hasData={(data?.totalVerifications ?? 0) > 0} />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ShieldCheck} label="Verifications" value={data?.totalVerifications ?? 0} />
        <Stat icon={CheckCircle2} label="Quizzes taken" value={data?.totalQuizzes ?? 0} />
        <Stat icon={BookOpen} label="Lessons completed" value={completedLessons} />
        <Stat icon={Trophy} label="Badges earned" value={data?.badges.length ?? 0} />
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

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="glass rounded-2xl p-5 lg:col-span-3">
            <div className="text-base font-semibold">Verifications over time</div>
            <div className="mt-4">
              {analytics.length ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--teal)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--teal)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        width={30}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          color: "var(--card-foreground)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--teal)"
                        strokeWidth={2}
                        fill="url(#fillCount)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart label="Run a verification to see your trend line." />
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-5 lg:col-span-2">
            <div className="text-base font-semibold">TrustScore distribution</div>
            <div className="mt-4">
              {analytics.length ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={catData}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="category"
                        tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                        tickLine={false}
                        axisLine={false}
                        width={110}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--card)",
                          color: "var(--card-foreground)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                        {catData.map((d) => (
                          <Cell key={d.key} fill={trustColorVar(d.key)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart label="Categories will appear after your first verification." />
              )}
            </div>
          </div>
        </div>
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
            {data?.badges.length ? (
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
            {data?.recent.length ? (
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
                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-teal/40"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal">
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
            {data?.modules
              .slice(0, 3)
              .map((m: { id: string; slug: string; title: string; estimated_minutes: number }) => {
                const p = data.progress.find((x: { module_id: string }) => x.module_id === m.id);
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
              })}
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

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="grid h-64 place-items-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
      {label}
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
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm">
      <span className="text-muted-foreground">
        {hasData
          ? "Playing with demo data?"
          : "New here? Load a set of demo verifications to preview the dashboard."}
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
  );
}
