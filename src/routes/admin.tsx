import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { AdminHeader } from "@/components/admin-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  ShieldAlert,
  GraduationCap,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { trustLabel, trustColorVar } from "@/lib/ai/mock-analyze";
import type { TrustCategory } from "@/lib/db";

/**
 * Standalone admin console — not nested under the user app shell.
 * Requires an authenticated admin role (user_roles.admin).
 */
export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin console — TrustLensAI" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminConsole,
});

function AdminConsole() {
  const { user, isAdmin, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);
  const [roleActingId, setRoleActingId] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth", search: { mode: "login" }, replace: true });
      return;
    }
    if (!isAdmin) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, isAdmin, navigate]);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-stats"],
    enabled: Boolean(user && isAdmin),
    queryFn: async () => {
      const [users, verifs, results, progress, mods, reports, roles] = await Promise.all([
        db
          .from("profiles")
          .select("id, full_name, email, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        db.from("verification_requests").select("id", { count: "exact", head: true }),
        db.from("verification_results").select("category, trust_score, created_at, id"),
        db.from("user_learning_progress").select("module_id, completed"),
        db.from("learning_modules").select("id, title"),
        db
          .from("moderation_reports")
          .select("*")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(10),
        db.from("user_roles").select("user_id, role"),
      ]);

      const distribution: Record<string, number> = {
        high_trust: 0,
        needs_verification: 0,
        low_confidence: 0,
        potentially_misleading: 0,
      };
      (results.data ?? []).forEach((r: { category: string }) => {
        distribution[r.category] = (distribution[r.category] ?? 0) + 1;
      });

      const moduleCompletions: Record<string, number> = {};
      (progress.data ?? []).forEach((p: { module_id: string; completed: boolean }) => {
        if (p.completed) {
          moduleCompletions[p.module_id] = (moduleCompletions[p.module_id] ?? 0) + 1;
        }
      });

      const adminIds = new Set(
        (roles.data ?? [])
          .filter((r: { role: string }) => r.role === "admin")
          .map((r: { user_id: string }) => r.user_id),
      );

      return {
        users: users.data ?? [],
        totalVerifs: verifs.count ?? 0,
        totalUsers: (users.data ?? []).length,
        adminCount: adminIds.size,
        distribution,
        moduleCompletions,
        modules: mods.data ?? [],
        recentLow: (results.data ?? [])
          .filter(
            (r: { category: string }) =>
              r.category === "low_confidence" || r.category === "potentially_misleading",
          )
          .slice(0, 8),
        reports: reports.data ?? [],
        adminIds,
      };
    },
  });

  async function updateReportStatus(
    id: string,
    status: "resolved" | "dismissed",
    successMessage: string,
  ) {
    setActingId(id);
    try {
      const { error: upErr } = await db
        .from("moderation_reports")
        .update({
          status,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (upErr) throw new Error(upErr.message || "Update failed");
      toast.success(successMessage);
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update report");
    } finally {
      setActingId(null);
    }
  }

  async function setUserAdmin(targetUserId: string, makeAdmin: boolean) {
    if (!user) return;
    setUsersError(null);
    setRoleActingId(targetUserId);
    try {
      if (makeAdmin) {
        const { error: insErr } = await db.from("user_roles").insert({
          user_id: targetUserId,
          role: "admin",
        });
        if (insErr) throw new Error(insErr.message || "Could not grant admin");
        toast.success("Admin role granted");
      } else {
        if (targetUserId === user.id) {
          throw new Error("You can’t remove your own admin role while signed in.");
        }
        const adminCount = data?.adminCount ?? 0;
        if (adminCount <= 1) {
          throw new Error("At least one admin must remain on the platform.");
        }
        const { error: delErr } = await db
          .from("user_roles")
          .delete()
          .eq("user_id", targetUserId)
          .eq("role", "admin");
        if (delErr) throw new Error(delErr.message || "Could not remove admin");
        toast.success("Admin role removed");
      }
      await queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not update role";
      setUsersError(msg);
      toast.error(msg);
    } finally {
      setRoleActingId(null);
    }
  }

  if (loading || !user || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Checking admin access…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin console
            </div>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Platform overview
            </h1>
            <p className="mt-1 text-muted-foreground">
              Governance, moderation, and platform health — separate from the learner app.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" /> {data?.adminCount ?? 0} admins
          </Badge>
        </div>

        {isError && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Could not load admin metrics.</p>
            <p className="mt-1 text-muted-foreground">
              {(error as Error)?.message || "Something went wrong."}
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        )}

        {isLoading && !data ? (
          <div className="mt-10 space-y-4">
            <p className="text-sm text-muted-foreground animate-pulse">Loading metrics…</p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="flex items-center gap-4 pt-6">
                    <div className="h-12 w-12 animate-pulse rounded-xl bg-muted" />
                    <div className="space-y-2">
                      <div className="h-7 w-10 animate-pulse rounded bg-muted" />
                      <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : data ? (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={Users} label="Users" value={data?.totalUsers ?? 0} />
              <Stat icon={Search} label="Verifications" value={data?.totalVerifs ?? 0} />
              <Stat icon={ShieldAlert} label="Flagged content" value={data?.recentLow.length ?? 0} />
              <Stat
                icon={GraduationCap}
                label="Lessons completed"
                value={Object.values(data?.moduleCompletions ?? {}).reduce(
                  (s: number, v) => s + v,
                  0,
                )}
              />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>TrustScore distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {(
                    [
                      "high_trust",
                      "needs_verification",
                      "low_confidence",
                      "potentially_misleading",
                    ] as TrustCategory[]
                  ).map((k) => {
                    const total = Object.values(data?.distribution ?? {}).reduce((a, b) => a + b, 0);
                    const val = data?.distribution?.[k] ?? 0;
                    const pct = total ? Math.round((val / total) * 100) : 0;
                    const color = trustColorVar(k);
                    return (
                      <div key={k} className="mb-3">
                        <div className="flex justify-between text-xs">
                          <span>{trustLabel(k)}</span>
                          <span className="tabular-nums">
                            {val} ({pct}%)
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Most completed modules</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    {(data?.modules ?? [])
                      .map((m: { id: string; title: string }) => ({
                        ...m,
                        count: data?.moduleCompletions?.[m.id] ?? 0,
                      }))
                      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
                      .slice(0, 5)
                      .map((m: { id: string; title: string; count: number }) => (
                        <li
                          key={m.id}
                          className="flex justify-between border-b border-border py-1.5 last:border-0"
                        >
                          <span className="truncate">{m.title}</span>
                          <span className="font-semibold tabular-nums">{m.count}</span>
                        </li>
                      ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Recent low-trust submissions</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.recentLow.length ? (
                  <ul className="space-y-2 text-sm">
                    {data.recentLow.map(
                      (r: {
                        id: string;
                        trust_score: number;
                        category: string;
                        created_at: string;
                      }) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between border-b border-border py-2 last:border-0"
                        >
                          <span className="text-muted-foreground">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                          <Badge variant="outline">
                            {r.trust_score} · {r.category.replaceAll("_", " ")}
                          </Badge>
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No low-trust items.</p>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6" id="users">
              <CardHeader>
                <CardTitle>Users</CardTitle>
              </CardHeader>
              <CardContent>
                {usersError && (
                  <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {usersError}
                  </p>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Email</th>
                        <th className="py-2 pr-3">Role</th>
                        <th className="py-2 pr-3">Joined</th>
                        <th className="py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data?.users ?? []).map(
                        (u: {
                          id: string;
                          full_name: string;
                          email: string;
                          created_at: string;
                        }) => {
                          const isUserAdmin = Boolean(data?.adminIds?.has(u.id));
                          const isSelf = u.id === user.id;
                          const busy = roleActingId === u.id;
                          return (
                            <tr key={u.id} className="border-t border-border">
                              <td className="py-2.5 pr-3">
                                {u.full_name ?? "—"}
                                {isSelf && (
                                  <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                                )}
                              </td>
                              <td className="py-2.5 pr-3">{u.email ?? "—"}</td>
                              <td className="py-2.5 pr-3">
                                {isUserAdmin ? (
                                  <Badge>admin</Badge>
                                ) : (
                                  <Badge variant="secondary">user</Badge>
                                )}
                              </td>
                              <td className="py-2.5 pr-3">
                                {new Date(u.created_at).toLocaleDateString()}
                              </td>
                              <td className="py-2.5 text-right">
                                {isUserAdmin ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy || isSelf || (data?.adminCount ?? 0) <= 1}
                                    title={
                                      isSelf
                                        ? "You can’t demote yourself"
                                        : (data?.adminCount ?? 0) <= 1
                                          ? "Keep at least one admin"
                                          : "Remove admin role"
                                    }
                                    onClick={() => setUserAdmin(u.id, false)}
                                  >
                                    {busy ? "Saving…" : "Demote"}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => setUserAdmin(u.id, true)}
                                  >
                                    {busy ? "Saving…" : "Make admin"}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        },
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Promoting grants the <code className="text-foreground">admin</code> role in{" "}
                  <code className="text-foreground">user_roles</code>. Demote is blocked for your
                  own account and when only one admin remains.
                </p>
              </CardContent>
            </Card>

            <Card className="mt-6" id="moderation">
              <CardHeader>
                <CardTitle>Moderation queue</CardTitle>
              </CardHeader>
              <CardContent>
                {data?.reports.length ? (
                  <ul className="space-y-3 text-sm">
                    {data.reports.map(
                      (r: {
                        id: string;
                        reason: string;
                        created_at: string;
                        status: string;
                        verification_result_id: string | null;
                      }) => (
                        <li
                          key={r.id}
                          className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleString()}
                            </div>
                            <div className="mt-1 font-medium">{r.reason}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <Badge variant="outline">{r.status}</Badge>
                              {r.verification_result_id && (
                                <span className="text-xs text-muted-foreground">
                                  Result {r.verification_result_id.slice(0, 8)}…
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={actingId === r.id}
                              onClick={() =>
                                updateReportStatus(r.id, "resolved", "Report resolved")
                              }
                            >
                              {actingId === r.id ? "Saving…" : "Resolve"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actingId === r.id}
                              onClick={() =>
                                updateReportStatus(r.id, "dismissed", "Report dismissed")
                              }
                            >
                              Dismiss
                            </Button>
                          </div>
                        </li>
                      ),
                    )}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No open reports.</p>
                )}
              </CardContent>
            </Card>

            <p className="mt-8 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <span className="font-semibold">AI governance:</span> Analyses are stored with the
              request and timestamp. Admins review signals — they are not final verdicts. Auth and
              roles are DB-backed (`users`, `user_roles`, `sessions`).
            </p>
          </>
        ) : null}
      </main>
    </div>
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
    <Card>
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy text-navy-foreground">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-black tabular-nums">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
