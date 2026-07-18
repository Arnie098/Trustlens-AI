/**
 * Analysis models sometimes dump whole JSON blobs (or stringified arrays)
 * into prose / list fields. These helpers unwrap that for display and storage.
 */

const PROSE_KEYS = [
  "context_analysis",
  "source_assessment",
  "summary",
  "assessment",
  "analysis",
  "text",
  "content",
  "message",
  "description",
  "reason",
  "detail",
] as const;

function looksLikeJsonObject(s: string): boolean {
  const t = s.trim();
  return t.startsWith("{") && t.includes("}");
}

function looksLikeJsonArray(s: string): boolean {
  const t = s.trim();
  return t.startsWith("[") && t.includes("]");
}

/** True if this is likely a full analysis payload, not user-facing prose. */
export function looksLikeAnalysisJsonBlob(s: string): boolean {
  const t = s.trim();
  if (!looksLikeJsonObject(t)) return false;
  return (
    /"trust_score"\s*:/.test(t) ||
    /"context_analysis"\s*:/.test(t) ||
    /"source_assessment"\s*:/.test(t) ||
    (/\"category\"\s*:/.test(t) && /\"summary\"\s*:/.test(t))
  );
}

function tryParseJson(s: string): unknown | null {
  const t = s.trim();
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const startObj = t.indexOf("{");
  const endObj = t.lastIndexOf("}");
  if (startObj >= 0 && endObj > startObj) {
    try {
      return JSON.parse(t.slice(startObj, endObj + 1));
    } catch {
      /* ignore */
    }
  }
  const startArr = t.indexOf("[");
  const endArr = t.lastIndexOf("]");
  if (startArr >= 0 && endArr > startArr) {
    try {
      return JSON.parse(t.slice(startArr, endArr + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * If `value` is a stringified analysis object, pull a human prose field out.
 * @param preferredKey field to prefer when unwrapping (e.g. "context_analysis")
 */
export function sanitizeAnalysisProse(
  value: string | null | undefined,
  preferredKey?: string,
): string {
  if (value == null) return "";
  let text = String(value).trim();
  if (!text) return "";

  // Unwrap up to 3 levels of stringified JSON
  for (let i = 0; i < 3; i++) {
    if (!looksLikeJsonObject(text)) break;
    const parsed = tryParseJson(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) break;

    const obj = parsed as Record<string, unknown>;
    const keys = preferredKey
      ? [preferredKey, ...PROSE_KEYS.filter((k) => k !== preferredKey)]
      : [...PROSE_KEYS];

    let next: string | null = null;
    for (const k of keys) {
      const v = obj[k];
      if (typeof v === "string" && v.trim() && !looksLikeAnalysisJsonBlob(v.trim())) {
        next = v.trim();
        break;
      }
    }
    if (!next) {
      for (const v of Object.values(obj)) {
        if (typeof v === "string" && looksLikeJsonObject(v)) {
          next = v.trim();
          break;
        }
      }
    }
    if (!next) {
      for (const v of Object.values(obj)) {
        if (typeof v === "string" && v.trim().length > 20 && !looksLikeJsonObject(v)) {
          next = v.trim();
          break;
        }
      }
    }
    if (!next) break;
    text = next;
  }

  // Still a raw analysis blob? Refuse to render it.
  if (looksLikeAnalysisJsonBlob(text)) {
    const parsed = tryParseJson(text) as Record<string, unknown> | null;
    if (parsed && typeof parsed === "object") {
      const preferred =
        (preferredKey && typeof parsed[preferredKey] === "string"
          ? (parsed[preferredKey] as string)
          : null) ||
        (typeof parsed.context_analysis === "string" ? parsed.context_analysis : null) ||
        (typeof parsed.summary === "string" ? parsed.summary : null);
      if (preferred && !looksLikeAnalysisJsonBlob(preferred)) return preferred.trim();
    }
    return preferredKey === "summary"
      ? "Automated analysis completed. Review concerns and evidence below, and verify with independent sources."
      : "Details were incomplete in this analysis field. Review the summary, concerns, and evidence, or re-run verification.";
  }

  return text;
}

/** Coerce array-ish values that models sometimes stringify. */
export function sanitizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .flatMap((x) => {
        if (typeof x === "string") return [x.trim()];
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          for (const k of ["text", "message", "label", "item", "value", "description"]) {
            if (typeof o[k] === "string" && (o[k] as string).trim()) {
              return [(o[k] as string).trim()];
            }
          }
        }
        const s = String(x).trim();
        return s && s !== "[object Object]" ? [s] : [];
      })
      .filter(Boolean)
      .slice(0, 12);
  }
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return [];
    if (looksLikeJsonArray(t) || looksLikeJsonObject(t)) {
      const parsed = tryParseJson(t);
      if (Array.isArray(parsed)) return sanitizeStringList(parsed);
      if (parsed && typeof parsed === "object") {
        // Single object mistaken for a list item
        const prose = sanitizeAnalysisProse(t);
        return prose ? [prose] : [];
      }
    }
    return [t];
  }
  return [];
}

/**
 * Sanitize one list bullet (concern / next step / evidence line).
 * Drops full analysis JSON dumps; unwraps object-shaped strings.
 */
export function sanitizeListItem(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const o = value as Record<string, unknown>;
    for (const k of ["text", "message", "label", "item", "description", "reason"]) {
      if (typeof o[k] === "string" && (o[k] as string).trim()) {
        return sanitizeListItem(o[k]);
      }
    }
    return null;
  }

  let s = String(value).trim();
  if (!s || s === "[object Object]") return null;

  // Full analysis blob as a list item — skip (belongs in structured fields)
  if (looksLikeAnalysisJsonBlob(s)) return null;

  if (looksLikeJsonObject(s)) {
    const prose = sanitizeAnalysisProse(s);
    if (!prose || looksLikeAnalysisJsonBlob(prose)) return null;
    s = prose;
  }

  // Strip accidental "Citation: " noise is handled in evidence.ts for sources
  if (s.length > 800) s = s.slice(0, 800).trim() + "…";
  return s;
}

/** Sanitize concerns / next_steps / evidence arrays for UI. */
export function sanitizeDisplayList(value: unknown): string[] {
  const raw = sanitizeStringList(value);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const clean = sanitizeListItem(item);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out.slice(0, 10);
}

/** Sanitize a whole analysis-like record for display (results page, hero demo). */
export function sanitizeAnalysisForDisplay<T extends Record<string, unknown>>(data: T): T {
  const next = { ...data } as Record<string, unknown>;

  if ("summary" in next) {
    next.summary = sanitizeAnalysisProse(String(next.summary ?? ""), "summary");
  }
  if ("source_assessment" in next) {
    next.source_assessment = sanitizeAnalysisProse(
      String(next.source_assessment ?? ""),
      "source_assessment",
    );
  }
  if ("context_analysis" in next) {
    next.context_analysis = sanitizeAnalysisProse(
      String(next.context_analysis ?? ""),
      "context_analysis",
    );
  }
  if ("concerns" in next) {
    next.concerns = sanitizeDisplayList(next.concerns);
  }
  if ("evidence" in next) {
    next.evidence = sanitizeDisplayList(next.evidence);
  }
  if ("next_steps" in next) {
    next.next_steps = sanitizeDisplayList(next.next_steps);
  }

  return next as T;
}
