import type { AnalysisInput, AnalysisResult } from "../types/analysis";
import { getApiBaseUrl } from "../config";

export { getApiBaseUrl } from "../config";

export async function analyzeContent(input: AnalysisInput): Promise<AnalysisResult> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error(
      "Missing EXPO_PUBLIC_API_BASE_URL. Start the web app (e.g. http://localhost:3000) and set this env.",
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    let json: { data?: AnalysisResult; error?: { message: string } };
    try {
      json = (await res.json()) as { data?: AnalysisResult; error?: { message: string } };
    } catch {
      throw new Error(
        `Analysis failed (${res.status}): invalid server response. Is the web API running at ${base}?`,
      );
    }

    if (!res.ok || !json.data) {
      throw new Error(json.error?.message || `Analysis failed (${res.status})`);
    }

    return json.data;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Analysis timed out. Try shorter text or another URL.");
    }
    // RN fetch failures are often TypeError("Network request failed")
    const msg = e instanceof Error ? e.message : String(e);
    if (
      e instanceof TypeError ||
      /network request failed|failed to fetch|networkerror/i.test(msg)
    ) {
      throw new Error(
        `Cannot reach analyze API at ${base}. ` +
          `Check that your phone has internet and the server is up. ` +
          `(Original: ${msg})`,
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
