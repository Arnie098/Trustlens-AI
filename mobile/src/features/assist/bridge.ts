import { Platform, Linking } from "react-native";
import * as SecureStore from "expo-secure-store";
import FloatingAssistNative, { isNativeLinked } from "trustlens-floating-assist";
import { getApiBaseUrl } from "@/src/lib/config";

const KEY = "trustlens.floating_assist.enabled";
const HIDE_UNTIL = "trustlens.floating_assist.hide_until";

const store = {
  async getItem(k: string) {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      return localStorage.getItem(k);
    }
    try {
      return await SecureStore.getItemAsync(k);
    } catch {
      return null;
    }
  },
  async setItem(k: string, v: string) {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.setItem(k, v);
      return;
    }
    try {
      await SecureStore.setItemAsync(k, v);
    } catch {
      /* ignore */
    }
  },
  async removeItem(k: string) {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") {
      localStorage.removeItem(k);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(k);
    } catch {
      /* ignore */
    }
  },
};

/**
 * Floating Assist:
 * Open bubble → "Analyze content on my screen" → app screenshots → AI analyzes.
 * Requires a native Android build (Expo Go cannot capture other apps).
 */
export const FloatingAssist = {
  isSupported(): boolean {
    return Platform.OS === "android" || Platform.OS === "web";
  },

  /** True only inside a native VeriSphere install (not Expo Go). */
  hasNativeModule(): boolean {
    return Platform.OS === "android" && isNativeLinked();
  },

  async isEnabled(): Promise<boolean> {
    if (!this.isSupported()) return false;
    const hideUntil = await store.getItem(HIDE_UNTIL);
    if (hideUntil && Date.now() < Number(hideUntil)) return false;
    return (await store.getItem(KEY)) === "1";
  },

  async setEnabled(enabled: boolean): Promise<{ ok: boolean; message: string }> {
    if (!this.isSupported()) {
      return {
        ok: false,
        message: "Floating Assist is available on Android (and as an in-app demo on web).",
      };
    }

    await store.setItem(KEY, enabled ? "1" : "0");
    if (!enabled) {
      await store.removeItem(HIDE_UNTIL);
      try {
        await FloatingAssistNative.stopBubble();
      } catch {
        /* ignore */
      }
      return { ok: true, message: "Floating Assist turned off." };
    }

    if (this.hasNativeModule()) {
      try {
        // Keep native analyze URL in sync with JS env
        try {
          const base = getApiBaseUrl();
          if (base && (FloatingAssistNative as { setApiBaseUrl?: (u: string) => Promise<unknown> }).setApiBaseUrl) {
            await (FloatingAssistNative as { setApiBaseUrl: (u: string) => Promise<unknown> }).setApiBaseUrl(base);
          }
        } catch {
          /* optional */
        }
        const hasPerm = await FloatingAssistNative.hasOverlayPermission();
        if (!hasPerm) {
          await FloatingAssistNative.requestOverlayPermission();
          return {
            ok: true,
            message:
              "Allow “Display over other apps” for VeriSphere, then turn Assist on again so the bubble can appear over Facebook.",
          };
        }
        await FloatingAssistNative.startBubble();
        // Do NOT request MediaProjection here — that opens an invisible host activity
        // and can look like a stuck splash on cold start. Permission is requested
        // only when the user taps "Analyze content on my screen".
        return {
          ok: true,
          message:
            "Bubble is on. On Facebook: tap TL → Analyze content on my screen (Android will ask to allow capture once). Results appear as a floating card.",
        };
      } catch (e) {
        return {
          ok: false,
          message: e instanceof Error ? e.message : "Could not start floating bubble.",
        };
      }
    }

    // Expo Go / no native module
    return {
      ok: true,
      message:
        Platform.OS === "web"
          ? "Demo mode: TL button bottom-right. Real screen capture needs the Android app."
          : "You are in Expo Go. Screen capture over Facebook needs the real VeriSphere app.\n\nOn your PC, USB-connect the phone, then in the mobile folder run:\n\nnpm run android\n\nThat installs VeriSphere AI. Open that app (not Expo Go), enable Assist, then use the bubble.",
    };
  },

  async hideForHours(hours: number): Promise<void> {
    const until = String(Date.now() + hours * 3600_000);
    await store.setItem(HIDE_UNTIL, until);
    try {
      await FloatingAssistNative.stopBubble();
    } catch {
      /* ignore */
    }
  },

  async openOverlaySettings(): Promise<void> {
    try {
      await FloatingAssistNative.requestOverlayPermission();
      return;
    } catch {
      /* fall through */
    }
    try {
      await Linking.openSettings();
    } catch {
      /* ignore */
    }
  },

  async requestScreenCapturePermission(): Promise<void> {
    await FloatingAssistNative.requestScreenCapturePermission();
  },

  async captureScreen(): Promise<void> {
    await FloatingAssistNative.captureScreen();
  },

  assistUrl(action?: "menu" | "clipboard" | "capture" | "screenshot"): string {
    if (!action || action === "menu") return "trustlens://assist";
    return `trustlens://assist?action=${action}`;
  },
};
