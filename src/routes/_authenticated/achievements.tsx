import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Lock, Award, Brain, BookOpen, Search, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  award: Award,
  "book-open": BookOpen,
  brain: Brain,
  trophy: Trophy,
  "shield-check": ShieldCheck,
  search: Search,
};

export const Route = createFileRoute("/_authenticated/achievements")({
  head: () => ({ meta: [{ title: "Achievements — TrustLensAI" }] }),
  component: Achievements,
});

function Achievements() {
  const { user } = useSession();
  const { data } = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: badges }, { data: mine }] = await Promise.all([
        db.from("badges").select("*"),
        db.from("user_badges").select("badge_id, awarded_at").eq("user_id", user!.id),
      ]);
      return { all: badges ?? [], earned: mine ?? [] };
    },
  });

  const earnedCount = data
    ? data.all.filter((b: { id: string }) =>
        data.earned.some((x: { badge_id: string }) => x.badge_id === b.id),
      ).length
    : 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-in-slow">
        <span className="inline-block h-px w-8 bg-foreground/40" />
        <span>Your progress</span>
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl animate-fade-up delay-100">
            Achievements
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground animate-fade-up delay-200">
            Earn badges as you verify content and complete lessons.
          </p>
        </div>
        {data && (
          <div className="glass flex items-center gap-3 rounded-full px-5 py-2.5 animate-fade-up delay-300">
            <Trophy className="h-4 w-4 text-teal" />
            <span className="text-sm">
              <span className="font-display font-semibold text-foreground">{earnedCount}</span>
              <span className="text-muted-foreground"> of {data.all.length} earned</span>
            </span>
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.all.map(
          (b: {
            id: string;
            slug: string;
            title: string;
            description: string;
            icon: string;
            criteria: string;
          }) => {
            const earned = data.earned.find((x: { badge_id: string }) => x.badge_id === b.id);
            const Icon = ICONS[b.icon] ?? Award;
            return (
              <Card
                key={b.id}
                className={`glass border-white/10 transition-all ${
                  earned
                    ? "shadow-glow hover:-translate-y-0.5"
                    : "opacity-60 saturate-50 hover:opacity-80"
                }`}
              >
                <CardContent className="pt-6">
                  <div
                    className={`grid h-14 w-14 place-items-center rounded-2xl ${earned ? "bg-gradient-primary text-primary-foreground shadow-glow" : "bg-muted text-muted-foreground"}`}
                  >
                    {earned ? <Icon className="h-7 w-7" /> : <Lock className="h-6 w-6" />}
                  </div>
                  <div className="mt-4 font-display text-lg font-semibold tracking-tight">
                    {b.title}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{b.description}</p>
                  <div className="mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground/80">How to earn:</span>{" "}
                    {b.criteria}
                  </div>
                  {earned && (
                    <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-teal/15 px-2.5 py-1 text-xs font-semibold text-teal">
                      <Trophy className="h-3 w-3" />
                      Earned {new Date(earned.awarded_at).toLocaleDateString()}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          },
        )}
      </div>
    </main>
  );
}
