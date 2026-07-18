import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Camera, ImageIcon, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { capturePhoto, isNativePlatform, pickFromGallery } from "@/lib/mobile/bridge";
import { prepareImageForAnalysis } from "@/lib/mobile/image-pipeline";
import { supabase, db } from "@/lib/db";
import { useSession } from "@/lib/auth/session";
import { ensureConsent, submitAndRedirect } from "@/lib/verify/submit";

export interface VerifyScanPanelProps {
  consent: boolean;
  setConsent: (b: boolean) => void;
  onConsented: () => void | Promise<void>;
  /** Optional caption/prefill from deep link or share. */
  initialCaption?: string;
}

/**
 * Scan flow (design §5.3): capture/gallery → prepare → review → analyze.
 * OCR is wired in Task 8; until then the user can type/edit caption text.
 */
export function VerifyScanPanel({
  consent,
  setConsent,
  onConsented,
  initialCaption,
}: VerifyScanPanelProps) {
  const { user } = useSession();
  const navigate = useNavigate();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [preparedBlob, setPreparedBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("scan.jpg");
  const [caption, setCaption] = useState(initialCaption ?? "");
  const [busy, setBusy] = useState<"camera" | "gallery" | "analyze" | null>(null);
  const [needConsent, setNeedConsent] = useState(false);

  // Revoke object URLs on change/unmount so repeated scans do not leak memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (initialCaption) setCaption(initialCaption);
  }, [initialCaption]);

  async function ingestBlob(blob: Blob, name: string) {
    const prepared = await prepareImageForAnalysis(blob);
    setPreparedBlob(prepared.blob);
    setFileName(name.replace(/[^a-z0-9.\-_]/gi, "_") || "scan.jpg");
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(prepared.blob);
    });
  }

  async function onTakePhoto() {
    setBusy("camera");
    try {
      if (isNativePlatform()) {
        const blob = await capturePhoto();
        if (!blob) {
          toast.error("Could not capture a photo.");
          return;
        }
        await ingestBlob(blob, "camera.jpg");
        return;
      }
      cameraInputRef.current?.click();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Camera failed");
    } finally {
      setBusy(null);
    }
  }

  async function onChooseScreenshot() {
    setBusy("gallery");
    try {
      if (isNativePlatform()) {
        const blob = await pickFromGallery();
        if (!blob) {
          toast.error("Could not open gallery.");
          return;
        }
        await ingestBlob(blob, "screenshot.jpg");
        return;
      }
      galleryInputRef.current?.click();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Gallery failed");
    } finally {
      setBusy(null);
    }
  }

  async function onWebFile(file: File | undefined, fallbackName: string) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy("gallery");
    try {
      await ingestBlob(file, file.name || fallbackName);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Could not prepare image");
    } finally {
      setBusy(null);
    }
  }

  function clearCapture() {
    setPreparedBlob(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  async function onRunTrustLens() {
    if (!user) {
      toast.error("Please sign in to verify content.");
      return;
    }
    if (!preparedBlob) {
      toast.error("Take a photo or choose a screenshot first.");
      return;
    }
    if (!consent) {
      setNeedConsent(true);
      toast.error("Please check the AI-processing consent box first.");
      return;
    }
    setNeedConsent(false);
    setBusy("analyze");
    try {
      const ok = await ensureConsent(user.id, consent, onConsented);
      if (!ok) return;

      const path = `${user.id}/${Date.now()}-${fileName}`;
      const { error: upErr } = await supabase.storage
        .from("verification-uploads")
        .upload(path, preparedBlob, { contentType: "image/jpeg" });
      if (upErr) {
        toast.error(upErr.message || "Image upload failed");
        return;
      }

      const { data: uploaded, error: upDbErr } = await db
        .from("uploaded_content")
        .insert({
          user_id: user.id,
          storage_path: path,
          mime_type: "image/jpeg",
          size_bytes: preparedBlob.size,
        })
        .select()
        .single();
      if (upDbErr) {
        toast.error(upDbErr.message || "Failed to save upload metadata");
        return;
      }

      let imageUrl: string | undefined;
      try {
        const { data: signed } = await supabase.storage
          .from("verification-uploads")
          .createSignedUrl(path, 300);
        imageUrl = signed?.signedUrl;
      } catch {
        /* vision falls back to caption / label-only */
      }

      const trimmed = caption.trim();

      // Prefer vision when we have a fetchable URL; fold caption in as context.
      if (imageUrl) {
        await submitAndRedirect(navigate, user.id, {
          type: "image",
          input_text: trimmed.length ? trimmed : null,
          imageName: fileName,
          imageUrl,
          uploaded_content_id: uploaded?.id,
        });
        return;
      }

      // No signed URL — text path if caption is long enough, else label-only image.
      if (trimmed.length >= 10) {
        await submitAndRedirect(navigate, user.id, {
          type: "text",
          input_text: trimmed,
          imageName: fileName,
          uploaded_content_id: uploaded?.id,
        });
        return;
      }

      await submitAndRedirect(navigate, user.id, {
        type: "image",
        imageName: fileName,
        uploaded_content_id: uploaded?.id,
      });
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  const capturing = busy === "camera" || busy === "gallery";
  const analyzing = busy === "analyze";

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">
        Capture a claim from a screen or photo. Review the image, add any text you can read, then
        run TrustLens.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={Boolean(busy)}
          onClick={onTakePhoto}
          className="min-h-11 justify-start gap-3 rounded-xl border-border/80 bg-background/50"
        >
          {busy === "camera" ? (
            <Loader2 className="h-5 w-5 animate-spin text-teal" />
          ) : (
            <Camera className="h-5 w-5 text-teal" />
          )}
          Take photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={Boolean(busy)}
          onClick={onChooseScreenshot}
          className="min-h-11 justify-start gap-3 rounded-xl border-border/80 bg-background/50"
        >
          {busy === "gallery" ? (
            <Loader2 className="h-5 w-5 animate-spin text-teal" />
          ) : (
            <ImageIcon className="h-5 w-5 text-teal" />
          )}
          Choose screenshot
        </Button>
      </div>

      {/* Web fallbacks when Capacitor camera is unavailable */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          void onWebFile(e.target.files?.[0], "camera.jpg");
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          void onWebFile(e.target.files?.[0], "screenshot.jpg");
          e.target.value = "";
        }}
      />

      {previewUrl ? (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-background/40 p-4">
          <div className="overflow-hidden rounded-xl border border-border/60 bg-black/40">
            <img
              src={previewUrl}
              alt="Scan preview"
              className="mx-auto max-h-72 w-full object-contain"
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{fileName}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={clearCapture}
              disabled={analyzing}
            >
              Retake
            </Button>
          </div>

          <div>
            <Label htmlFor="scan-caption">Text from image (optional)</Label>
            <Textarea
              id="scan-caption"
              rows={4}
              maxLength={5000}
              placeholder="Type or paste any claim text visible in the image…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              disabled={analyzing}
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-read arrives in a later update. For now, add text if you can read it — vision
              still analyzes the image.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid place-items-center rounded-2xl border-2 border-dashed border-border/70 bg-background/30 px-6 py-12 text-center">
          <ScanLine className="h-9 w-9 text-teal/80" />
          <p className="mt-3 text-sm text-muted-foreground">
            {capturing ? "Preparing image…" : "No capture yet — photo or screenshot above."}
          </p>
        </div>
      )}

      <label
        className={`flex items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${
          needConsent && !consent
            ? "border-trust-medium bg-trust-medium/10 ring-2 ring-trust-medium/40"
            : "border-border bg-background/40"
        }`}
      >
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
          disabled={analyzing}
        />
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

      <Button
        type="button"
        size="lg"
        disabled={!preparedBlob || analyzing || capturing}
        onClick={onRunTrustLens}
        className="min-h-11 min-w-[12rem] rounded-full shadow-glow transition-transform hover:scale-[1.02]"
      >
        {analyzing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…
          </>
        ) : (
          "Run TrustLens"
        )}
      </Button>
      {analyzing && (
        <p className="text-sm text-muted-foreground">
          Working… live analysis often takes 10–30 seconds. Please keep this tab open.
        </p>
      )}
    </div>
  );
}
