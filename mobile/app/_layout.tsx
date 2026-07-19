import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
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

// Keep native splash until JS is ready (prevents blank frame); we hide immediately on mount.
void SplashScreen.preventAutoHideAsync().catch(() => {});

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

  useEffect(() => {
    // Always dismiss native splash as soon as JS mounts
    void SplashScreen.hideAsync().catch(() => {});
    // Belt-and-suspenders: hide again shortly after (covers race with first paint)
    const t = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {});
    }, 50);
    const t2 = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {});
    }, 1500);
    // Sync analyze API for native overlay (Facebook stay-in-app results)
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
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ShareListener />
          <StatusBar style="light" />
          <View style={styles.root}>
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
});
