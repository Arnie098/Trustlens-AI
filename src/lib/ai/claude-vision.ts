/**
 * Claude vision for mobile screenshots only.
 *
 * freemodel: ANTHROPIC_BASE_URL=https://cc.freemodel.dev
 * Official Anthropic: leave BASE_URL unset (defaults to api.anthropic.com)
 *
 * Model IDs (try in order on not_found):
 *   CLAUDE_VISION_MODEL / ANTHROPIC_MODEL env, then freemodel catalog IDs
 *   (claude-opus-4-8, 4-7, 4-6, sonnet-4-6, haiku-4.5)
 */
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
const DEFAULT_FREEMODEL_BASE = "https://cc.freemodel.dev";

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

function claudeMessagesUrl(): string {
  const base = claudeBaseUrl();
  if (base.endsWith("/v1/messages")) return base;
  if (base.endsWith("/v1")) return `${base}/messages`;
  return `${base}/v1/messages`;
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

async function callClaudeOnce(
  endpoint: string,
  apiKey: string,
  model: string,
  mediaType: string,
  base64: string,
  prompt: string,
): Promise<{ text: string; model: string }> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    Authorization: `Bearer ${apiKey}`,
  };
  if (/^(1|true)$/i.test(process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC || "")) {
    headers["x-claude-code-disable-nonessential-traffic"] = "1";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.2,
      system: SYSTEM_PROMPT,
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
    }),
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
      raw.slice(0, 300) ||
      res.statusText;
    throw new Error(`Claude API ${res.status} model=${model}: ${msg}`);
  }

  const text = extractTextFromClaudeResponse(data);
  if (!text.trim()) throw new Error(`Empty Claude response model=${model}`);
  return { text, model };
}

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
      const { text, model: used } = await callClaudeOnce(
        endpoint,
        apiKey,
        model,
        mediaType,
        base64,
        prompt,
      );
      console.info(`[claude-vision] success model=${used}`);
      const parsed = extractJson(text) as Record<string, unknown>;
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
      // Auth / rate-limit / payload errors: do not burn through the whole list
      if (!isModelNotFoundError(lastErr.message)) {
        break;
      }
    }
  }

  const detail = errors.join(" || ").slice(0, 500);
  throw lastErr
    ? new Error(`${lastErr.message} [tried: ${detail}]`)
    : new Error(`Claude vision failed: ${detail}`);
}
