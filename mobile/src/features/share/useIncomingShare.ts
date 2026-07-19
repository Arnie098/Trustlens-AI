import { useEffect } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";

/**
 * Deep links + share:
 *   trustlens://assist
 *   trustlens://assist?action=clipboard|capture|screenshot
 *   trustlens://assist?action=capture&path=/data/.../capture.jpg
 *   trustlens://verify?tab=scan&prefill=...
 */
export function useIncomingShare(enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    function handleUrl(url: string | null, opts?: { fromColdStart?: boolean }) {
      if (!url) return;
      const parsed = Linking.parse(url);
      const path = (parsed.path || "").replace(/^\//, "");
      const host = parsed.hostname || "";
      const q = parsed.queryParams || {};

      // Floating Assist popup (path = native screen-capture file)
      if (path.startsWith("assist") || host === "assist") {
        const action = q.action ? String(q.action) : "menu";
        const capturePath = q.path ? String(q.path) : undefined;
        // Cold-start getInitialURL often returns a stale capture deep link and
        // immediately opens MediaProjection (looks like a stuck splash).
        // Only auto-open bare capture from live URL events (bubble tap).
        if (
          opts?.fromColdStart &&
          (action === "capture" || action === "screenshot") &&
          !capturePath
        ) {
          return;
        }
        router.push({
          pathname: "/(app)/assist",
          params: capturePath ? { action, path: capturePath } : { action },
        });
        return;
      }

      if (path.startsWith("verify") || host === "verify") {
        const tab = String(q.tab || "url");
        const prefill = q.prefill ? String(q.prefill) : undefined;
        router.push({
          pathname: "/(app)/(tabs)/verify",
          params: prefill ? { tab, prefill } : { tab },
        });
        return;
      }

      if (q.text || q.url) {
        const raw = String(q.text || q.url);
        const tab = /^https?:\/\//i.test(raw) ? "url" : "text";
        router.push({
          pathname: "/(app)/(tabs)/verify",
          params: { tab, prefill: raw },
        });
      }
    }

    void Linking.getInitialURL().then((url) => handleUrl(url, { fromColdStart: true }));
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [enabled]);
}
