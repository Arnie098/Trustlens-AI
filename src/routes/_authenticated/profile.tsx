import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { db, supabase } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile & Settings — TrustLensAI" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refresh } = useSession();
  const [saving, setSaving] = useState(false);

  const { data: history } = useQuery({
    queryKey: ["profile-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [ver, attempts] = await Promise.all([
        db
          .from("verification_results")
          .select("id, trust_score, category, created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(10),
        db
          .from("quiz_attempts")
          .select("id, score, total, passed, created_at, quiz_id")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      return { verifications: ver.data ?? [], attempts: attempts.data ?? [] };
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-in-slow">
        <span className="inline-block h-px w-8 bg-foreground/40" />
        <span>Your account</span>
      </div>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-5xl animate-fade-up delay-100">
        Profile & Settings
      </h1>

      <Card className="glass mt-8 border-white/10 animate-fade-up delay-200">
        <CardHeader>
          <CardTitle className="font-display tracking-tight">Profile</CardTitle>
          <CardDescription>Update your basic information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!user) return;
              const fd = new FormData(e.currentTarget);
              setSaving(true);
              const { error } = await db
                .from("profiles")
                .update({
                  full_name: fd.get("full_name"),
                  preferred_language: fd.get("preferred_language"),
                })
                .eq("id", user.id);
              setSaving(false);
              if (error) return toast.error(error.message);
              toast.success("Profile updated");
              refresh();
            }}
          >
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                maxLength={80}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue={profile?.email ?? ""} disabled />
              <p className="mt-1 text-xs text-muted-foreground">
                Contact support to change your email.
              </p>
            </div>
            <div>
              <Label htmlFor="preferred_language">Preferred language</Label>
              <Input
                id="preferred_language"
                name="preferred_language"
                defaultValue={profile?.preferred_language ?? "en"}
                maxLength={8}
              />
            </div>
            <div>
              <Label>Profile image</Label>
              <input
                type="file"
                accept="image/*"
                className="text-sm"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f || !user) return;
                  const path = `${user.id}/avatar-${Date.now()}-${f.name}`;
                  const { error: uploadErr } = await supabase.storage
                    .from("verification-uploads")
                    .upload(path, f);
                  if (uploadErr) return toast.error(uploadErr.message);
                  await db.from("profiles").update({ avatar_url: path }).eq("id", user.id);
                  toast.success("Profile image saved");
                  refresh();
                }}
              />
            </div>
            <Button
              disabled={saving}
              className="rounded-full shadow-glow transition-transform hover:scale-[1.02]"
            >
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="glass mt-6 border-white/10 animate-fade-up delay-300">
        <CardHeader>
          <CardTitle className="font-display tracking-tight">AI processing consent</CardTitle>
          <CardDescription>
            You control whether TrustLensAI can analyze your submissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-teal/40">
            <div>
              <div className="text-sm font-medium">AI processing enabled</div>
              <div className="text-xs text-muted-foreground">
                {profile?.ai_consent_at
                  ? `Consented on ${new Date(profile.ai_consent_at).toLocaleDateString()}`
                  : "Not consented yet"}
              </div>
            </div>
            <Switch
              checked={profile?.ai_consent ?? false}
              onCheckedChange={async (v) => {
                if (!user) return;
                await db
                  .from("consent_records")
                  .insert({ user_id: user.id, granted: v, scope: "ai_processing" });
                await db
                  .from("profiles")
                  .update({
                    ai_consent: v,
                    ai_consent_at: v ? new Date().toISOString() : null,
                  })
                  .eq("id", user.id);
                refresh();
                toast.success(v ? "Consent granted" : "Consent withdrawn");
              }}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-background/40 p-3 transition-colors hover:border-teal/40">
            <div>
              <div className="text-sm font-medium">Email notifications</div>
              <div className="text-xs text-muted-foreground">Learning reminders and updates.</div>
            </div>
            <Switch
              checked={profile?.notification_email ?? true}
              onCheckedChange={async (v) => {
                if (!user) return;
                await db.from("profiles").update({ notification_email: v }).eq("id", user.id);
                refresh();
              }}
            />
          </div>

          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="flex-1">
                <div className="text-sm font-semibold">Delete my data</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permanently delete your profile, verifications, learning progress, and badges.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3 rounded-full"
                  onClick={async () => {
                    if (!user) return;
                    if (!confirm("This permanently deletes your data. Continue?")) return;
                    await db.from("verification_requests").delete().eq("user_id", user.id);
                    await db.from("quiz_attempts").delete().eq("user_id", user.id);
                    await db.from("user_learning_progress").delete().eq("user_id", user.id);
                    await db.from("user_badges").delete().eq("user_id", user.id);
                    await db.from("uploaded_content").delete().eq("user_id", user.id);
                    await db.from("profiles").delete().eq("id", user.id);
                    await supabase.auth.signOut();
                    window.location.href = "/";
                  }}
                >
                  Delete my data
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass mt-6 border-white/10 animate-fade-up delay-500">
        <CardHeader>
          <CardTitle className="font-display tracking-tight">Recent verifications</CardTitle>
        </CardHeader>
        <CardContent>
          {history?.verifications.length ? (
            <ul className="space-y-2 text-sm">
              {history.verifications.map(
                (v: { id: string; trust_score: number; category: string; created_at: string }) => (
                  <li
                    key={v.id}
                    className="flex justify-between border-b border-border py-2 last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-semibold">
                      <span className="text-teal">{v.trust_score}</span> ·{" "}
                      {v.category.replaceAll("_", " ")}
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No verifications yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="glass mt-6 border-white/10 animate-fade-up delay-500">
        <CardHeader>
          <CardTitle className="font-display tracking-tight">Quiz history</CardTitle>
        </CardHeader>
        <CardContent>
          {history?.attempts.length ? (
            <ul className="space-y-2 text-sm">
              {history.attempts.map(
                (a: {
                  id: string;
                  score: number;
                  total: number;
                  passed: boolean;
                  created_at: string;
                }) => (
                  <li
                    key={a.id}
                    className="flex justify-between border-b border-border py-2 last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-semibold">
                      {a.score}/{a.total}{" "}
                      {a.passed ? <span className="text-trust-high">· passed</span> : ""}
                    </span>
                  </li>
                ),
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No quiz attempts yet.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
