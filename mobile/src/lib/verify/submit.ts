import { analyzeContent } from "../api/analyze";
import { db } from "../db";
import type { AnalysisInput } from "../types/analysis";

export type SubmitPayload = {
  type: "url" | "text" | "image";
  input_url?: string | null;
  input_text?: string | null;
  imageName?: string;
  imageUrl?: string;
  uploaded_content_id?: string;
};

export async function ensureConsent(userId: string, consent: boolean) {
  if (!consent) throw new Error("Please accept AI-processing consent first.");
  try {
    await db.from("consent_records").insert({
      user_id: userId,
      granted: true,
      scope: "ai_processing",
    });
    await db
      .from("profiles")
      .update({ ai_consent: true, ai_consent_at: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    /* non-fatal */
  }
}

export async function submitVerification(userId: string, payload: SubmitPayload): Promise<string> {
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
    throw new Error(error?.message ?? "Failed to create verification request");
  }

  const input: AnalysisInput = {
    type: payload.type,
    url: payload.input_url ?? undefined,
    text: payload.input_text ?? undefined,
    imageName: payload.imageName,
    imageUrl: payload.imageUrl,
  };

  let result;
  try {
    result = await analyzeContent(input);
  } catch (e) {
    await db.from("verification_requests").update({ status: "failed" }).eq("id", req.id);
    throw e;
  }

  const evidence =
    result.citations?.length && !result.evidence.some((e) => e.startsWith("Citation:"))
      ? [...result.evidence, ...result.citations.slice(0, 3).map((c) => `Citation: ${c}`)]
      : result.evidence;

  const resultRow = {
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
    provider: result.provider ?? null,
  };

  let saveErr = (await db.from("verification_results").insert(resultRow)).error;
  // `provider` column may not be migrated on older backends — retry without it.
  if (saveErr && /provider/i.test(saveErr.message)) {
    const { provider: _omit, ...withoutProvider } = resultRow;
    saveErr = (await db.from("verification_results").insert(withoutProvider)).error;
  }

  if (saveErr) {
    console.warn("[submit] save result:", saveErr);
  }

  await db.from("verification_requests").update({ status: "completed" }).eq("id", req.id);

  try {
    const { data: badge } = await db
      .from("badges")
      .select("id")
      .eq("slug", "first-verification")
      .maybeSingle();
    if (badge?.id) {
      // ignoreDuplicates: avoid hard-fail on second verification
      await db.from("user_badges").upsert(
        { user_id: userId, badge_id: badge.id },
        { onConflict: "user_id,badge_id", ignoreDuplicates: true },
      );
    }
  } catch {
    /* optional */
  }

  return req.id as string;
}
