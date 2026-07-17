import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, ImageIcon, Loader2, Search, Type, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase, db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { analyzeContent } from "@/lib/ai/analyze";

const search = z.object({ tab: z.enum(["url", "text", "image"]).optional() });

export const Route = createFileRoute("/_authenticated/verify")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Verify content — TrustLensAI" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { tab } = Route.useSearch();
  const [current, setCurrent] = useState<"url" | "text" | "image">(tab ?? "url");
  const { profile, refresh } = useSession();
  const [consent, setConsent] = useState(Boolean(profile?.ai_consent));

  // Profile loads async — keep checkbox in sync with saved consent
  useEffect(() => {
    if (profile?.ai_consent) setConsent(true);
  }, [profile?.ai_consent]);

  return (
    <main className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-in-slow">
        <span className="inline-block h-px w-8 bg-foreground/40" />
        <span>Analyze — one signal at a time</span>
      </div>
      <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight sm:text-5xl animate-fade-up delay-100">
        Verify content
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground animate-fade-up delay-200">
        Submit a URL, text passage, or image. You'll get a transparent TrustScore with evidence and
        concerns to review.
      </p>

      <div className="group relative mt-8 animate-scale-in delay-300">
        <Card className="glass relative overflow-hidden border-white/10 shadow-elegant transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-teal/40 group-hover:shadow-glow">
          {/* Light sweep on hover */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/[0.07] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
          />
          {/* Teal glow rising from the corner on hover */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-teal/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          />
          <CardHeader>
            <CardTitle className="font-display tracking-tight transition-colors duration-300 group-hover:text-teal">
              New verification
            </CardTitle>
            <CardDescription>Choose the type of content to analyze.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={current} onValueChange={(v) => setCurrent(v as "url" | "text" | "image")}>
              <TabsList className="grid w-full grid-cols-3 bg-background/40">
                <TabsTrigger value="url" className="data-[state=active]:shadow-glow">
                  <Search className="mr-2 h-4 w-4" />
                  URL
                </TabsTrigger>
                <TabsTrigger value="text" className="data-[state=active]:shadow-glow">
                  <Type className="mr-2 h-4 w-4" />
                  Text
                </TabsTrigger>
                <TabsTrigger value="image" className="data-[state=active]:shadow-glow">
                  <ImageIcon className="mr-2 h-4 w-4" />
                  Image
                </TabsTrigger>
              </TabsList>
              <TabsContent value="url">
                <UrlForm consent={consent} setConsent={setConsent} onConsented={refresh} />
              </TabsContent>
              <TabsContent value="text">
                <TextForm consent={consent} setConsent={setConsent} onConsented={refresh} />
              </TabsContent>
              <TabsContent value="image">
                <ImageForm consent={consent} setConsent={setConsent} onConsented={refresh} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex items-start gap-3 rounded-xl border border-trust-medium/30 bg-trust-medium/5 p-4 text-sm animate-fade-up delay-500">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-trust-medium" />
        <p className="text-muted-foreground">
          The analysis provides signals, not verdicts. Always verify with independent, credible
          sources before believing or sharing. Live analysis can take 10–30 seconds.
        </p>
      </div>
    </main>
  );
}

interface FormProps {
  consent: boolean;
  setConsent: (b: boolean) => void;
  onConsented: () => void | Promise<void>;
}

function ConsentRow({
  consent,
  setConsent,
  highlight,
}: {
  consent: boolean;
  setConsent: (b: boolean) => void;
  highlight?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${
        highlight
          ? "border-trust-medium bg-trust-medium/10 ring-2 ring-trust-medium/40"
          : "border-border bg-background/40"
      }`}
    >
      <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
      <span>
        I consent to AI processing of my submission for verification purposes. AI analysis may be
        incomplete, inaccurate, or biased. I can withdraw consent from my profile at any time.
        {!consent && (
          <span className="mt-1 block font-medium text-trust-medium">
            Required before analyzing.
          </span>
        )}
      </span>
    </label>
  );
}

async function ensureConsent(
  userId: string,
  consent: boolean,
  onConsented: () => void | Promise<void>,
) {
  if (!consent) {
    toast.error("Please check the AI-processing consent box first.");
    return false;
  }
  try {
    await db.from("consent_records").insert({
      user_id: userId,
      granted: true,
      scope: "ai_processing",
    });
    const { error } = await db
      .from("profiles")
      .update({ ai_consent: true, ai_consent_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) console.warn("[verify] profile consent update:", error);
    await onConsented();
  } catch (e) {
    console.warn("[verify] consent save failed (continuing):", e);
  }
  return true;
}

async function submitAndRedirect(
  navigate: ReturnType<typeof useNavigate>,
  userId: string,
  payload: {
    type: "url" | "text" | "image";
    input_url?: string | null;
    input_text?: string | null;
    imageName?: string;
    uploaded_content_id?: string;
  },
) {
  const toastId = toast.loading("Creating verification…");

  const { data: req, error } = await db
    .from("verification_requests")
    .insert({
      user_id: userId,
      type: payload.type,
      input_url: payload.input_url ?? null,
      input_text: payload.input_text ?? null,
      uploaded_content_id: payload.uploaded_content_id ?? null,
      status: "processing",
    })
    .select()
    .single();

  if (error || !req?.id) {
    toast.error(error?.message ?? "Failed to create verification request", { id: toastId });
    return;
  }

  toast.loading("Analyzing content (this can take up to 30s)…", { id: toastId });

  let result;
  try {
    result = await analyzeContent({
      type: payload.type,
      url: payload.input_url ?? undefined,
      text: payload.input_text ?? undefined,
      imageName: payload.imageName,
    });
  } catch (e) {
    await db.from("verification_requests").update({ status: "failed" }).eq("id", req.id);
    toast.error(e instanceof Error ? e.message : "Analysis failed", { id: toastId });
    return;
  }

  const evidence =
    result.citations?.length && !result.evidence.some((e) => e.startsWith("Citation:"))
      ? [...result.evidence, ...result.citations.slice(0, 3).map((c) => `Citation: ${c}`)]
      : result.evidence;

  toast.loading("Saving results…", { id: toastId });

  const { data: saved, error: saveErr } = await db
    .from("verification_results")
    .insert({
      request_id: req.id,
      user_id: userId,
      trust_score: result.trust_score,
      category: result.category,
      confidence: result.confidence,
      summary: result.summary,
      source_assessment: result.source_assessment,
      context_analysis: result.context_analysis,
      ai_generated_detected: result.ai_generated_detected,
      concerns: result.concerns ?? [],
      evidence: evidence ?? [],
      next_steps: result.next_steps ?? [],
      replay_data: result.replay_data ?? null,
    })
    .select()
    .single();

  if (saveErr || !saved) {
    toast.error(saveErr?.message ?? "Failed to save analysis results", { id: toastId });
    // Still try to open the page — request exists
    navigate({ to: "/verify/$id", params: { id: req.id } });
    return;
  }

  await db.from("verification_requests").update({ status: "completed" }).eq("id", req.id);

  try {
    const { data: badge } = await db
      .from("badges")
      .select("id")
      .eq("slug", "first-verification")
      .maybeSingle();
    if (badge?.id) {
      await db.from("user_badges").insert({ user_id: userId, badge_id: badge.id });
    }
  } catch {
    /* badge is optional */
  }

  toast.success("Analysis complete — opening results…", { id: toastId });
  // Use full navigation so results always mount (flat /verify/$id route)
  await navigate({ to: "/verify/$id", params: { id: req.id }, replace: true });
}

function UrlForm({ consent, setConsent, onConsented }: FormProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [needConsent, setNeedConsent] = useState(false);

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!user) {
          toast.error("Please sign in to verify content.");
          return;
        }
        const parsed = z.string().url().safeParse(url);
        if (!parsed.success) {
          toast.error("Please enter a valid URL (with http:// or https://).");
          return;
        }
        if (!consent) {
          setNeedConsent(true);
          toast.error("Please check the AI-processing consent box first.");
          return;
        }
        setNeedConsent(false);
        setLoading(true);
        try {
          const ok = await ensureConsent(user.id, consent, onConsented);
          if (!ok) return;
          await submitAndRedirect(navigate, user.id, { type: "url", input_url: parsed.data });
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div>
        <Label htmlFor="url">URL</Label>
        <Input
          id="url"
          type="url"
          placeholder="https://example.com/article"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          disabled={loading}
        />
      </div>
      <ConsentRow consent={consent} setConsent={setConsent} highlight={needConsent && !consent} />
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="min-w-[12rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
          </>
        ) : (
          "Analyze content"
        )}
      </Button>
      {loading && (
        <p className="text-sm text-muted-foreground">
          Working… live analysis often takes 10–30 seconds. Please keep this tab open.
        </p>
      )}
    </form>
  );
}

function TextForm({ consent, setConsent, onConsented }: FormProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [needConsent, setNeedConsent] = useState(false);
  const max = 5000;

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!user) {
          toast.error("Please sign in to verify content.");
          return;
        }
        if (text.trim().length < 10) {
          toast.error("Please paste at least 10 characters.");
          return;
        }
        if (text.length > max) {
          toast.error("Text too long.");
          return;
        }
        if (!consent) {
          setNeedConsent(true);
          toast.error("Please check the AI-processing consent box first.");
          return;
        }
        setNeedConsent(false);
        setLoading(true);
        try {
          const ok = await ensureConsent(user.id, consent, onConsented);
          if (!ok) return;
          await submitAndRedirect(navigate, user.id, { type: "text", input_text: text.trim() });
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div>
        <Label htmlFor="text">Text</Label>
        <Textarea
          id="text"
          rows={6}
          maxLength={max}
          placeholder="Paste a claim or excerpt to analyze…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {text.length}/{max}
        </div>
      </div>
      <ConsentRow consent={consent} setConsent={setConsent} highlight={needConsent && !consent} />
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="min-w-[12rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
          </>
        ) : (
          "Analyze content"
        )}
      </Button>
      {loading && (
        <p className="text-sm text-muted-foreground">
          Working… live analysis often takes 10–30 seconds. Please keep this tab open.
        </p>
      )}
    </form>
  );
}

const IMAGE_MAX = 8 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function ImageForm({ consent, setConsent, onConsented }: FormProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [needConsent, setNeedConsent] = useState(false);

  const validate = (f: File) => {
    if (!IMAGE_TYPES.includes(f.type)) {
      toast.error("Only JPG, PNG, WebP, or GIF allowed.");
      return false;
    }
    if (f.size > IMAGE_MAX) {
      toast.error("Image must be under 8 MB.");
      return false;
    }
    return true;
  };

  return (
    <form
      className="mt-4 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!user) {
          toast.error("Please sign in to verify content.");
          return;
        }
        if (!file) {
          toast.error("Please choose an image.");
          return;
        }
        if (!consent) {
          setNeedConsent(true);
          toast.error("Please check the AI-processing consent box first.");
          return;
        }
        setNeedConsent(false);
        setLoading(true);
        try {
          const ok = await ensureConsent(user.id, consent, onConsented);
          if (!ok) return;
          const path = `${user.id}/${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
          const { error: upErr } = await supabase.storage
            .from("verification-uploads")
            .upload(path, file);
          if (upErr) {
            toast.error(upErr.message || "Image upload failed");
            return;
          }
          const { data: uploaded, error: upDbErr } = await db
            .from("uploaded_content")
            .insert({
              user_id: user.id,
              storage_path: path,
              mime_type: file.type,
              size_bytes: file.size,
            })
            .select()
            .single();
          if (upDbErr) {
            toast.error(upDbErr.message || "Failed to save upload metadata");
            return;
          }
          await submitAndRedirect(navigate, user.id, {
            type: "image",
            imageName: file.name,
            uploaded_content_id: uploaded?.id,
          });
        } catch (err) {
          console.error(err);
          toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          setLoading(false);
        }
      }}
    >
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f && validate(f)) setFile(f);
        }}
        className={`grid cursor-lens place-items-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
          drag
            ? "border-teal bg-teal/10 shadow-glow"
            : "border-border hover:border-teal/50 hover:bg-background/40"
        }`}
      >
        {file ? (
          <div>
            <ImageIcon className="mx-auto h-8 w-8 text-primary" />
            <div className="mt-2 text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
            <Button variant="link" size="sm" type="button" onClick={() => setFile(null)}>
              Choose a different file
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-9 w-9 text-teal" />
            <p className="mt-3 text-sm">Drag & drop an image here, or</p>
            <label className="mt-3 inline-flex cursor-pointer items-center rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.03]">
              Browse
              <input
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && validate(f)) setFile(f);
                }}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">JPG, PNG, WebP, GIF up to 8 MB</p>
          </>
        )}
      </div>
      <ConsentRow consent={consent} setConsent={setConsent} highlight={needConsent && !consent} />
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="min-w-[12rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
          </>
        ) : (
          "Analyze image"
        )}
      </Button>
      {loading && (
        <p className="text-sm text-muted-foreground">
          Working… live analysis often takes 10–30 seconds. Please keep this tab open.
        </p>
      )}
    </form>
  );
}
