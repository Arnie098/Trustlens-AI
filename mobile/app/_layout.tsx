import { useCallback, useEffect } from "react";
import { View, StyleSheet, Text } from "react-native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import {
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import { useFonts } from "expo-font";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "@/src/features/auth/session";
import { useIncomingShare } from "@/src/features/share/useIncomingShare";
import { FloatingAssist } from "@/src/features/assist/bridge";
import { getApiBaseUrl } from "@/src/lib/config";
import FloatingAssistNative from "trustlens-floating-assist";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";

export { ErrorBoundary } from "expo-router";

const queryClient = new QueryClient();

// Keep system splash until we explicitly hide it (then hide aggressively).
void SplashScreen.preventAutoHideAsync().catch(() => {});

function hideSplashNow(reason: string) {
  void SplashScreen.hideAsync()
    .then(() => {
      if (__DEV__) console.log("[splash] hidden:", reason);
    })
    .catch((e) => {
      if (__DEV__) console.warn("[splash] hide failed:", reason, e);
    });
}

function ShareListener() {
  const { user } = useSession();
  useIncomingShare(!!user);
  return null;
}

export default function RootLayout() {
  // Fonts optional — never block UI on them
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold: DMSans_700Bold,
    DMSans_700Bold,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  });

  const onRootLayout = useCallback(() => {
    // First real layout is the most reliable moment on OEM skins (Tecno/Transsion).
    hideSplashNow("root-layout");
  }, []);

  useEffect(() => {
    hideSplashNow("mount");
    const timers = [50, 200, 500, 1200, 2500, 5000].map((ms) =>
      setTimeout(() => hideSplashNow(`timer-${ms}`), ms),
    );
    try {
      const base = getApiBaseUrl();
      if (base && FloatingAssist.hasNativeModule()) {
        const native = FloatingAssistNative as {
          setApiBaseUrl?: (u: string) => Promise<unknown>;
        };
        void native.setApiBaseUrl?.(base).catch(() => {});
      }
    } catch {
      /* ignore */
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ShareListener />
          <StatusBar style="light" />
          <View style={styles.root} onLayout={onRootLayout}>
            {/* Visible boot chrome — navy alone looks like a stuck system splash */}
            <View style={styles.bootBadge} pointerEvents="none">
              <Text style={styles.bootBadgeText}>VeriSphere AI</Text>
            </View>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.teal,
                headerTitleStyle: {
                  fontFamily: fontsLoaded ? fonts.display : undefined,
                  color: colors.foreground,
                },
                contentStyle: { backgroundColor: colors.background },
                headerShadowVisible: false,
              }}
            >
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(app)" options={{ headerShown: false }} />
            </Stack>
          </View>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  bootBadge: {
    position: "absolute",
    top: 48,
    alignSelf: "center",
    zIndex: 0,
    opacity: 0.35,
  },
  bootBadgeText: {
    color: colors.teal,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
  },
});
