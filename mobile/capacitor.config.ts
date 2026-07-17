import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ai.trustlens.app",
  appName: "TrustLensAI",
  webDir: "www",
  server: {
    // Production: load the bundled www/ assets over the https scheme so that
    // relative auth/redirect origins behave consistently. The remote analyze
    // API is reached via an absolute VITE_API_BASE_URL (see src/lib/mobile/env.ts).
    // For live-reload development only, temporarily set `url` to your LAN dev server.
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0c2340",
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0c2340",
    },
  },
};

export default config;
