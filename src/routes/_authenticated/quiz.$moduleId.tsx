import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quiz/$moduleId")({
  head: () => ({ meta: [{ title: "Quiz — TrustLensAI" }] }),
  component: QuizPage,
});

interface Question {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
}

function QuizPage() {
  const { moduleId } = Route.useParams();
  const { user } = useSession();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["quiz", moduleId],
    queryFn: async () => {
      const { data: q } = await db
        .from("quizzes")
        .select("*")
        .eq("module_id", moduleId)
        .maybeSingle();
      if (!q) return null;
      const { data: questions } = await db
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", q.id)
        .order("sort_order");
      return { quiz: q, questions: (questions ?? []) as Question[] };
    },
  });

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);

  if (!data)
    return (
      <main className="mx-auto grid min-h-[50vh] max-w-2xl place-items-center px-4">
        <p className="animate-pulse text-muted-foreground">Loading quiz…</p>
      </main>
    );
  const { quiz, questions } = data;
  if (!questions.length)
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 text-muted-foreground">No questions.</main>
    );

  const q = questions[i];
  const isLast = i === questions.length - 1;
  const score = answers.reduce((s, a, idx) => s + (a === questions[idx].correct_index ? 1 : 0), 0);

  async function submitFinal(finalAnswers: number[]) {
    if (!user) return;
    const correct = finalAnswers.reduce(
      (s, a, idx) => s + (a === questions[idx].correct_index ? 1 : 0),
      0,
    );
    const pct = Math.round((correct / questions.length) * 100);
    const passed = pct >= (quiz.pass_score ?? 70);
    await db.from("quiz_attempts").insert({
      user_id: user.id,
      quiz_id: quiz.id,
      score: correct,
      total: questions.length,
      passed,
      answers: finalAnswers,
    });
    if (passed) {
      const { data: b } = await db
        .from("badges")
        .select("id")
        .eq("slug", "critical-thinker")
        .maybeSingle();
      if (b?.id) await db.from("user_badges").insert({ user_id: user.id, badge_id: b.id });
      await db.from("user_learning_progress").upsert(
        {
          user_id: user.id,
          module_id: moduleId,
          progress_pct: 100,
          completed: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,module_id" },
      );
    }
    toast.success(passed ? `Passed with ${pct}%` : `Scored ${pct}% — try again`);
  }

  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= (quiz.pass_score ?? 70);
    return (
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="prism-sheen relative animate-scale-in">
          <div className="prism-layer" aria-hidden="true" />
          <Card className="glass border-white/10 shadow-glow">
            <CardHeader className="text-center">
              <div
                className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${passed ? "bg-trust-high/15 shadow-glow" : "bg-trust-medium/15"}`}
              >
                {passed ? (
                  <CheckCircle2 className="h-7 w-7 text-trust-high" />
                ) : (
                  <XCircle className="h-7 w-7 text-trust-medium" />
                )}
              </div>
              <CardTitle className="mt-2 font-display text-2xl tracking-tight">
                {passed ? "Quiz passed" : "Keep practicing"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div
                className={`font-display text-6xl font-semibold tracking-tight ${passed ? "text-trust-high" : "text-trust-medium"}`}
              >
                {pct}%
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {score} of {questions.length} correct
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Link to="/learn">
                  <Button variant="outline" className="rounded-full">
                    Back to courses
                  </Button>
                </Link>
                <Link to="/achievements">
                  <Button className="rounded-full shadow-glow transition-transform hover:scale-[1.02]">
                    See achievements
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => navigate({ to: "/learn" })}
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>
      <Progress value={((i + 1) / questions.length) * 100} className="mt-3" />
      <div className="prism-sheen relative mt-4 animate-scale-in">
        <div className="prism-layer" aria-hidden="true" />
        <Card className="glass border-white/10 shadow-elegant">
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-[0.16em] text-teal">
              Question {i + 1} of {questions.length}
            </CardTitle>
            <p className="mt-2 font-display text-lg font-medium leading-snug tracking-tight">
              {q.question}
            </p>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selected?.toString() ?? ""}
              onValueChange={(v) => setSelected(Number(v))}
            >
              <div className="space-y-2">
                {q.options.map((opt, idx) => (
                  <label
                    key={idx}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${
                      selected === idx
                        ? "border-teal bg-teal/10 shadow-glow"
                        : "border-border bg-background/40 hover:border-teal/40 hover:bg-background/60"
                    }`}
                  >
                    <RadioGroupItem value={idx.toString()} id={`o-${idx}`} />
                    <Label htmlFor={`o-${idx}`} className="flex-1 cursor-pointer">
                      {opt}
                    </Label>
                  </label>
                ))}
              </div>
            </RadioGroup>
            <div className="mt-6 flex justify-end">
              <Button
                className="min-w-[8rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
                disabled={selected === null}
                onClick={async () => {
                  const next = [...answers, selected as number];
                  setAnswers(next);
                  setSelected(null);
                  if (isLast) {
                    await submitFinal(next);
                    setShowResult(true);
                  } else {
                    setI(i + 1);
                  }
                }}
              >
                {isLast ? "Finish" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
