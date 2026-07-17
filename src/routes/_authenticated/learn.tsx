import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { getCourseMeta } from "@/lib/learn/course-meta";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Award, BookOpen, CheckCircle2, Clock, GraduationCap, Layers, Play } from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn")({
  head: () => ({ meta: [{ title: "Courses — TrustLensAI" }] }),
  component: CourseCatalog,
});

function CourseCatalog() {
  const { user } = useSession();
  const { data, isLoading } = useQuery({
    queryKey: ["learn", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [modules, progress, lessons] = await Promise.all([
        db.from("learning_modules").select("*").order("sort_order"),
        db.from("user_learning_progress").select("*").eq("user_id", user!.id),
        db.from("lessons").select("id, module_id"),
      ]);
      return {
        modules: modules.data ?? [],
        progress: progress.data ?? [],
        lessons: lessons.data ?? [],
      };
    },
  });

  const modules = data?.modules ?? [];
  const completed = (data?.progress ?? []).filter(
    (p: { completed: boolean }) => p.completed,
  ).length;
  const inProgress = (data?.progress ?? []).filter(
    (p: { completed: boolean; progress_pct: number }) => !p.completed && (p.progress_pct ?? 0) > 0,
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Hero */}
      <div className="relative animate-scale-in overflow-hidden rounded-2xl border border-white/10 bg-navy px-6 py-10 text-navy-foreground shadow-glow sm:px-10">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-teal/20 via-transparent to-transparent" />
        <div className="relative max-w-2xl">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-navy-foreground/70 animate-fade-in-slow">
            <GraduationCap className="h-3.5 w-3.5" />
            Course catalog
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl animate-fade-up delay-100">
            Media literacy courses
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-navy-foreground/80 sm:text-base animate-fade-up delay-200">
            Structured courses with multi-unit curricula, practical exercises, and end-of-course
            quizzes. Build skills you can use the next time something goes viral.
          </p>
          <div className="mt-6 flex flex-wrap gap-4 text-sm animate-fade-up delay-300">
            <StatPill icon={Layers} label="Courses" value={modules.length || 5} />
            <StatPill icon={CheckCircle2} label="Completed" value={completed} />
            <StatPill icon={Play} label="In progress" value={inProgress} />
          </div>
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="inline-block h-px w-8 bg-foreground/40" />
            <span>Curriculum</span>
          </div>
          <h2 className="mt-3 font-display text-xl font-semibold tracking-tight">All courses</h2>
          <p className="text-sm text-muted-foreground">
            Self-paced · quiz at the end · progress saved to your profile
          </p>
        </div>
      </div>

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading course catalog…</p>}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map(
          (m: {
            id: string;
            slug: string;
            title: string;
            description: string;
            category: string;
            difficulty: string;
            estimated_minutes: number;
            sort_order: number;
          }) => {
            const p = data?.progress.find((x: { module_id: string }) => x.module_id === m.id);
            const pct = p?.progress_pct ?? 0;
            const done = Boolean(p?.completed);
            const meta = getCourseMeta(m.slug);
            const sectionCount =
              data?.lessons.filter((l: { module_id: string }) => l.module_id === m.id).length ?? 0;
            const hours = Math.max(1, Math.round((m.estimated_minutes / 60) * 10) / 10);

            return (
              <Card
                key={m.id}
                className="glass group flex flex-col overflow-hidden border-white/10 shadow-elegant transition-all hover:-translate-y-0.5 hover:shadow-glow"
              >
                <div className="border-b border-border bg-background/40 px-5 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="outline" className="font-mono text-[10px] tracking-wider">
                      {meta?.code ?? `ML-${String(m.sort_order).padStart(2, "0")}`}
                    </Badge>
                    {done ? (
                      <Badge className="gap-1 bg-trust-high text-white hover:bg-trust-high">
                        <Award className="h-3 w-3" /> Completed
                      </Badge>
                    ) : pct > 0 ? (
                      <Badge variant="secondary">{pct}% done</Badge>
                    ) : (
                      <Badge variant="outline">New</Badge>
                    )}
                  </div>
                  <CardTitle className="mt-3 font-display text-lg leading-snug tracking-tight">
                    {m.title.replace(/^Course:\s*/i, "")}
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {meta?.tagline ?? m.description}
                  </p>
                </div>

                <CardHeader className="pb-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{m.category}</Badge>
                    <Badge variant="outline" className="capitalize">
                      {m.difficulty}
                    </Badge>
                  </div>
                  <CardDescription className="mt-2 line-clamp-3">{m.description}</CardDescription>
                </CardHeader>

                <CardContent className="mt-auto space-y-4">
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2 py-1.5">
                      <Clock className="h-3.5 w-3.5 text-teal" />~{m.estimated_minutes} min
                      {hours >= 1 ? ` · ~${hours}h` : ""}
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2 py-1.5">
                      <BookOpen className="h-3.5 w-3.5 text-teal" />
                      {sectionCount || "—"} units
                    </div>
                  </div>

                  {meta?.skills?.length ? (
                    <div className="flex flex-wrap gap-1">
                      {meta.skills.slice(0, 3).map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div>
                    <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>Your progress</span>
                      <span>{pct}%</span>
                    </div>
                    <Progress value={pct} />
                  </div>

                  <Button
                    asChild
                    className="w-full rounded-full shadow-glow transition-transform hover:scale-[1.02]"
                  >
                    <Link to="/learn/$slug" params={{ slug: m.slug }}>
                      {done ? (
                        <>
                          <BookOpen className="mr-2 h-4 w-4" /> Review course
                        </>
                      ) : pct > 0 ? (
                        <>
                          <Play className="mr-2 h-4 w-4" /> Continue course
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" /> Enroll & start
                        </>
                      )}
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          },
        )}
      </div>

      {!isLoading && modules.length === 0 && (
        <Card className="glass mt-8 border-white/10">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No courses found. Run the learning seed or check your Supabase connection.
          </CardContent>
        </Card>
      )}
    </main>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-navy-foreground/20 bg-navy-foreground/10 px-3 py-1.5">
      <Icon className="h-3.5 w-3.5 opacity-80" />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-navy-foreground/70">{label}</span>
    </div>
  );
}
