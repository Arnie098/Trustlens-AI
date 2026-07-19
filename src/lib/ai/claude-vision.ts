/**
 * Claude vision for mobile screenshots only.
 *
 * Compatible with official Anthropic and Anthropic-compatible proxies
 * (e.g. freemodel: ANTHROPIC_BASE_URL=https://cc.freemodel.dev).
 *
 * Flow:
 *   phone → POST /api/uploads → public URL
 *   → POST /api/analyze { type:image, imageUrl }
 *   → server loads bytes → Claude messages API with image payload
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
/** freemodel.dev Anthropic-compatible proxy (hackathon / free tier) */
const DEFAULT_FREEMODEL_BASE = "https://cc.freemodel.dev";

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

/**
 * Base URL without trailing slash.
 * Env: ANTHROPIC_BASE_URL (e.g. https://cc.freemodel.dev)
 * Default: freemodel when ANTHROPIC_USE_FREEMODEL=1, else official Anthropic.
 */
function claudeBaseUrl(): string {
  const explicit = process.env.ANTHROPIC_BASE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;

  const useFree =
    process.env.ANTHROPIC_USE_FREEMODEL?.trim().toLowerCase() === "1" ||
    process.env.ANTHROPIC_USE_FREEMODEL?.trim().toLowerCase() === "true" ||
    process.env.ANTHROPIC_USE_FREEMODEL?.trim().toLowerCase() === "yes";
  return useFree ? DEFAULT_FREEMODEL_BASE : DEFAULT_OFFICIAL_BASE;
}

/** Messages endpoint: {base}/v1/messages (Anthropic-compatible). */
function claudeMessagesUrl(): string {
  const base = claudeBaseUrl();
  if (base.endsWith("/v1/messages")) return base;
  if (base.endsWith("/v1")) return `${base}/messages`;
  return `${base}/v1/messages`;
}

function claudeModel(): string {
  return (
    process.env.CLAUDE_VISION_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    // freemodel often maps short names; sonnet is a safe default
    "claude-sonnet-4-20250514"
  );
}

function parseDataUri(dataUri: string): { mediaType: string; base64: string } {
  const m = dataUri.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error("Invalid vision data URI");
  return { mediaType: m[1], base64: m[2] };
}

/**
 * Analyze a mobile screenshot with Claude vision.
 * Expects input.type === "image" and a public imageUrl from /api/uploads.
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

  console.info(
    `[claude-vision] endpoint=${endpoint} model=${claudeModel()} media=${mediaType} b64KB=${Math.round(base64.length / 1024)}`,
  );

  // Anthropic-compatible headers (works with freemodel + official)
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    // Some proxies also accept Bearer
    Authorization: `Bearer ${apiKey}`,
  };

  // Optional freemodel / Claude Code style flag (harmless if ignored)
  if (
    process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC === "1" ||
    process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC === "true"
  ) {
    headers["x-claude-code-disable-nonessential-traffic"] = "1";
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: claudeModel(),
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
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Claude API ${res.status} (${endpoint}): ${errText.slice(0, 400) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    content?: { type?: string; text?: string }[];
    // OpenAI-compatible proxies sometimes return choices
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
  };

  let textParts = (data.content || [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n");

  // OpenAI-style fallback if freemodel returns choices[].message.content
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

  if (!textParts.trim()) throw new Error("Empty response from Claude vision");

  const parsed = extractJson(textParts) as Record<string, unknown>;
  const result = normalizeResult(parsed, input, []);

  if (
    looksLikeBlindVisionResult(
      result.summary,
      result.source_assessment,
      result.context_analysis,
    )
  ) {
    console.warn("[claude-vision] response looks blind — unexpected for Claude");
  }

  return { ...result, provider: "claude" as AnalysisResult["provider"] };
}
