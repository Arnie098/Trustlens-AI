/** Helpers for turning mixed evidence strings (prose + Citation: URLs) into UI-friendly items. */

import { looksLikeAnalysisJsonBlob, sanitizeDisplayList, sanitizeListItem } from "@/lib/ai/sanitize-text";

export type EvidenceProse = { kind: "prose"; text: string };
export type EvidenceSource = {
  kind: "source";
  url: string;
  label: string;
  hostname: string;
};
export type EvidenceItem = EvidenceProse | EvidenceSource;

const CITATION_PREFIX = /^(citation|source|url)\s*:\s*/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|avif|bmp|ico)(\?|$)/i;
const JUNK_HOST =
  /(?:cloudfront\.net|cloudflare|perplexity\.ai|googleapis\.com|gstatic\.com|gravatar\.com)/i;

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

function isUsefulSourceUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    if (IMAGE_EXT.test(u.pathname)) return false;
    if (JUNK_HOST.test(u.hostname)) return false;
    // Tiny path-only blobs are usually assets
    if (u.pathname.length > 2 && IMAGE_EXT.test(url)) return false;
    return true;
  } catch {
    return false;
  }
}

function sourceLabel(url: string): { label: string; hostname: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    const shortPath =
      path.length > 48 ? `${path.slice(0, 28)}…${path.slice(-12)}` : path;
    return {
      hostname: host,
      label: shortPath ? `${host}${shortPath}` : host,
    };
  } catch {
    return { hostname: url, label: url };
  }
}

/** Extract a URL from "Citation: https://…" or a bare URL string. */
export function extractUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const stripped = t.replace(CITATION_PREFIX, "").trim();
  if (looksLikeUrl(stripped)) return stripped;
  const m = t.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0] : null;
}

/**
 * Split mixed evidence arrays into prose bullets and deduped source links.
 * Filters image CDNs and other non-citable asset URLs.
 */
export function parseEvidenceItems(items: unknown): {
  prose: EvidenceProse[];
  sources: EvidenceSource[];
} {
  const prose: EvidenceProse[] = [];
  const sources: EvidenceSource[] = [];
  const seen = new Set<string>();

  // Normalize weird shapes (stringified JSON arrays, objects, analysis blobs)
  const list = sanitizeDisplayList(items);

  for (const raw of list) {
    if (!raw?.trim()) continue;
    if (looksLikeAnalysisJsonBlob(raw)) continue;
    const cleaned = sanitizeListItem(raw);
    if (!cleaned) continue;
    const url = extractUrl(cleaned);
    const isCitationLine =
      CITATION_PREFIX.test(cleaned.trim()) || (url && cleaned.trim() === url);

    if (url && (isCitationLine || looksLikeUrl(cleaned.trim()))) {
      if (!isUsefulSourceUrl(url)) continue;
      const key = url.replace(/\/$/, "").toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const { label, hostname } = sourceLabel(url);
      sources.push({ kind: "source", url, label, hostname });
      continue;
    }

    // Prose that happens to mention a URL — keep prose, also surface URL if useful
    if (url && isUsefulSourceUrl(url)) {
      const key = url.replace(/\/$/, "").toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const { label, hostname } = sourceLabel(url);
        sources.push({ kind: "source", url, label, hostname });
      }
      const withoutUrl = cleaned.replace(url, "").replace(CITATION_PREFIX, "").trim();
      if (withoutUrl.length > 12) {
        prose.push({ kind: "prose", text: withoutUrl });
      }
      continue;
    }

    prose.push({ kind: "prose", text: cleaned });
  }

  return { prose, sources };
}

/** Prefer high-quality citation URLs when merging analysis results. */
export function filterCitationUrls(urls: string[], limit = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of urls) {
    if (!c || !isUsefulSourceUrl(c)) continue;
    const key = c.replace(/\/$/, "").toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= limit) break;
  }
  return out;
}
