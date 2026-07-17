import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/db";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — TrustLensAI" }] }),
  component: ForgotPassword,
});

const schema = z.object({ email: z.string().trim().email() });

function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
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
              <Link to="/auth"><Button variant="outline" className="w-full">Back to sign in</Button></Link>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const parsed = schema.safeParse(Object.fromEntries(fd));
                if (!parsed.success) return toast.error("Invalid email");
                setLoading(true);
                const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                setLoading(false);
                if (error) return toast.error(error.message);
                setSent(true);
              }}
            >
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <Button className="w-full" disabled={loading}>
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
