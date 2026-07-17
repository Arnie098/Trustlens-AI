import { createFileRoute, Link } from "@tanstack/react-router";
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

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
];

function ProfilePage() {
  const { user, profile, refresh } = useSession();
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["profile-history", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [ver, attempts] = await Promise.all([
        db
          .from("verification_results")
          .select("id, request_id, trust_score, category, created_at")
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
  const [toggling, setToggling] = useState<"ai" | "email" | null>(null);
  const [deleting, setDeleting] = useState(false);

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
              setProfileError(null);
              setSaving(true);
              const { error } = await db
                .from("profiles")
                .update({
                  full_name: fd.get("full_name"),
                  preferred_language: fd.get("preferred_language"),
                })
                .eq("id", user.id);
              setSaving(false);
              if (error) {
                setProfileError(error.message);
                return;
              }
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
                onChange={() => setProfileError(null)}
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
              <select
                id="preferred_language"
                name="preferred_language"
                defaultValue={profile?.preferred_language ?? "en"}
                className="mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onChange={() => setProfileError(null)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
                {profile?.preferred_language &&
                  !LANGUAGES.some((l) => l.value === profile.preferred_language) && (
                    <option value={profile.preferred_language}>
                      {profile.preferred_language}
                    </option>
                  )}
              </select>
            </div>
            <div>
              <Label htmlFor="avatar">Profile image</Label>
              <label
                htmlFor="avatar"
                className="mt-1.5 flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border bg-background/40 px-4 text-sm text-muted-foreground transition-colors hover:border-teal/40"
              >
                Choose image…
                <input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f || !user) return;
                    setAvatarError(null);
                    const path = `${user.id}/avatar-${Date.now()}-${f.name}`;
                    const { error: uploadErr } = await supabase.storage
                      .from("verification-uploads")
                      .upload(path, f);
                    if (uploadErr) {
                      setAvatarError(uploadErr.message);
                      return;
                    }
                    const { error: saveErr } = await db
                      .from("profiles")
                      .update({ avatar_url: path })
                      .eq("id", user.id);
                    if (saveErr) {
                      setAvatarError(saveErr.message);
                      return;
                    }
                    toast.success("Profile image saved");
                    refresh();
                  }}
                />
              </label>
              {avatarError && (
                <p className="mt-1 text-xs text-destructive" role="alert">
                  {avatarError}
                </p>
              )}
            </div>
            {profileError && (
              <p
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {profileError}
              </p>
            )}
            <Button
              disabled={saving}
              className="min-h-11 rounded-full shadow-glow transition-transform hover:scale-[1.02]"
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
              disabled={toggling === "ai"}
              onCheckedChange={async (v) => {
                if (!user) return;
                setToggling("ai");
                try {
                  await db
                    .from("consent_records")
                    .insert({ user_id: user.id, granted: v, scope: "ai_processing" });
                  const { error } = await db
                    .from("profiles")
                    .update({
                      ai_consent: v,
                      ai_consent_at: v ? new Date().toISOString() : null,
                    })
                    .eq("id", user.id);
                  if (error) throw new Error(error.message);
                  await refresh();
                  toast.success(v ? "Consent granted" : "Consent withdrawn");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not update consent");
                } finally {
                  setToggling(null);
                }
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
              disabled={toggling === "email"}
              onCheckedChange={async (v) => {
                if (!user) return;
                setToggling("email");
                try {
                  const { error } = await db
                    .from("profiles")
                    .update({ notification_email: v })
                    .eq("id", user.id);
                  if (error) throw new Error(error.message);
                  await refresh();
                  toast.success(v ? "Email notifications on" : "Email notifications off");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Could not update notifications");
                } finally {
                  setToggling(null);
                }
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
                  className="mt-3 min-h-11 rounded-full"
                  disabled={deleting}
                  onClick={async () => {
                    if (!user) return;
                    if (!confirm("This permanently deletes your data. Continue?")) return;
                    setDeleting(true);
                    try {
                      await db.from("verification_requests").delete().eq("user_id", user.id);
                      await db.from("quiz_attempts").delete().eq("user_id", user.id);
                      await db.from("user_learning_progress").delete().eq("user_id", user.id);
                      await db.from("user_badges").delete().eq("user_id", user.id);
                      await db.from("uploaded_content").delete().eq("user_id", user.id);
                      await db.from("profiles").delete().eq("id", user.id);
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Delete failed");
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? "Deleting…" : "Delete my data"}
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
          {historyLoading && !history ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading history…</p>
          ) : history?.verifications.length ? (
            <ul className="space-y-2 text-sm">
              {history.verifications.map(
                (v: {
                  id: string;
                  request_id: string;
                  trust_score: number;
                  category: string;
                  created_at: string;
                }) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </span>
                    <span className="font-semibold">
                      <span className="text-teal">{v.trust_score}</span> ·{" "}
                      {v.category.replaceAll("_", " ")}
                    </span>
                    {v.request_id ? (
                      <Link
                        to="/verify/$id"
                        params={{ id: v.request_id }}
                        className="text-xs font-medium text-teal underline-offset-2 hover:underline"
                      >
                        View
                      </Link>
                    ) : null}
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
          {historyLoading && !history ? (
            <p className="text-sm text-muted-foreground animate-pulse">Loading history…</p>
          ) : history?.attempts.length ? (
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
