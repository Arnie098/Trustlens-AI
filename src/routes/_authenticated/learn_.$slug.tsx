import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { getCourseMeta } from "@/lib/learn/course-meta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Circle,
  ClipboardList,
  GraduationCap,
  Lightbulb,
  Target,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/learn_/$slug")({
  head: () => ({ meta: [{ title: "Course — TrustLensAI" }] }),
  component: CoursePlayer,
});

function CoursePlayer() {
  const { slug } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const meta = getCourseMeta(slug);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["module", slug, user?.id],
    queryFn: async () => {
      const { data: m, error: mErr } = await db
        .from("learning_modules")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (mErr) throw mErr;
      if (!m) return null;
      const [{ data: lessons }, { data: quiz }, progressRes] = await Promise.all([
        db.from("lessons").select("*").eq("module_id", m.id).order("sort_order"),
        db.from("quizzes").select("*").eq("module_id", m.id).maybeSingle(),
        user
          ? db
              .from("user_learning_progress")
              .select("progress_pct, completed")
              .eq("user_id", user.id)
              .eq("module_id", m.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return {
        module: m,
        lessons: lessons ?? [],
        quiz,
        progress: progressRes.data as { progress_pct: number; completed: boolean } | null,
      };
    },
  });

  const [activeLesson, setActiveLesson] = useState(0);
  const [completedUnits, setCompletedUnits] = useState<Set<number>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);

  const lessons = data?.lessons ?? [];
  const total = lessons.length || 1;

  // Restore completed units from saved progress_pct (unit share is up to 90%)
  useEffect(() => {
    if (!data?.lessons?.length || hydrated) return;
    const pct = data.progress?.progress_pct ?? 0;
    if (data.progress?.completed) {
      setCompletedUnits(new Set(data.lessons.map((_: unknown, idx: number) => idx)));
      setActiveLesson(Math.max(0, data.lessons.length - 1));
    } else if (pct > 0) {
      const completedCount = Math.min(
        data.lessons.length,
        Math.round((pct / 90) * data.lessons.length),
      );
      const next = new Set<number>();
      for (let i = 0; i < completedCount; i++) next.add(i);
      setCompletedUnits(next);
      setActiveLesson(Math.min(completedCount, data.lessons.length - 1));
    }
    setHydrated(true);
  }, [data, hydrated]);

  const displayPct = useMemo(() => {
    if (!lessons.length) return 0;
    if (data?.progress?.completed) return 100;
    const unitShare = Math.round((completedUnits.size / total) * 80);
    const viewing = Math.round(((activeLesson + 1) / total) * 15);
    return Math.min(95, Math.max(unitShare, viewing, data?.progress?.progress_pct ?? 0));
  }, [activeLesson, completedUnits, data?.progress, lessons.length, total]);

  if (isLoading) {
    return (
      <main className="mx-auto grid min-h-[50vh] max-w-5xl place-items-center px-4">
        <div className="prism-sheen relative text-center">
          <div className="prism-layer" aria-hidden="true" />
          <BookOpen className="mx-auto h-8 w-8 animate-pulse text-teal" />
          <p className="mt-3 text-muted-foreground">Loading course…</p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="font-medium">Could not load this course.</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {(error as Error)?.message || "Something went wrong."}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="secondary" className="rounded-full" onClick={() => refetch()}>
            Retry
          </Button>
          <Link to="/learn">
            <Button variant="outline" className="rounded-full">
              Back to catalog
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  if (!data?.module) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-muted-foreground">Course not found.</p>
        <Link to="/learn">
          <Button variant="outline" className="mt-4 rounded-full">
            Back to catalog
          </Button>
        </Link>
      </main>
    );
  }

  const { module: mod, quiz } = data;
  const lesson = lessons[activeLesson];
  const courseTitle = mod.title.replace(/^Course:\s*/i, "");

  async function markUnitComplete() {
    if (!user || savingUnit) return;
    setSavingUnit(true);
    try {
      const next = new Set(completedUnits);
      next.add(activeLesson);
      setCompletedUnits(next);
      const pct = Math.min(90, Math.round((next.size / total) * 90));
      const { error: upErr } = await db.from("user_learning_progress").upsert(
        {
          user_id: user.id,
          module_id: mod.id,
          progress_pct: pct,
          completed: false,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,module_id" },
      );
      if (upErr) throw new Error(upErr.message || "Failed to save progress");
      const { data: b } = await db
        .from("badges")
        .select("id")
        .eq("slug", "fact-checker-in-training")
        .maybeSingle();
      if (b?.id) await db.from("user_badges").insert({ user_id: user.id, badge_id: b.id });
      toast.success(`Unit ${activeLesson + 1} marked complete`);
      if (activeLesson < total - 1) setActiveLesson((i) => i + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setSavingUnit(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Link to="/learn">
        <Button variant="ghost" size="sm" className="rounded-full">
          <ArrowLeft className="mr-2 h-4 w-4" /> Course catalog
        </Button>
      </Link>

      {/* Course hero */}
      <div className="prism-sheen relative mt-4 animate-scale-in">
        <div className="prism-layer" aria-hidden="true" />
        <div className="glass rounded-2xl border-white/10 p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] tracking-wider">
              {meta?.code ?? "COURSE"}
            </Badge>
            <Badge variant="secondary">{mod.category}</Badge>
            <Badge variant="outline" className="capitalize">
              {mod.difficulty}
            </Badge>
            <Badge variant="outline">{mod.estimated_minutes} min</Badge>
            <Badge variant="outline">{lessons.length} units</Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            {courseTitle}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{meta?.tagline ?? mod.description}</p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>Course progress</span>
              <span>{displayPct}%</span>
            </div>
            <Progress value={displayPct} />
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_1fr]">
        {/* Curriculum sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-[var(--site-header-offset)] lg:self-start">
          <div className="glass rounded-xl border-white/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              <ClipboardList className="h-3.5 w-3.5 text-teal" />
              Curriculum
            </div>
            <ol className="mt-3 space-y-1">
              {lessons.map((l: { id: string; title: string }, idx: number) => {
                const done = completedUnits.has(idx);
                const active = idx === activeLesson;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setActiveLesson(idx)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                        active
                          ? "bg-teal text-teal-foreground shadow-glow"
                          : "hover:bg-background/60"
                      }`}
                    >
                      {done ? (
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "opacity-90" : "text-trust-high"}`}
                        />
                      ) : (
                        <Circle
                          className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "opacity-80" : "text-muted-foreground"}`}
                        />
                      )}
                      <span className="leading-snug">{l.title}</span>
                    </button>
                  </li>
                );
              })}
              {quiz && (
                <li className="mt-2 border-t border-border pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start rounded-full"
                    onClick={() =>
                      navigate({ to: "/quiz/$moduleId", params: { moduleId: mod.id } })
                    }
                  >
                    <GraduationCap className="mr-2 h-4 w-4" /> Final quiz
                  </Button>
                </li>
              )}
            </ol>
          </div>

          {meta?.outcomes?.length ? (
            <div className="glass rounded-xl border-white/10 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Target className="h-3.5 w-3.5 text-teal" />
                You will learn
              </div>
              <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs text-muted-foreground">
                {meta.outcomes.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>

        {/* Unit content */}
        <div>
          {lesson ? (
            <Card className="glass border-white/10 shadow-elegant">
              <CardHeader>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5 text-teal" />
                  Unit {activeLesson + 1} of {total}
                </div>
                <CardTitle className="font-display text-2xl tracking-tight">
                  {lesson.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LessonBody body={lesson.body} />
              </CardContent>
            </Card>
          ) : (
            <Card className="glass border-white/10">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No units found for this course. Run <code>npm run seed:learn</code>.
              </CardContent>
            </Card>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Button
                variant="outline"
                className="min-h-11 rounded-full"
                disabled={activeLesson <= 0}
                title={activeLesson <= 0 ? "You’re on the first unit" : "Previous unit"}
                onClick={() => setActiveLesson((i) => Math.max(0, i - 1))}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Previous unit
              </Button>
              {activeLesson <= 0 && (
                <span className="text-xs text-muted-foreground">You’re on the first unit</span>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="secondary"
                  className="min-h-11 rounded-full"
                  disabled={savingUnit || completedUnits.has(activeLesson)}
                  onClick={markUnitComplete}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {savingUnit
                    ? "Saving…"
                    : completedUnits.has(activeLesson)
                      ? "Unit complete"
                      : "Mark unit complete"}
                </Button>
                <Button
                  className="min-h-11 rounded-full shadow-glow transition-transform hover:scale-[1.02]"
                  disabled={activeLesson >= total - 1}
                  title={
                    activeLesson >= total - 1 ? "You’re on the last unit" : "Next unit"
                  }
                  onClick={() => setActiveLesson((i) => Math.min(total - 1, i + 1))}
                >
                  Next unit <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              {activeLesson >= total - 1 && (
                <span className="text-xs text-muted-foreground">
                  You’re on the last unit — take the final quiz when ready
                </span>
              )}
            </div>
          </div>

          {quiz && activeLesson >= total - 1 && (
            <div className="prism-sheen relative mt-6">
              <div className="prism-layer" aria-hidden="true" />
              <Card className="glass border-teal/30 shadow-glow">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-6">
                  <div>
                    <div className="font-display text-lg font-semibold">
                      Ready for the final quiz?
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Pass at {quiz.pass_score ?? 70}% to complete the course
                      {meta?.certificateHint ? ` · ${meta.certificateHint}` : ""}.
                    </p>
                  </div>
                  <Button
                    size="lg"
                    className="rounded-full shadow-glow transition-transform hover:scale-[1.02]"
                    onClick={() =>
                      navigate({ to: "/quiz/$moduleId", params: { moduleId: mod.id } })
                    }
                  >
                    Take final quiz <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
            <p>
              Educational course materials. Always verify important real-world claims with
              independent, credible sources.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function LessonBody({ body }: { body: string }) {
  const blocks = body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, i) => {
        if (block.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="font-display text-base font-semibold tracking-tight text-foreground"
            >
              {block.replace(/^##\s+/, "")}
            </h3>
          );
        }
        const lines = block.split("\n");
        if (
          lines.every(
            (l) =>
              l.trim().startsWith("- ") || l.trim().startsWith("• ") || /^\d+\.\s/.test(l.trim()),
          )
        ) {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^(- |• |\d+\.\s)/, "")}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="text-muted-foreground whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}
