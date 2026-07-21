/** Normalize user-entered URLs for analysis (trim, add https if missing). */
export function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname || !u.hostname.includes(".")) {
      // Allow localhost for dev APIs / local pages
      if (u.hostname !== "localhost" && u.hostname !== "127.0.0.1") return null;
    }
    return u.toString();
  } catch {
    return null;
  }
}
