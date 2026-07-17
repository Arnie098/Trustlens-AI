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
import { Shield, ShieldCheck } from "lucide-react";

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

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-hero px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 text-navy-foreground">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 backdrop-blur">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">TrustLensAI</span>
        </Link>
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
                label="Learner demo"
                email="learner@trustlensai.app"
                password="demo-trustlens-2026"
                hint="User app"
              />
              <DemoLoginButton
                label="Admin demo"
                email="admin@trustlensai.app"
                password="demo-trustlens-2026"
                hint="Admin console"
                admin
              />
            </div>
            <p className="mt-3 text-center text-[11px] text-muted-foreground">
              Password for both demos: <code className="rounded bg-muted px-1">demo-trustlens-2026</code>
            </p>
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

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = loginSchema.safeParse(Object.fromEntries(fd));
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        setLoading(true);
        const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
        setLoading(false);
        if (error) return toast.error(error.message);
        await afterSignIn(navigate, data.user ?? data.session?.user ?? null);
      }}
    >
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
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
  const navigate = useNavigate();
  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const parsed = signupSchema.safeParse(Object.fromEntries(fd));
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
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
        if (error) return toast.error(error.message);
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
        <Input id="full_name" name="full_name" required maxLength={80} />
      </div>
      <div>
        <Label htmlFor="s-email">Email</Label>
        <Input id="s-email" name="email" type="email" autoComplete="email" required />
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
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
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
  hint,
  admin,
}: {
  label: string;
  email: string;
  password: string;
  hint: string;
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
      {admin ? <Shield className="mr-2 h-4 w-4" /> : null}
      {loading ? "Signing in…" : label}
      <span className="ml-1 text-[10px] opacity-70">({hint})</span>
    </Button>
  );
}
