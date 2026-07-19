/**
 * Claude (Anthropic) vision — used ONLY for mobile screenshot / imageUrl analysis
 * when PERPLEXITY_API_KEY is not set.
 *
 * Flow:
 *   phone → POST /api/uploads → public URL
 *   → POST /api/analyze { type:image, imageUrl }
 *   → server loads bytes → Anthropic messages API with image payload
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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function hasClaudeKey(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.CLAUDE_API_KEY?.trim(),
  );
}

function claudeApiKey(): string {
  return (
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.CLAUDE_API_KEY?.trim() ||
    ""
  );
}

function claudeModel(): string {
  return (
    process.env.CLAUDE_VISION_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
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

  console.info(
    `[claude-vision] model=${claudeModel()} media=${mediaType} b64KB=${Math.round(base64.length / 1024)}`,
  );

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "content-type": "application/json",
    },
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
      `Claude API ${res.status}: ${errText.slice(0, 400) || res.statusText}`,
    );
  }

  const data = (await res.json()) as {
    content?: { type?: string; text?: string }[];
  };
  const textParts = (data.content || [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!)
    .join("\n");
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
