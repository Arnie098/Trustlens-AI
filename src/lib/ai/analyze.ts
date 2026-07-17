/**
 * Client-safe analyze entrypoint.
 * Calls POST /api/analyze (server holds PERPLEXITY_API_KEY).
 */
import type { AnalysisInput, AnalysisResult } from "./types";
import { apiUrl } from "@/lib/mobile/env";

export type { AnalysisInput, AnalysisResult } from "./types";
export { trustLabel, trustColorVar, categoryFor } from "./types";

export async function analyzeContent(input: AnalysisInput): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(apiUrl("/api/analyze"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    let json: { data?: AnalysisResult; error?: { message: string } };
    try {
      json = (await res.json()) as { data?: AnalysisResult; error?: { message: string } };
    } catch {
      throw new Error(`Analysis failed (${res.status}): invalid server response`);
    }

    if (!res.ok || !json.data) {
      throw new Error(json.error?.message || `Analysis failed (${res.status})`);
    }

    return json.data;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error("Analysis timed out. Please try again with a shorter text or different URL.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
