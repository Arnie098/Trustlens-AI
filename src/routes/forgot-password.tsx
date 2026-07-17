import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/db";
import { z } from "zod";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — TrustLensAI" }] }),
  component: ForgotPassword,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email address") });

function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-10">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your email and we'll send a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm">
              <p>If an account exists for that email, you'll receive a reset link shortly.</p>
              <Link to="/auth">
                <Button variant="outline" className="w-full min-h-11">
                  Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const parsed = schema.safeParse(Object.fromEntries(fd));
                if (!parsed.success) {
                  setFormError(null);
                  setEmailError(parsed.error.issues[0]?.message ?? "Invalid email");
                  return;
                }
                setEmailError(null);
                setFormError(null);
                setLoading(true);
                const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                setLoading(false);
                if (error) {
                  setFormError(error.message);
                  return;
                }
                setSent(true);
              }}
            >
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  aria-invalid={Boolean(emailError)}
                  onChange={() => {
                    setEmailError(null);
                    setFormError(null);
                  }}
                />
                {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
              </div>
              {formError && (
                <p
                  className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {formError}
                </p>
              )}
              <Button className="w-full min-h-11" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <div className="text-center text-sm">
                <Link to="/auth" className="text-muted-foreground hover:underline">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
