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
import { ArrowLeft, CheckCircle2, Lightbulb, XCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/quiz/$moduleId")({
  head: () => ({ meta: [{ title: "Quiz — VeriSphere AI" }] }),
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

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["quiz", moduleId],
    queryFn: async () => {
      const { data: q, error: qErr } = await db
        .from("quizzes")
        .select("*")
        .eq("module_id", moduleId)
        .maybeSingle();
      if (qErr) throw qErr;
      if (!q) return null;
      const { data: questions, error: qqErr } = await db
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", q.id)
        .order("sort_order");
      if (qqErr) throw qqErr;
      return { quiz: q, questions: (questions ?? []) as Question[] };
    },
  });

  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <main className="mx-auto grid min-h-[50vh] max-w-2xl place-items-center px-4">
        <p className="animate-pulse text-muted-foreground">Loading quiz…</p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="mx-auto grid min-h-[50vh] max-w-2xl place-items-center px-4">
        <div className="max-w-md text-center">
          <p className="font-medium">Could not load this quiz.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {(error as Error)?.message || "Something went wrong."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" onClick={() => refetch()}>
              Retry
            </Button>
            <Button variant="outline" onClick={() => navigate({ to: "/learn" })}>
              Back to courses
            </Button>
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-muted-foreground">No quiz is available for this course yet.</p>
        <Button
          variant="outline"
          className="mt-4 rounded-full"
          onClick={() => navigate({ to: "/learn" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to courses
        </Button>
      </main>
    );
  }

  const { quiz, questions } = data;
  if (!questions.length) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-muted-foreground">This quiz has no questions yet.</p>
        <Button
          variant="outline"
          className="mt-4 rounded-full"
          onClick={() => navigate({ to: "/learn" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to courses
        </Button>
      </main>
    );
  }

  const q = questions[i];
  const isLast = i === questions.length - 1;
  const score = answers.reduce((s, a, idx) => s + (a === questions[idx].correct_index ? 1 : 0), 0);
  const isCorrect = selected !== null && selected === q.correct_index;

  async function submitFinal(finalAnswers: number[]) {
    if (!user) return;
    const correct = finalAnswers.reduce(
      (s, a, idx) => s + (a === questions[idx].correct_index ? 1 : 0),
      0,
    );
    const pct = Math.round((correct / questions.length) * 100);
    const passed = pct >= (quiz.pass_score ?? 70);
    const { error: insertErr } = await db.from("quiz_attempts").insert({
      user_id: user.id,
      quiz_id: quiz.id,
      score: correct,
      total: questions.length,
      passed,
      answers: finalAnswers,
    });
    if (insertErr) throw new Error(insertErr.message || "Failed to save quiz attempt");
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

  async function advance() {
    if (selected === null) return;
    const next = [...answers, selected];
    if (isLast) {
      setSubmitting(true);
      try {
        await submitFinal(next);
        setAnswers(next);
        setShowResult(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save quiz");
      } finally {
        setSubmitting(false);
      }
    } else {
      setAnswers(next);
      setSelected(null);
      setRevealed(false);
      setI(i + 1);
    }
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
                className={`mx-auto grid h-14 w-14 place-items-center rounded-full ${
                  passed ? "bg-trust-high/15 shadow-glow" : "bg-trust-medium/15"
                }`}
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
                className={`font-display text-6xl font-semibold tracking-tight ${
                  passed ? "text-trust-high" : "text-trust-medium"
                }`}
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
              onValueChange={(v) => {
                if (revealed) return;
                setSelected(Number(v));
              }}
            >
              <div className="space-y-2">
                {q.options.map((opt, idx) => {
                  const showMarks = revealed;
                  const correct = idx === q.correct_index;
                  const chosen = selected === idx;
                  let markClass =
                    "border-border bg-background/40 hover:border-teal/40 hover:bg-background/60";
                  if (showMarks && correct) {
                    markClass = "border-trust-high bg-trust-high/10";
                  } else if (showMarks && chosen && !correct) {
                    markClass = "border-trust-danger bg-trust-danger/10";
                  } else if (!showMarks && chosen) {
                    markClass = "border-teal bg-teal/10 shadow-glow";
                  }
                  return (
                    <label
                      key={idx}
                      className={`flex min-h-11 items-center gap-3 rounded-xl border p-3 transition-all ${
                        revealed ? "cursor-default" : "cursor-pointer"
                      } ${markClass}`}
                    >
                      <RadioGroupItem
                        value={idx.toString()}
                        id={`o-${idx}`}
                        disabled={revealed}
                      />
                      <Label
                        htmlFor={`o-${idx}`}
                        className={`flex flex-1 items-center gap-2 ${
                          revealed ? "cursor-default" : "cursor-pointer"
                        }`}
                      >
                        <span className="flex-1">{opt}</span>
                        {showMarks && correct && (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-trust-high" aria-label="Correct" />
                        )}
                        {showMarks && chosen && !correct && (
                          <XCircle className="h-4 w-4 shrink-0 text-trust-danger" aria-label="Incorrect" />
                        )}
                      </Label>
                    </label>
                  );
                })}
              </div>
            </RadioGroup>

            {revealed && (
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  isCorrect
                    ? "border-trust-high/30 bg-trust-high/10"
                    : "border-trust-medium/30 bg-trust-medium/10"
                }`}
                role="status"
              >
                <div className="flex items-center gap-2 font-semibold">
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-trust-high" /> Correct
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-trust-medium" /> Not quite
                    </>
                  )}
                </div>
                {q.explanation ? (
                  <p className="mt-2 flex gap-2 text-muted-foreground">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal" />
                    <span>{q.explanation}</span>
                  </p>
                ) : (
                  !isCorrect && (
                    <p className="mt-2 text-muted-foreground">
                      The correct answer is highlighted above.
                    </p>
                  )
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col items-end gap-2">
              {!revealed && selected === null && (
                <p className="text-xs text-muted-foreground">Select an answer to continue</p>
              )}
              {!revealed ? (
                <Button
                  className="min-w-[8rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
                  disabled={selected === null}
                  title={selected === null ? "Select an answer first" : "Check your answer"}
                  onClick={() => setRevealed(true)}
                >
                  Check answer
                </Button>
              ) : (
                <Button
                  className="min-w-[8rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
                  disabled={submitting}
                  onClick={advance}
                >
                  {submitting ? "Saving…" : isLast ? "Finish" : "Next question"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
