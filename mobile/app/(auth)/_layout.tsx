import { Stack } from "expo-router";
import { colors } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.teal,
        headerTitleStyle: { fontFamily: fonts.display, color: colors.foreground },
        contentStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign in" }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
    </Stack>
  );
}
