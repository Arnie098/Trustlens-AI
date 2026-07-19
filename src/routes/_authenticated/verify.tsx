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
import {
  AlertTriangle,
  ClipboardPaste,
  ImageIcon,
  Loader2,
  ScanLine,
  Search,
  Type,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase, db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { ensureConsent, submitAndRedirect } from "@/lib/verify/submit";
import { readClipboardText } from "@/lib/mobile/bridge";
import { VerifyScanPanel } from "@/components/verify-scan-panel";
import { analyzeContent } from "@/lib/ai/analyze";
import { extractTextFromImage, type WebOcrResult } from "@/lib/ocr/client";

const search = z.object({
  tab: z.enum(["url", "text", "image", "scan"]).optional(),
  source: z.enum(["clipboard", "share", "overlay", "camera", "gallery"]).optional(),
  prefill: z.string().optional(),
});

type VerifyTab = "url" | "text" | "image" | "scan";

export const Route = createFileRoute("/_authenticated/verify")({
  validateSearch: (s) => search.parse(s),
  head: () => ({ meta: [{ title: "Verify content — TrustLensAI" }] }),
  component: VerifyPage,
});

function VerifyPage() {
  const { tab, prefill } = Route.useSearch();
  const initialTab: VerifyTab = tab === "text" || tab === "image" || tab === "scan" ? tab : "url";
  const [current, setCurrent] = useState<VerifyTab>(initialTab);
  // Clipboard seed remounts the target form with a fresh prefill (tap-only, no polling).
  const [clipboardSeed, setClipboardSeed] = useState<{
    tab: "url" | "text";
    value: string;
    nonce: number;
  } | null>(null);
  const [clipboardBusy, setClipboardBusy] = useState(false);

  const urlPrefill =
    clipboardSeed?.tab === "url" ? clipboardSeed.value : initialTab === "url" ? prefill : undefined;
  const textPrefill =
    clipboardSeed?.tab === "text"
      ? clipboardSeed.value
      : initialTab === "text"
        ? prefill
        : undefined;
  const scanPrefill = initialTab === "scan" ? prefill : undefined;
  const { profile, refresh } = useSession();
  const [consent, setConsent] = useState(Boolean(profile?.ai_consent));

  // Profile loads async — keep checkbox in sync with saved consent
  useEffect(() => {
    if (profile?.ai_consent) setConsent(true);
  }, [profile?.ai_consent]);

  async function onVerifyClipboard() {
    setClipboardBusy(true);
    try {
      const raw = await readClipboardText();
      const value = raw.trim();
      if (!value) {
        toast.error("Copy a caption or link first.");
        return;
      }
      if (/^https?:\/\//i.test(value)) {
        setCurrent("url");
        setClipboardSeed({ tab: "url", value, nonce: Date.now() });
        toast.success("Link pasted into URL tab");
      } else {
        setCurrent("text");
        setClipboardSeed({ tab: "text", value, nonce: Date.now() });
        toast.success("Clipboard text pasted into Text tab");
      }
    } catch (e) {
      console.warn(e);
      toast.error("Could not read clipboard. Check browser permissions.");
    } finally {
      setClipboardBusy(false);
    }
  }

  return (
    <main className="relative mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground animate-fade-in-slow">
        <span className="inline-block h-px w-8 bg-foreground/40" />
        <span>Analyze — one signal at a time</span>
      </div>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl animate-fade-up delay-100">
            Verify content
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground animate-fade-up delay-200">
            Submit a URL, text passage, image, or scan. You'll get a transparent TrustScore with
            evidence and concerns to review.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onVerifyClipboard}
          disabled={clipboardBusy}
          className="min-h-11 shrink-0 rounded-full border-teal/30 bg-background/50 animate-fade-up delay-200"
        >
          {clipboardBusy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ClipboardPaste className="mr-2 h-4 w-4 text-teal" />
          )}
          Verify clipboard
        </Button>
      </div>

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
            <Tabs value={current} onValueChange={(v) => setCurrent(v as VerifyTab)}>
              <TabsList className="grid w-full grid-cols-2 gap-1 bg-background/40 sm:grid-cols-4">
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
                <TabsTrigger value="scan" className="data-[state=active]:shadow-glow">
                  <ScanLine className="mr-2 h-4 w-4" />
                  Scan
                </TabsTrigger>
              </TabsList>
              <TabsContent value="url">
                <UrlForm
                  key={`url-${clipboardSeed?.tab === "url" ? clipboardSeed.nonce : "route"}-${urlPrefill ?? ""}`}
                  consent={consent}
                  setConsent={setConsent}
                  onConsented={refresh}
                  initialValue={urlPrefill}
                />
              </TabsContent>
              <TabsContent value="text">
                <TextForm
                  key={`text-${clipboardSeed?.tab === "text" ? clipboardSeed.nonce : "route"}-${textPrefill ?? ""}`}
                  consent={consent}
                  setConsent={setConsent}
                  onConsented={refresh}
                  initialValue={textPrefill}
                />
              </TabsContent>
              <TabsContent value="image">
                <ImageForm consent={consent} setConsent={setConsent} onConsented={refresh} />
              </TabsContent>
              <TabsContent value="scan">
                <VerifyScanPanel
                  consent={consent}
                  setConsent={setConsent}
                  onConsented={refresh}
                  initialCaption={scanPrefill}
                />
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
  initialValue?: string;
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

function UrlForm({ consent, setConsent, onConsented, initialValue }: FormProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState(initialValue ?? "");
  const [needConsent, setNeedConsent] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

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
          setUrlError("Enter a valid URL including http:// or https://.");
          return;
        }
        setUrlError(null);
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
          onChange={(e) => {
            setUrl(e.target.value);
            setUrlError(null);
          }}
          required
          disabled={loading}
          aria-invalid={Boolean(urlError)}
        />
        {urlError && <p className="mt-1 text-xs text-destructive">{urlError}</p>}
      </div>
      <ConsentRow consent={consent} setConsent={setConsent} highlight={needConsent && !consent} />
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="min-h-11 min-w-[12rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
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

function TextForm({ consent, setConsent, onConsented, initialValue }: FormProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState(initialValue ?? "");
  const [needConsent, setNeedConsent] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
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
          setTextError("Paste at least 10 characters.");
          return;
        }
        if (text.length > max) {
          setTextError(`Text must be under ${max} characters.`);
          return;
        }
        setTextError(null);
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
          onChange={(e) => {
            setText(e.target.value);
            setTextError(null);
          }}
          disabled={loading}
          aria-invalid={Boolean(textError)}
        />
        <div className="mt-1 flex items-start justify-between gap-2 text-xs">
          {textError ? (
            <p className="text-destructive">{textError}</p>
          ) : (
            <span className="text-muted-foreground" />
          )}
          <span className="shrink-0 text-muted-foreground">
            {text.length}/{max}
          </span>
        </div>
      </div>
      <ConsentRow consent={consent} setConsent={setConsent} highlight={needConsent && !consent} />
      <Button
        type="submit"
        size="lg"
        disabled={loading}
        className="min-h-11 min-w-[12rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrMeta, setOcrMeta] = useState<WebOcrResult | null>(null);
  const [drag, setDrag] = useState(false);
  const [needConsent, setNeedConsent] = useState(false);

  const clearFile = () => {
    setFile(null);
    setOcrText("");
    setOcrMeta(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

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

  const applyFile = async (f: File) => {
    if (!validate(f)) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setOcrText("");
    setOcrMeta(null);
    setOcrLoading(true);
    try {
      const result = await extractTextFromImage(f);
      setOcrMeta(result);
      setOcrText(result.text);
      if (result.text.trim().length >= 10) {
        toast.success(
          result.action === "accept"
            ? "Text extracted via OCR — review and analyze."
            : "Text extracted — please review the caption before analyzing.",
        );
      } else if (result.action === "retake") {
        toast.message("Hard to read", {
          description:
            result.message ||
            "No reliable text found. You can type a caption or analyze the image as-is.",
        });
      }
    } catch (err) {
      console.warn("[verify] OCR failed:", err);
      setOcrMeta(null);
      setOcrText("");
      toast.error(
        err instanceof Error
          ? `OCR failed: ${err.message}. You can still type a caption or analyze the image.`
          : "OCR failed. You can still type a caption or analyze the image.",
      );
    } finally {
      setOcrLoading(false);
    }
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

          // Prefer OCR / edited caption as text analysis (same as mobile)
          const caption = ocrText.trim();
          if (caption.length >= 10) {
            await submitAndRedirect(navigate, user.id, {
              type: "text",
              input_text: caption.slice(0, 5000),
              imageName: file.name,
              uploaded_content_id: uploaded?.id,
            });
          } else {
            await submitAndRedirect(navigate, user.id, {
              type: "image",
              imageName: file.name,
              uploaded_content_id: uploaded?.id,
            });
          }
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
          if (f) void applyFile(f);
        }}
        className={`grid cursor-lens place-items-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
          drag
            ? "border-teal bg-teal/10 shadow-glow"
            : "border-border hover:border-teal/50 hover:bg-background/40"
        }`}
      >
        {file ? (
          <div className="w-full max-w-md">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected for verification"
                className="mx-auto max-h-48 rounded-xl border border-border object-contain"
              />
            ) : (
              <ImageIcon className="mx-auto h-8 w-8 text-primary" />
            )}
            <div className="mt-2 text-sm font-medium">{file.name}</div>
            <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</div>
            <Button variant="link" size="sm" type="button" onClick={clearFile}>
              Choose a different file
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-9 w-9 text-teal" />
            <p className="mt-3 text-sm">Drag & drop an image here, or</p>
            <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]">
              Browse
              <input
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void applyFile(f);
                }}
              />
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              JPG, PNG, WebP, GIF up to 8 MB · OCR extracts text automatically
            </p>
          </>
        )}
      </div>

      {(ocrLoading || file) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="ocr-caption">Caption / OCR text</Label>
            {ocrLoading ? (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading text via OCR.space…
              </span>
            ) : ocrMeta ? (
              <span className="text-xs text-muted-foreground">
                {ocrMeta.engine}
                {typeof ocrMeta.confidence === "number" && ocrMeta.confidence >= 0
                  ? ` · ${Math.round(ocrMeta.confidence)}%`
                  : ""}
                {ocrMeta.action ? ` · ${ocrMeta.action}` : ""}
              </span>
            ) : null}
          </div>
          <Textarea
            id="ocr-caption"
            rows={5}
            maxLength={5000}
            placeholder={
              ocrLoading
                ? "Extracting text…"
                : "Extracted or typed caption (used for analysis when ≥ 10 characters)"
            }
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            disabled={loading || ocrLoading}
          />
          {ocrMeta?.message && !ocrLoading ? (
            <p className="text-xs text-muted-foreground">{ocrMeta.message}</p>
          ) : null}
        </div>
      )}

      <ConsentRow consent={consent} setConsent={setConsent} highlight={needConsent && !consent} />
      <Button
        type="submit"
        size="lg"
        disabled={loading || ocrLoading}
        className="min-h-11 min-w-[12rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
          </>
        ) : ocrLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reading text…
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
