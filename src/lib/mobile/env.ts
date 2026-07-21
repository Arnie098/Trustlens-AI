// src/lib/mobile/env.ts
export function getApiBaseUrl(): string {
  const raw = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "";
  return String(raw).replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBaseUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export function isProbablyNativeShell(): boolean {
  if (typeof window === "undefined") return false;
  // Capacitor injects this
  return !!(
    window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
  ).Capacitor?.isNativePlatform?.();
}
