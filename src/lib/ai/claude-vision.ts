/**
 * Claude vision for mobile screenshots only.
 *
 * freemodel (user / Render default):
 *   ANTHROPIC_BASE_URL=https://api-cc.freemodel.dev
 * Official Anthropic: leave BASE_URL unset (api.anthropic.com)
 *
 * api-cc is Claude Code–oriented; we send Claude Code wire headers
 * (x-app, User-Agent, stainless, anthropic-beta) so server calls are accepted.
 *
 * Model IDs (try in order on not_found):
 *   CLAUDE_VISION_MODEL / ANTHROPIC_MODEL env, then freemodel catalog IDs
 */
import { randomUUID } from "node:crypto";
import {
  extractJson,
  looksLikeBlindVisionResult,
  looksLikeSearchRefusal,
  normalizeResult,
  resolveVisionDataUri,
  VISION_KNOWLEDGE_SYSTEM_PROMPT,
  buildUserPrompt,
} from "./perplexity";
import type { AnalysisInput, AnalysisResult } from "./types";

const ANTHROPIC_VERSION = "2023-06-01";
/** Per-upstream-call abort so a hung freemodel request fails over instead of stalling. */
const CALL_TIMEOUT_MS = 100_000;
const DEFAULT_OFFICIAL_BASE = "https://api.anthropic.com";
/** freemodel Claude Code host (hackathon default). */
const DEFAULT_FREEMODEL_BASE = "https://api-cc.freemodel.dev";
/** Claude Code User-Agent pattern accepted by freemodel api-cc. */
const CLAUDE_CODE_USER_AGENT =
  process.env.CLAUDE_CODE_USER_AGENT?.trim() ||
  "claude-cli/1.0.119 (external, cli)";
const CLAUDE_CODE_BETAS =
  process.env.ANTHROPIC_BETA?.trim() ||
  "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14";

/**
 * Models advertised by api-cc.freemodel.dev (confirmed from its 400 error body).
 * Ordered strongest-first. Anything outside this set returns 暂不支持 / not_found,
 * so we do not carry legacy aliases or unlisted catalog guesses.
 */
const FREEMODEL_VISION_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-sonnet-5",
  "claude-haiku-4-5-20251001",
] as const;

export function hasClaudeKey(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() || process.env.CLAUDE_API_KEY?.trim(),
  );
}

function claudeApiKey(): string {
  return (
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim() ||
    ""
  );
}

function claudeBaseUrl(): string {
  const explicit = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const useFree =
    /^(1|true|yes)$/i.test(process.env.ANTHROPIC_USE_FREEMODEL?.trim() || "");
  return useFree ? DEFAULT_FREEMODEL_BASE : DEFAULT_OFFICIAL_BASE;
}

function isApiCcHost(baseOrUrl: string): boolean {
  return /api-cc\.freemodel\.dev/i.test(baseOrUrl);
}

function claudeMessagesUrl(): string {
  const base = claudeBaseUrl();
  let url: string;
  if (base.endsWith("/v1/messages")) url = base;
  else if (base.endsWith("/v1")) url = `${base}/messages`;
  else url = `${base}/v1/messages`;
  // Claude Code often hits messages?beta=true on compatible hosts
  if (isApiCcHost(base) && !/[?&]beta=/.test(url)) {
    url = `${url}?beta=true`;
  }
  return url;
}

/** Env preferred, then freemodel catalog, then legacy aliases. */
function candidateModels(): string[] {
  const preferred =
    process.env.CLAUDE_VISION_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    "";
  const defaults = [...FREEMODEL_VISION_MODELS];
  const list = preferred
    ? [preferred, ...defaults.filter((m) => m !== preferred)]
    : defaults;
  return [...new Set(list)];
}

/** Only retry next model when the failure looks like a bad/unknown model id. */
function isModelNotFoundError(message: string): boolean {
  // freemodel (CN): 你请求的模型 "…" 暂不支持。可用模型：…
  return /404|not[_\s-]?found|model[_ ]?not[_ ]?found|unknown model|invalid model|does not exist|unsupported model|no such model|model_not_available|not supported|暂不支持|可用模型|model is not|does not support/i.test(
    message,
  );
}

/** Host/auth policy failures — do not burn the model list. */
function isHardEndpointError(message: string): boolean {
  return /Claude Code-only|Access Denied|official Claude Code|401|403|invalid.?x-api-key|authentication|Unauthorized|No valid credentials/i.test(
    message,
  );
}

function isThirdPartyRejected(message: string): boolean {
  return /third-party|client rejected|not allowed|forbidden client/i.test(message);
}

function parseDataUri(dataUri: string): { mediaType: string; base64: string } {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error("Invalid vision data URI");
  return { mediaType: m[1], base64: m[2] };
}

function extractTextFromClaudeResponse(data: {
  content?: { type?: string; text?: string }[];
  choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
  error?: { message?: string; type?: string };
}): string {
  if (data.error?.message) {
    throw new Error(data.error.message);
  }
  let textParts = (data.content || [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n");

  if (!textParts.trim() && data.choices?.[0]?.message?.content) {
    const c = data.choices[0].message.content;
    if (typeof c === "string") textParts = c;
    else if (Array.isArray(c)) {
      textParts = c
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text!)
        .join("\n");
    }
  }
  return textParts;
}

function isFreemodelEndpoint(endpoint: string): boolean {
  return /freemodel\.dev/i.test(endpoint);
}

type HeaderMode = "simple" | "claude_code";

/** simple = official Anthropic-style; claude_code = freemodel api-cc wire image. */
function buildClaudeRequestHeaders(
  apiKey: string,
  endpoint: string,
  mode: HeaderMode,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "anthropic-version": ANTHROPIC_VERSION,
    "x-api-key": apiKey,
  };

  if (mode === "simple") {
    // Some freemodel routes reject "third-party" when we over-fingerprint as Claude Code.
    headers.Authorization = `Bearer ${apiKey}`;
    headers["User-Agent"] = "verisphere-server/1.0 (anthropic-compatible)";
    return headers;
  }

  // Claude Code wire image for api-cc.freemodel.dev
  headers.Authorization = `Bearer ${apiKey}`;
  headers["User-Agent"] = CLAUDE_CODE_USER_AGENT;
  headers["x-app"] = "cli";
  headers["anthropic-dangerous-direct-browser-access"] = "true";
  headers["anthropic-beta"] = CLAUDE_CODE_BETAS;
  headers["X-Claude-Code-Session-Id"] = randomUUID();
  headers["X-Stainless-Lang"] = "js";
  headers["X-Stainless-Package-Version"] = "0.52.0";
  headers["X-Stainless-OS"] = "Linux";
  headers["X-Stainless-Arch"] = "x64";
  headers["X-Stainless-Runtime"] = "node";
  headers["X-Stainless-Runtime-Version"] = process.version || "v22.0.0";
  headers["X-Stainless-Retry-Count"] = "0";
  headers["X-Stainless-Timeout"] = "600";
  headers["x-client-request-id"] = randomUUID();
  if (
    /^(1|true)$/i.test(process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC || "") ||
    isApiCcHost(endpoint)
  ) {
    headers["x-claude-code-disable-nonessential-traffic"] = "1";
  }
  return headers;
}

function headerModesFor(endpoint: string): HeaderMode[] {
  // claude_code first: api-cc rejects simple headers every time in practice, so
  // leading with simple burned a guaranteed-failed round trip on each request.
  if (isFreemodelEndpoint(endpoint)) return ["claude_code", "simple"];
  return ["simple"];
}

async function callClaudeOnce(
  endpoint: string,
  apiKey: string,
  model: string,
  mediaType: string,
  base64: string,
  prompt: string,
  headerMode: HeaderMode = "simple",
): Promise<{ text: string; model: string }> {
  const headers = buildClaudeRequestHeaders(apiKey, endpoint, headerMode);

  // freemodel marks temperature unsupported for some opus ids — omit it there
  // Put IMAGE first so vision models lock onto pixels before reading helper text.
  const body: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    system: VISION_KNOWLEDGE_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text:
              prompt +
              "\n\nThe image above is the social screenshot. Analyze THAT image. " +
              "Ignore any meta talk about OCR, imageBase64, or vision availability.",
          },
        ],
      },
    ],
  };
  if (!isFreemodelEndpoint(endpoint)) {
    body.temperature = 0.2;
  }

  // Successful freemodel vision calls run 37–58s; a hung upstream otherwise
  // stalls until the mobile client's 240s read timeout. Abort and fail over.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CALL_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (ctrl.signal.aborted) {
      throw new Error(`Claude call timed out after ${CALL_TIMEOUT_MS / 1000}s model=${model}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const raw = await res.text();
  let data: ReturnType<typeof JSON.parse>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Claude non-JSON ${res.status}: ${raw.slice(0, 200)}`);
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.message ||
      data?.error?.type ||
      raw.slice(0, 300) ||
      res.statusText;
    throw new Error(`Claude API ${res.status} model=${model}: ${msg}`);
  }

  const text = extractTextFromClaudeResponse(data);
  if (!text.trim()) throw new Error(`Empty Claude response model=${model}`);
  // freemodel may still return Access Denied as 200 prose if headers fail
  if (/Access Denied|official Claude Code client only|unauthorized client/i.test(text)) {
    throw new Error(
      `api-cc freemodel rejected call (model=${model}). ` +
        `Confirm ANTHROPIC_API_KEY is a freemodel key for https://api-cc.freemodel.dev and model id. ` +
        `Body: ${text.slice(0, 160)}`,
    );
  }
  return { text, model };
}

const JSON_RETRY_SUFFIX =
  "\n\nRespond with ONLY one JSON object matching the schema. No markdown, no prose outside the JSON.";

/**
 * Resolve image bytes for Claude: prefer direct base64 (mobile), else public URL/disk.
 */
async function resolveClaudeImage(
  input: AnalysisInput,
): Promise<{ mediaType: string; base64: string; source: string }> {
  const raw = input.imageBase64?.trim() || "";
  if (raw) {
    if (raw.startsWith("data:")) {
      const parsed = parseDataUri(raw);
      return { ...parsed, source: "imageBase64_data_uri" };
    }
    const mediaType =
      input.imageMediaType?.trim() ||
      (input.imageName?.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    // strip whitespace/newlines some clients add
    const base64 = raw.replace(/\s+/g, "");
    if (base64.length < 64) throw new Error("imageBase64 too short");
    return { mediaType, base64, source: "imageBase64" };
  }

  const url = input.imageUrl?.trim();
  if (!url) {
    throw new Error(
      "Claude vision requires imageBase64 (preferred) or imageUrl from POST /api/uploads",
    );
  }
  const dataUri = await resolveVisionDataUri(url);
  const parsed = parseDataUri(dataUri);
  return { ...parsed, source: "imageUrl" };
}

/**
 * Analyze a mobile screenshot with Claude vision (image bytes in the API call).
 */
export async function claudeVisionAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  const apiKey = claudeApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY (or CLAUDE_API_KEY) is not set");

  const { mediaType, base64, source } = await resolveClaudeImage(input);
  // Ensure prompt path treats this as a real image (buildUserPrompt checks imageUrl)
  const promptInput: AnalysisInput = {
    ...input,
    type: "image",
    imageUrl: input.imageUrl?.trim() || "inline://screenshot",
    imageName: input.imageName || "social-feed-screenshot.jpg",
  };
  const prompt = buildUserPrompt(promptInput, true);
  const primaryEndpoint = claudeMessagesUrl();
  // If api-cc rejects third-party clients, also try cc.freemodel.dev
  const endpoints = Array.from(
    new Set(
      [
        primaryEndpoint,
        isApiCcHost(primaryEndpoint)
          ? primaryEndpoint.replace("api-cc.freemodel.dev", "cc.freemodel.dev")
          : "",
        isFreemodelEndpoint(primaryEndpoint) && !isApiCcHost(primaryEndpoint)
          ? primaryEndpoint.replace("cc.freemodel.dev", "api-cc.freemodel.dev")
          : "",
      ].filter(Boolean),
    ),
  );
  const models = candidateModels();

  console.info(
    `[claude-vision] source=${source} endpoints=${endpoints.join("|")} candidates=${models.join(",")} media=${mediaType} b64KB=${Math.round(base64.length / 1024)}`,
  );

  const errors: string[] = [];
  let lastErr: Error | null = null;

  for (const endpoint of endpoints) {
  const modes = headerModesFor(endpoint);

  for (const model of models) {
    try {
      let text: string = "";
      let used: string = model;
      let usedMode: HeaderMode = modes[0];
      let callOk = false;
      let lastCallMsg = "";

      for (const mode of modes) {
        try {
          ({ text, model: used } = await callClaudeOnce(
            endpoint,
            apiKey,
            model,
            mediaType,
            base64,
            prompt,
            mode,
          ));
          callOk = true;
          usedMode = mode;
          console.info(`[claude-vision] ok model=${used} headers=${mode} ep=${endpoint}`);
          break;
        } catch (callErr) {
          lastErr = callErr instanceof Error ? callErr : new Error(String(callErr));
          lastCallMsg = lastErr.message;
          errors.push(`${model}/${mode}: ${lastCallMsg}`);
          console.warn(`[claude-vision] ${model} headers=${mode} failed:`, lastCallMsg);
          // Try next header mode on freemodel third-party / auth style rejections
          if (isThirdPartyRejected(lastCallMsg) || /unauthorized|401|403/i.test(lastCallMsg)) {
            continue;
          }
          if (isModelNotFoundError(lastCallMsg)) break;
          // other errors: stop header retries for this model
          break;
        }
      }

      if (!callOk) {
        if (isHardEndpointError(lastCallMsg) && !isThirdPartyRejected(lastCallMsg)) {
          // try next endpoint if third-party-ish not the only issue
          if (/401|403|auth/i.test(lastCallMsg)) continue;
          break;
        }
        if (!isModelNotFoundError(lastCallMsg) && !isThirdPartyRejected(lastCallMsg)) {
          continue;
        }
        continue;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = extractJson(text) as Record<string, unknown>;
      } catch (parseErr) {
        // freemodel sometimes returns prose — one strict JSON retry
        console.warn(
          `[claude-vision] non-JSON from ${model}, retrying:`,
          text.slice(0, 180).replace(/\s+/g, " "),
        );
        try {
          ({ text, model: used } = await callClaudeOnce(
            endpoint,
            apiKey,
            model,
            mediaType,
            base64,
            prompt + JSON_RETRY_SUFFIX,
            usedMode,
          ));
          parsed = extractJson(text) as Record<string, unknown>;
        } catch (retryErr) {
          lastErr = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
          errors.push(`${model}: ${lastErr.message}`);
          console.warn(`[claude-vision] JSON retry failed ${model}:`, lastErr.message);
          // try next catalog model — bad instruction following ≠ hard failure
          continue;
        }
      }

      console.info(`[claude-vision] success model=${used}`);
      let result = normalizeResult(parsed, input, []);

      const isBad = (r: typeof result) =>
        looksLikeBlindVisionResult(r.summary, r.source_assessment, r.context_analysis) ||
        looksLikeSearchRefusal(r.summary, r.context_analysis);

      if (isBad(result)) {
        // Blind/OCR-framed OR a "can't search" punt — one forced re-look at the image
        console.warn(`[claude-vision] blind or search-refusal answer from ${used}; re-prompting`);
        try {
          const strict =
            prompt +
            "\n\nREDO: You MUST open with what the PHOTO shows (subject, page name, headline). " +
            "Do NOT say OCR-derived, no accompanying photo, or text-only. " +
            "Do NOT say you can't search or offer to help the user verify — assess from your own knowledge. " +
            "Return JSON only.";
          ({ text, model: used } = await callClaudeOnce(
            endpoint,
            apiKey,
            model,
            mediaType,
            base64,
            strict,
            usedMode,
          ));
          result = normalizeResult(extractJson(text) as Record<string, unknown>, input, []);
        } catch (reErr) {
          console.warn(`[claude-vision] re-prompt failed:`, reErr);
        }
        if (isBad(result)) {
          // Still bad — try next model rather than ship a broken card
          throw new Error(
            `Blind/refusal vision result model=${used}: ${result.summary.slice(0, 120)}`,
          );
        }
      }

      return {
        ...result,
        provider: "claude",
        engine_path: "claude_vision",
        engine_detail: `model=${used}; headers=${usedMode}; endpoint=${endpoint}; source=${source}`,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      errors.push(`${model}: ${lastErr.message}`);
      console.warn(`[claude-vision] model ${model} failed:`, lastErr.message);
      if (
        !isModelNotFoundError(lastErr.message) &&
        !isThirdPartyRejected(lastErr.message) &&
        !/Blind\/OCR-framed/i.test(lastErr.message)
      ) {
        // try next endpoint
        break;
      }
    }
  } // models
  } // endpoints

  const detail = errors.join(" || ").slice(0, 500);
  throw lastErr
    ? new Error(`${lastErr.message} [tried: ${detail}]`)
    : new Error(`Claude vision failed: ${detail}`);
}
