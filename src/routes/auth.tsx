import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { homePathForUser } from "@/lib/auth/redirect";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Sign in — TrustLensAI" },
      { name: "description", content: "Sign in or create a TrustLensAI account." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const { user, isAdmin, loading } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">(mode ?? "login");

  useEffect(() => {
    if (loading || !user) return;
    navigate({ to: homePathForUser(isAdmin ? { app_metadata: { is_admin: true } } : user), replace: true });
  }, [user, isAdmin, loading, navigate]);

  if (loading || user) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-10">
        <p className="text-sm text-muted-foreground animate-pulse">
          {user ? "Redirecting…" : "Loading…"}
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo to="/" variant="full" />
        </div>
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in with your account. Admins are sent to the admin console; learners to the
              dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <LoginForm />
              </TabsContent>
              <TabsContent value="signup">
                <SignupForm onDone={() => setTab("login")} />
              </TabsContent>
            </Tabs>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">demo</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <DemoLoginButton
                label="User Demo"
                email="learner@trustlensai.app"
                password="demo-trustlens-2026"
              />
              <DemoLoginButton
                label="Admin Demo"
                email="admin@trustlensai.app"
                password="demo-trustlens-2026"
                admin
              />
            </div>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-navy-foreground/80">
          TrustLensAI supports critical thinking and does not replace independent fact-checking.
        </p>
      </div>
    </div>
  );
}

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
});
const signupSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
});

async function afterSignIn(navigate: ReturnType<typeof useNavigate>, user: {
  app_metadata?: { is_admin?: boolean; roles?: string[] };
  role?: string;
} | null) {
  const dest = homePathForUser(user);
  toast.success(dest === "/admin" ? "Welcome, admin" : "Welcome back");
  navigate({ to: dest, replace: true });
}

function fieldErrors(issues: { path: (string | number)[]; message: string }[]) {
  const map: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    if (!map[key]) map[key] = issue.message;
  }
  return map;
}

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = loginSchema.safeParse(Object.fromEntries(fd));
        if (!parsed.success) {
          setFormError(null);
          setErrors(fieldErrors(parsed.error.issues));
          return;
        }
        setErrors({});
        setFormError(null);
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
        setLoading(false);
        if (error) {
          setFormError(error.message);
          return;
        }
        await afterSignIn(navigate, data.user ?? data.session?.user ?? null);
      }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          onChange={() => {
            setErrors((e) => ({ ...e, email: "" }));
            setFormError(null);
          }}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors.password)}
          onChange={() => {
            setErrors((e) => ({ ...e, password: "" }));
            setFormError(null);
          }}
        />
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
      </div>
      {formError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full min-h-11" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </Button>
      <div className="text-center text-sm">
        <Link to="/forgot-password" className="text-muted-foreground hover:underline">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = signupSchema.safeParse(Object.fromEntries(fd));
        if (!parsed.success) {
          setFormError(null);
          setErrors(fieldErrors(parsed.error.issues));
          return;
        }
        setErrors({});
        setFormError(null);
        setLoading(true);
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: parsed.data.full_name },
          },
        });
        setLoading(false);
        if (error) {
          setFormError(error.message);
          return;
        }
        // Local SQLite auto-logs in; Supabase may require email confirm
        if (data.session?.user) {
          await afterSignIn(navigate, data.session.user);
          return;
        }
        toast.success("Account created. You can sign in now.");
        onDone();
      }}
    >
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input
          id="full_name"
          name="full_name"
          required
          maxLength={80}
          aria-invalid={Boolean(errors.full_name)}
          onChange={() => {
            setErrors((e) => ({ ...e, full_name: "" }));
            setFormError(null);
          }}
        />
        {errors.full_name && <p className="mt-1 text-xs text-destructive">{errors.full_name}</p>}
      </div>
      <div>
        <Label htmlFor="s-email">Email</Label>
        <Input
          id="s-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-invalid={Boolean(errors.email)}
          onChange={() => {
            setErrors((e) => ({ ...e, email: "" }));
            setFormError(null);
          }}
        />
        {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email}</p>}
      </div>
      <div>
        <Label htmlFor="s-password">Password (min 8 characters)</Label>
        <Input
          id="s-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          aria-invalid={Boolean(errors.password)}
          onChange={() => {
            setErrors((e) => ({ ...e, password: "" }));
            setFormError(null);
          }}
        />
        {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
      </div>
      {formError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}
      <Button type="submit" className="w-full min-h-11" disabled={loading}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-xs text-muted-foreground">
        New accounts are learners (user role). Admin access is granted only via the database
        roles table.
      </p>
    </form>
  );
}

function DemoLoginButton({
  label,
  email,
  password,
  admin,
}: {
  label: string;
  email: string;
  password: string;
  admin?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  return (
    <Button
      type="button"
      variant={admin ? "default" : "outline"}
      className="w-full"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        let { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: admin ? "Platform Admin" : "Demo Learner" },
            },
          });
          if (signUpError && !signUpError.message.toLowerCase().includes("registered")) {
            setLoading(false);
            return toast.error(signUpError.message);
          }
          ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
        }
        setLoading(false);
        if (error) return toast.error(error.message);
        await afterSignIn(navigate, data.user ?? data.session?.user ?? null);
      }}
    >
      {loading ? "Signing in…" : label}
    </Button>
  );
}
