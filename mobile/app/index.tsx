import { useEffect } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet, Text } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "@/src/features/auth/session";
import { colors } from "@/src/theme/colors";

export default function Index() {
  const { user, loading, configured } = useSession();

  // Keep dismissing splash while auth resolves (same navy as splash confused users).
  useEffect(() => {
    void SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) {
    return (
      <View style={styles.center} onLayout={() => void SplashScreen.hideAsync().catch(() => {})}>
        <Text style={styles.brand}>VeriSphere AI</Text>
        <ActivityIndicator size="large" color={colors.teal} style={styles.spin} />
        <Text style={styles.hint}>Starting…</Text>
        <Text style={styles.sub}>
          {configured ? "Restoring session" : "Checking configuration"}
        </Text>
      </View>
    );
  }
  if (!configured || !user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(app)/(tabs)" />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 24,
  },
  brand: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 20,
  },
  spin: { marginBottom: 14 },
  hint: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "600",
  },
  sub: {
    marginTop: 8,
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
  },
});
