import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useSession } from "@/src/features/auth/session";
import { colors } from "@/src/theme/colors";

export default function AppLayout() {
  const { user, loading, configured } = useSession();

  // Wait for session restore before deciding auth redirect (fixes flash / empty screens)
  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={colors.teal} />
      </View>
    );
  }

  if (configured && !user) return <Redirect href="/(auth)/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.teal,
        headerTitleStyle: { fontWeight: "600", color: colors.foreground },
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="assist"
        options={{
          headerShown: false,
          presentation: "transparentModal",
          animation: "fade",
        }}
      />
      <Stack.Screen name="verify/[id]" options={{ title: "Result" }} />
      <Stack.Screen name="learn/[slug]" options={{ title: "Course" }} />
      <Stack.Screen name="quiz/[moduleId]" options={{ title: "Quiz" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
