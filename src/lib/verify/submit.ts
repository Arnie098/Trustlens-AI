import { toast } from "sonner";
import { db } from "@/lib/db";
import { analyzeContent } from "@/lib/ai/analyze";

export async function ensureConsent(
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

export type SubmitVerificationPayload = {
  type: "url" | "text" | "image";
  input_url?: string | null;
  input_text?: string | null;
  imageName?: string;
  imageUrl?: string;
  uploaded_content_id?: string;
};

type NavigateFn = (opts: {
  to: "/verify/$id";
  params: { id: string };
  replace?: boolean;
}) => void | Promise<void>;

/**
 * Create a verification request, run analysis, persist results, navigate to detail.
 * Shared by URL/text/image forms and the Scan panel.
 */
export async function submitAndRedirect(
  navigate: NavigateFn,
  userId: string,
  payload: SubmitVerificationPayload,
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
      imageUrl: payload.imageUrl,
    });
  } catch (e) {
    await db.from("verification_requests").update({ status: "failed" }).eq("id", req.id);
    toast.error(e instanceof Error ? e.message : "Analysis failed", { id: toastId });
    return;
  }

  // Final display/storage pass — never persist raw JSON blobs as prose
  const { sanitizeAnalysisProse, sanitizeDisplayList } = await import("@/lib/ai/sanitize-text");
  const summary = sanitizeAnalysisProse(result.summary, "summary");
  const source_assessment = sanitizeAnalysisProse(result.source_assessment, "source_assessment");
  const context_analysis = sanitizeAnalysisProse(result.context_analysis, "context_analysis");
  const concerns = sanitizeDisplayList(result.concerns);
  const evidence = sanitizeDisplayList(result.evidence);
  const next_steps = sanitizeDisplayList(result.next_steps);

  toast.loading("Saving results…", { id: toastId });

  const { data: saved, error: saveErr } = await db
    .from("verification_results")
    .insert({
      request_id: req.id,
      user_id: userId,
      trust_score: result.trust_score,
      category: result.category,
      confidence: result.confidence,
      summary,
      source_assessment,
      context_analysis,
      ai_generated_detected: result.ai_generated_detected,
      concerns,
      evidence,
      next_steps,
      replay_data: result.replay_data ?? null,
    })
    .select()
    .single();

  if (saveErr || !saved) {
    toast.error(saveErr?.message ?? "Failed to save analysis results", { id: toastId });
    // Still try to open the page — request exists
    await navigate({ to: "/verify/$id", params: { id: req.id } });
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
