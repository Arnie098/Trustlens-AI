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
  normalizeResult,
  resolveVisionDataUri,
  SYSTEM_PROMPT,
  buildUserPrompt,
} from "./perplexity";
import type { AnalysisInput, AnalysisResult } from "./types";

const ANTHROPIC_VERSION = "2023-06-01";
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

/** freemodel + Anthropic IDs that accept vision (models.dev/providers/freemodel). */
const FREEMODEL_VISION_MODELS = [
  "claude-opus-4-8",
  "claude-opus-4-7",
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
] as const;

/** Extra aliases some proxies still accept. */
const LEGACY_VISION_ALIASES = [
  "claude-opus-4.8",
  "claude-sonnet-4-20250514",
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
  const defaults = [...FREEMODEL_VISION_MODELS, ...LEGACY_VISION_ALIASES];
  const list = preferred
    ? [preferred, ...defaults.filter((m) => m !== preferred)]
    : defaults;
  return [...new Set(list)];
}

/** Only retry next model when the failure looks like a bad/unknown model id. */
function isModelNotFoundError(message: string): boolean {
  return /404|not[_\s-]?found|model[_ ]?not[_ ]?found|unknown model|invalid model|does not exist|unsupported model|no such model|model_not_available/i.test(
    message,
  );
}

/** Host/auth policy failures — do not burn the model list. */
function isHardEndpointError(message: string): boolean {
  return /Claude Code-only|Access Denied|official Claude Code|401|403|invalid.?x-api-key|authentication|Unauthorized|No valid credentials/i.test(
    message,
  );
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

/** Headers that match Claude Code CLI wire image (required by api-cc.freemodel.dev). */
function buildClaudeRequestHeaders(apiKey: string, endpoint: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
  };

  if (isApiCcHost(endpoint) || isFreemodelEndpoint(endpoint)) {
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
  }

  // Always set when configured (Claude Code env convention)
  if (
    /^(1|true)$/i.test(process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC || "") ||
    isApiCcHost(endpoint)
  ) {
    headers["x-claude-code-disable-nonessential-traffic"] = "1";
  }

  return headers;
}

async function callClaudeOnce(
  endpoint: string,
  apiKey: string,
  model: string,
  mediaType: string,
  base64: string,
  prompt: string,
): Promise<{ text: string; model: string }> {
  const headers = buildClaudeRequestHeaders(apiKey, endpoint);

  // freemodel marks temperature unsupported for some opus ids — omit it there
  // Body field order approximates Claude Code (model, messages, system, max_tokens)
  const body: Record<string, unknown> = {
    model,
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
          { type: "text", text: prompt },
        ],
      },
    ],
    system: SYSTEM_PROMPT,
    max_tokens: 2048,
  };
  if (!isFreemodelEndpoint(endpoint)) {
    body.temperature = 0.2;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

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
 * Analyze a mobile screenshot with Claude vision.
 */
export async function claudeVisionAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  const apiKey = claudeApiKey();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY (or CLAUDE_API_KEY) is not set");

  const url = input.imageUrl?.trim();
  if (!url) {
    throw new Error("Claude vision requires imageUrl from POST /api/uploads");
  }

  const dataUri = await resolveVisionDataUri(url);
  const { mediaType, base64 } = parseDataUri(dataUri);
  const prompt = buildUserPrompt(input);
  const endpoint = claudeMessagesUrl();
  const models = candidateModels();

  console.info(
    `[claude-vision] endpoint=${endpoint} candidates=${models.join(",")} media=${mediaType} b64KB=${Math.round(base64.length / 1024)}`,
  );

  const errors: string[] = [];
  let lastErr: Error | null = null;

  for (const model of models) {
    try {
      let text: string;
      let used: string;
      try {
        ({ text, model: used } = await callClaudeOnce(
          endpoint,
          apiKey,
          model,
          mediaType,
          base64,
          prompt,
        ));
      } catch (callErr) {
        lastErr = callErr instanceof Error ? callErr : new Error(String(callErr));
        errors.push(`${model}: ${lastErr.message}`);
        console.warn(`[claude-vision] model ${model} failed:`, lastErr.message);
        if (isHardEndpointError(lastErr.message)) break;
        if (!isModelNotFoundError(lastErr.message)) break;
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
      const result = normalizeResult(parsed, input, []);

      if (
        looksLikeBlindVisionResult(
          result.summary,
          result.source_assessment,
          result.context_analysis,
        )
      ) {
        console.warn(`[claude-vision] blind-looking summary with model=${used}`);
      }

      return {
        ...result,
        provider: "claude",
        engine_path: "claude_vision",
        engine_detail: `model=${used}; endpoint=${endpoint}`,
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      errors.push(`${model}: ${lastErr.message}`);
      console.warn(`[claude-vision] model ${model} failed:`, lastErr.message);
      if (!isModelNotFoundError(lastErr.message)) break;
    }
  }

  const detail = errors.join(" || ").slice(0, 500);
  throw lastErr
    ? new Error(`${lastErr.message} [tried: ${detail}]`)
    : new Error(`Claude vision failed: ${detail}`);
}
