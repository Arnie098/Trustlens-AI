import { Platform } from "react-native";

type FloatingAssistNative = {
  isAvailable(): Promise<boolean>;
  hasOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  hasScreenCapturePermission(): Promise<boolean>;
  requestScreenCapturePermission(): Promise<boolean>;
  captureScreen(): Promise<boolean>;
  getLastCapturePath(): Promise<string | null>;
  startBubble(): Promise<void>;
  stopBubble(): Promise<void>;
};

function loadNative(): FloatingAssistNative | null {
  if (Platform.OS !== "android") return null;
  try {
    // Expo Modules API (dev / production build only — not Expo Go)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo-modules-core");
    return requireNativeModule("TrustLensFloatingAssist") as FloatingAssistNative;
  } catch {
    try {
      // Fallback for older bridge registration
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeModules } = require("react-native");
      return (NativeModules.TrustLensFloatingAssist as FloatingAssistNative) ?? null;
    } catch {
      return null;
    }
  }
}

const Native = loadNative();

export function isNativeLinked(): boolean {
  return !!Native?.startBubble && !!Native?.captureScreen;
}

export default {
  async isAvailable(): Promise<boolean> {
    if (!Native?.isAvailable) return false;
    return Native.isAvailable();
  },
  async hasOverlayPermission(): Promise<boolean> {
    if (!Native?.hasOverlayPermission) return false;
    return Native.hasOverlayPermission();
  },
  async requestOverlayPermission(): Promise<boolean> {
    if (!Native?.requestOverlayPermission) return false;
    return Native.requestOverlayPermission();
  },
  async hasScreenCapturePermission(): Promise<boolean> {
    if (!Native?.hasScreenCapturePermission) return false;
    return Native.hasScreenCapturePermission();
  },
  async requestScreenCapturePermission(): Promise<boolean> {
    if (!Native?.requestScreenCapturePermission) return false;
    return Native.requestScreenCapturePermission();
  },
  async captureScreen(): Promise<boolean> {
    if (!Native?.captureScreen) {
      throw new Error(
        "Screen capture is not available in Expo Go. Install the VeriSphere Android app: in the mobile folder run  npm run android",
      );
    }
    return Native.captureScreen();
  },
  async getLastCapturePath(): Promise<string | null> {
    if (!Native?.getLastCapturePath) return null;
    return Native.getLastCapturePath();
  },
  /** Push API base URL into native prefs so overlay analysis uses the same server. */
  async setApiBaseUrl(url: string): Promise<void> {
    // Optional native method — ignore if not linked yet
    const anyNative = Native as { setApiBaseUrl?: (u: string) => Promise<void> } | null;
    if (anyNative?.setApiBaseUrl) {
      await anyNative.setApiBaseUrl(url);
    }
  },
  async startBubble(): Promise<void> {
    if (!Native?.startBubble) {
      throw new Error(
        "Floating bubble needs the VeriSphere Android app (not Expo Go). Run: npm run android",
      );
    }
    return Native.startBubble();
  },
  async stopBubble(): Promise<void> {
    if (!Native?.stopBubble) return;
    return Native.stopBubble();
  },
};
