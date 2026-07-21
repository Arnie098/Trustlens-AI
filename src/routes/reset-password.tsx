import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/db";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Set new password — VeriSphere AI" }] }),
  component: ResetPassword,
});

type Gate = "checking" | "ready" | "invalid";

function ResetPassword() {
  const [loading, setLoading] = useState(false);
  const [gate, setGate] = useState<Gate>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      // Recovery links establish a session; without one the form cannot succeed.
      if (data.session?.user) {
        setGate("ready");
      } else {
        setGate("invalid");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (gate === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-10">
        <p className="text-sm text-muted-foreground animate-pulse">Checking reset link…</p>
      </div>
    );
  }

  if (gate === "invalid") {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-10">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader>
            <CardTitle>Link invalid or expired</CardTitle>
            <CardDescription>
              This password reset link is no longer valid. Request a new one and open it from your
              email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/forgot-password">
              <Button className="w-full min-h-11">Request a new reset link</Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" className="w-full min-h-11">
                Back to sign in
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-10">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>Your new password must be at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setFieldError(null);
              if (password.length < 8) {
                setFieldError("Password must be at least 8 characters.");
                return;
              }
              if (password !== confirm) {
                setFieldError("Passwords don’t match.");
                return;
              }
              setLoading(true);
              const { error } = await supabase.auth.updateUser({ password });
              setLoading(false);
              if (error) {
                setFieldError(error.message);
                return toast.error(error.message);
              }
              toast.success("Password updated");
              navigate({ to: "/dashboard", replace: true });
            }}
          >
            <div>
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFieldError(null);
                }}
                aria-invalid={Boolean(fieldError)}
              />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                name="confirm"
                type="password"
                minLength={8}
                required
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setFieldError(null);
                }}
                aria-invalid={Boolean(fieldError)}
              />
              {confirm.length > 0 && password !== confirm && (
                <p className="mt-1 text-xs text-destructive">Passwords don’t match yet.</p>
              )}
            </div>
            {fieldError && <p className="text-sm text-destructive">{fieldError}</p>}
            <Button className="w-full min-h-11" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
