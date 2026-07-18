/**
 * EXPERIMENTAL — local budget testing only.
 *
 * Uses a logged-in Perplexity *website* session (Cookie header) to call the
 * unofficial browser SSE endpoint. This is fragile, may break anytime, may
 * violate Perplexity's Terms of Service, and must NEVER be used in production
 * or committed to git.
 *
 * Prefer PERPLEXITY_API_KEY when you have budget.
 *
 * Setup:
 *   1. Log in at https://www.perplexity.ai
 *   2. DevTools → Network → any request to www.perplexity.ai → copy Cookie
 *   3. Paste into .env as PERPLEXITY_COOKIES=...  OR save to
 *      data/perplexity-cookies.txt (gitignored)
 */
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractJson, normalizeResult } from "./perplexity";
import { sanitizeAnalysisProse } from "./sanitize-text";
import type { AnalysisInput, AnalysisResult } from "./types";

const WEB_SSE_URL = "https://www.perplexity.ai/rest/sse/perplexity_ask";
const DEFAULT_COOKIE_FILE = join(process.cwd(), "data", "perplexity-cookies.txt");

export function hasPerplexityCookies(): boolean {
  return Boolean(loadCookies());
}

function loadCookies(): string | null {
  const fromEnv = process.env.PERPLEXITY_COOKIES?.trim();
  if (fromEnv) return fromEnv;

  const file =
    process.env.PERPLEXITY_COOKIES_FILE?.trim() || DEFAULT_COOKIE_FILE;
  if (existsSync(file)) {
    const text = readFileSync(file, "utf8").trim();
    // Allow "Cookie: ..." prefix from copy-paste
    return text.replace(/^Cookie:\s*/i, "").trim() || null;
  }
  return null;
}

function buildQuery(input: AnalysisInput): string {
  // Keep the web-chat prompt short — long system prompts often get ignored/summarized.
  const subject =
    input.type === "url" && input.url
      ? `URL: ${input.url}`
      : input.type === "text" && input.text
        ? `Claim/text:\n${input.text.slice(0, 2500)}`
        : `Image label: ${input.imageName || "uploaded image"}`;

  return `You are TrustLensAI (media literacy analyst with live web search — not a truth oracle).
Search the open web YOURSELF for corroboration, contradictions, and source reputation. Put findings in evidence/source_assessment/context_analysis. Do NOT tell the user to look up articles, reports, or independent sources as a substitute for your search.
Reply with ONLY one JSON object (no markdown, no prose):

{"trust_score":0-100,"category":"high_trust|needs_verification|low_confidence|potentially_misleading","confidence":0-100,"summary":"what claim is + what your search supports/weakens","source_assessment":"publisher credibility from your lookup","context_analysis":"framing / other coverage","ai_generated_detected":false,"concerns":["specific risks"],"evidence":["3-5 concrete findings with outlet/URL when available — not generic tips"],"next_steps":["2-4 habits to USE this analysis carefully — not 'go research elsewhere'"],"replay_data":[{"id":"origin","label":"...","platform":"Web","timestamp":"T+0h","reach":1,"warning":false,"connections":[]}]}

Scoring: 80+ high_trust, 60-79 needs_verification, 40-59 low_confidence, <40 potentially_misleading. Hedged language.

${subject}`;
}

/**
 * Parse Perplexity website SSE stream into the final answer text.
 */
async function readSseAnswer(res: Response): Promise<{ answer: string; citations: string[] }> {
  if (!res.body) throw new Error("No SSE body from Perplexity web");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastAnswer = "";
  let finalAnswer = "";
  const citations = new Set<string>();

  const processEventData = (dataLine: string) => {
    if (!dataLine || dataLine === "{}") return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(dataLine) as Record<string, unknown>;
    } catch {
      return;
    }

    const isFinal =
      payload.final === true ||
      payload.final_sse_message === true ||
      payload.status === "COMPLETED" ||
      payload.message_mode === "FULL";

    // Collect any URL-looking sources if present
    const walk = (v: unknown, depth = 0) => {
      if (!v || depth > 6) return;
      if (typeof v === "string" && /^https?:\/\//i.test(v) && v.length < 500) {
        // skip tracking/noise
        if (!v.includes("perplexity.ai") && !v.includes("cloudflare")) citations.add(v);
      } else if (Array.isArray(v)) {
        for (const x of v) walk(x, depth + 1);
      } else if (typeof v === "object") {
        for (const x of Object.values(v as Record<string, unknown>)) walk(x, depth + 1);
      }
    };

    const looksLikePlanNoise = (text: string) =>
      text.includes("step_type") ||
      text.includes("INITIAL_QUERY") ||
      text.includes("goal_id") ||
      text.includes('"goals"') ||
      (text.trimStart().startsWith("[") && text.includes("step_type"));

    const considerAnswer = (text: string, opts?: { prefer?: boolean }) => {
      if (!text?.trim()) return;
      if (looksLikePlanNoise(text)) return;
      const prefer = opts?.prefer || text.includes("trust_score");
      if (prefer || text.length >= lastAnswer.length) lastAnswer = text;
      if (isFinal && (prefer || text.length >= finalAnswer.length)) finalAnswer = text;
    };

    const blocks = payload.blocks as unknown[] | undefined;
    if (Array.isArray(blocks)) {
      for (const b of blocks) {
        const block = b as Record<string, unknown>;
        const usage = String(block.intended_usage ?? "");

        // Skip planning / classifier blocks — they are not the model answer
        if (
          usage.includes("plan") ||
          usage.includes("pending_followups") ||
          usage.includes("answer_tabs") ||
          usage === "sources" ||
          block.plan_block
        ) {
          walk(block);
          continue;
        }

        const md = block.markdown_block as Record<string, unknown> | undefined;
        const isAskText = usage.includes("ask_text") || usage.includes("markdown");
        if (md?.answer && typeof md.answer === "string") {
          considerAnswer(md.answer, { prefer: isAskText || md.progress === "DONE" });
        }
        if (Array.isArray(md?.chunks) && isAskText) {
          considerAnswer((md.chunks as unknown[]).map(String).join(""), {
            prefer: md.progress === "DONE",
          });
        }
        walk(block);
      }
    }

    // Only use top-level answer fields on final messages (avoid plan echoes)
    if (isFinal) {
      if (typeof payload.answer === "string") considerAnswer(payload.answer, { prefer: true });
      if (typeof payload.text === "string") considerAnswer(payload.text, { prefer: true });
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events separated by blank lines
    const parts = buffer.split(/\n\n/);
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      const lines = part.split(/\n/);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (event === "end_of_stream") {
        // finish
      }
      if (dataLines.length) processEventData(dataLines.join("\n"));
    }
  }

  // flush remaining
  if (buffer.trim()) {
    for (const line of buffer.split(/\n/)) {
      if (line.startsWith("data:")) processEventData(line.slice(5).trim());
    }
  }

  const answer = (finalAnswer || lastAnswer).trim();
  if (!answer) {
    // Server-log message only — never surface transport details to the client.
    throw new Error("Perplexity analysis returned an empty response");
  }

  return { answer, citations: [...citations].slice(0, 10) };
}

export async function perplexityCookieAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  const cookies = loadCookies();
  if (!cookies) {
    throw new Error("Perplexity is not configured");
  }

  const frontendUuid = randomUUID();
  const query = buildQuery(input);

  const body = {
    params: {
      attachments: [] as string[],
      language: "en-US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      search_focus: "internet",
      sources: ["web"],
      mode: "copilot",
      model_preference: process.env.PERPLEXITY_WEB_MODEL || "turbo",
      prompt_source: "user",
      query_source: "home",
      source: "default",
      version: "2.18",
      frontend_uuid: frontendUuid,
      frontend_context_uuid: randomUUID(),
      is_related_query: false,
      is_incognito: false,
      use_schematized_api: true,
      send_back_text_in_streaming_api: false,
      skip_search_enabled: false,
      override_no_search: false,
      always_search_override: true,
      local_search_enabled: false,
      is_nav_suggestions_disabled: false,
      supported_block_use_cases: [
        "answer_modes",
        "media_items",
        "knowledge_cards",
        "inline_entity_cards",
        "place_widgets",
        "finance_widgets",
        "sports_widgets",
        "shopping_widgets",
        "jobs_widgets",
        "search_result_widgets",
        "clarification_responses",
        "inline_images",
        "inline_assets",
        "inline_entity_cards",
      ],
    },
    query_str: query,
  };

  const res = await fetch(WEB_SSE_URL, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json",
      Cookie: cookies,
      Origin: "https://www.perplexity.ai",
      Referer: "https://www.perplexity.ai/",
      "User-Agent":
        process.env.PERPLEXITY_USER_AGENT ||
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    // Keep status for server logs; avoid transport-specific wording for any client-visible path.
    throw new Error(
      `Perplexity analysis request failed (${res.status}): ${errText.slice(0, 200) || res.statusText}`,
    );
  }

  const { answer, citations } = await readSseAnswer(res);

  try {
    const parsed = extractJson(answer) as Record<string, unknown>;
    if (parsed && typeof parsed === "object" && parsed.trust_score != null) {
      return normalizeResult(parsed, input, citations, "perplexity");
    }
    console.warn("[analyze] structured fields incomplete; using prose fallback");
  } catch (err) {
    console.warn("[analyze] structured parse failed:", err);
  }

  // Prose / incomplete JSON — still return a usable TrustLens result
  const lower = answer.toLowerCase();
  let trust_score = 55;
  if (/(miracle|conspiracy|clickbait|false|debunked|misleading)/.test(lower)) trust_score = 28;
  else if (/(reputable|credible|reuters|associated press|peer-reviewed)/.test(lower)) trust_score = 78;
  else if (/(unverified|caution|mixed|unclear)/.test(lower)) trust_score = 48;

  return normalizeResult(
    {
      trust_score,
      category:
        trust_score >= 80
          ? "high_trust"
          : trust_score >= 60
            ? "needs_verification"
            : trust_score >= 40
              ? "low_confidence"
              : "potentially_misleading",
      confidence: 55,
      // Never dump raw JSON into prose — normalizeResult/sanitize also unwrap
      summary: sanitizeAnalysisProse(answer.slice(0, 2000), "summary").slice(0, 600) ||
        "Automated analysis completed. See evidence and concerns below.",
      source_assessment:
        "Source signals were reviewed with web-grounded analysis when available.",
      context_analysis:
        sanitizeAnalysisProse(answer.slice(0, 2000), "context_analysis").slice(0, 1200) ||
        "Context review was limited with the signals available for this run.",
      ai_generated_detected: /ai[- ]generated|deepfake|synthetic/.test(lower),
      concerns: ["Some analysis fields were inferred; treat the score as provisional."],
      // Empty evidence so normalizeResult folds filtered citations cleanly
      evidence: [],
      next_steps: [
        "Review the evidence list above before sharing or acting on the claim",
        "Open any cited sources and check date, author, and full context",
        "Pause before resharing if the summary still feels incomplete",
      ],
    },
    input,
    citations,
    "perplexity",
  );
}
