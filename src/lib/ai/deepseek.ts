/**
 * DeepSeek API — free/cheap structured analysis for hackathon.
 * OpenAI-compatible: https://api.deepseek.com
 *
 * No live web search. Use with Perplexity cookie path for grounding.
 */
import type { AnalysisInput, AnalysisResult } from "./types";
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  extractJson,
  normalizeResult,
} from "./perplexity";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

export function hasDeepSeekKey(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

function modelName(): string {
  return process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";
}

/**
 * Full TrustLens-shaped analysis from DeepSeek (reasoning only — no live web).
 * For images without a vision model: uses OCR/caption text + filename.
 */
export async function deepseekAnalyze(input: AnalysisInput): Promise<AnalysisResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set");

  // deepseek-chat is text-only; fold imageUrl out of the multimodal path.
  const textInput: AnalysisInput =
    input.type === "image"
      ? {
          type: "text",
          text: [
            `Image submission for media-literacy analysis.`,
            input.imageName ? `Filename: ${input.imageName}` : "",
            input.text?.trim()
              ? `OCR / caption (may contain errors):\n"""\n${input.text.trim().slice(0, 5000)}\n"""`
              : "No OCR text available — reason about common social-post and screenshot patterns; be explicit about limits.",
          ]
            .filter(Boolean)
            .join("\n\n"),
        }
      : input;

  const userContent = buildUserPrompt(textInput);

  const res = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model: modelName(),
      temperature: 0.2,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            SYSTEM_PROMPT +
            `\n\nYou do NOT have live web search. Reason carefully from the content and general knowledge. Mark sparse corroboration honestly. Prefer concrete concerns over telling the user to research.`,
        },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 400) || res.statusText}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from DeepSeek");

  const parsed = extractJson(content) as Record<string, unknown>;
  return normalizeResult(parsed, input, [], "perplexity");
}

/** Compact brief for Perplexity cookie search (claims only). */
export function formatDraftForPerplexitySearch(
  draft: AnalysisResult,
  input: AnalysisInput,
): string {
  const original =
    input.type === "url" && input.url
      ? `Original URL: ${input.url}`
      : input.type === "text" && input.text
        ? `Original text:\n${input.text.slice(0, 2000)}`
        : `Image: ${input.imageName || "upload"}\nOCR/caption:\n${(input.text || "").slice(0, 2000)}`;

  const claims = [
    draft.summary,
    ...draft.concerns.slice(0, 4),
    ...draft.evidence.slice(0, 3),
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  return `TrustLens free pipeline — DeepSeek already drafted a first-pass analysis.
YOUR JOB: use live web search to corroborate or refute the claims. Return the final TrustLens JSON with concrete evidence (outlet + URL when possible). Never tell the user to search or verify themselves.

${original}

DeepSeek first-pass claims / notes:
${claims.map((c, i) => `${i + 1}. ${c}`).join("\n")}

source_assessment (draft): ${draft.source_assessment}
context_analysis (draft): ${draft.context_analysis}
provisional score: ${draft.trust_score} / ${draft.category}
`;
}
