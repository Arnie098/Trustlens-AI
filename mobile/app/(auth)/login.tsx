import { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Link, router } from "expo-router";
import { useSession } from "@/src/features/auth/session";
import { Button, Input, Label, Screen, Title, Muted, Card } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";

const DEMO_PASSWORD = "demo-trustlens-2026";
const DEMO_ACCOUNTS = {
  user: { email: "learner@trustlensai.app", fullName: "Demo Learner" },
  admin: { email: "admin@trustlensai.app", fullName: "Platform Admin" },
} as const;

export default function LoginScreen() {
  const { signIn, signUp, configured, backendLabel } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<null | "user" | "admin">(null);

  async function onSubmit() {
    if (!configured) {
      Alert.alert(
        "Supabase not configured",
        "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env",
      );
      return;
    }
    if (!email.trim() || !password) {
      Alert.alert("Missing fields", "Enter email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(app)/(tabs)");
    } catch (e) {
      Alert.alert(
        "Sign in failed",
        e instanceof Error
          ? `${e.message}\n\nCreate an account in the app, or add this user in the Supabase Auth dashboard.`
          : "Unknown error",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onDemo(kind: "user" | "admin") {
    if (!configured) {
      Alert.alert(
        "Supabase not configured",
        "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env",
      );
      return;
    }
    const account = DEMO_ACCOUNTS[kind];
    setDemoLoading(kind);
    try {
      try {
        await signIn(account.email, DEMO_PASSWORD);
      } catch {
        // Demo account may not exist on this backend yet — create then retry.
        await signUp(account.email, DEMO_PASSWORD, account.fullName);
        await signIn(account.email, DEMO_PASSWORD);
      }
      router.replace("/(app)/(tabs)");
    } catch (e) {
      Alert.alert(
        "Demo sign in failed",
        e instanceof Error
          ? `${e.message}\n\nThe demo account may need email confirmation disabled in Supabase Auth settings.`
          : "Unknown error",
      );
    } finally {
      setDemoLoading(null);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image
            source={require("@/assets/images/brand-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.eyebrow}>VERISPHERE AI</Text>
          <Title>Think before you trust.</Title>
          <Muted>Sign in with your Supabase account (same as the web app when using cloud).</Muted>
          <Text style={styles.backend}>{backendLabel}</Text>

          {!configured ? (
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                Missing Supabase env. In mobile/.env set:{"\n"}
                EXPO_PUBLIC_SUPABASE_URL={"\n"}
                EXPO_PUBLIC_SUPABASE_ANON_KEY={"\n"}
                EXPO_PUBLIC_API_BASE_URL= (for /api/analyze)
              </Text>
            </View>
          ) : null}

          <Card>
            <View style={styles.field}>
              <Label>Email</Label>
              <Input
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
              />
            </View>
            <View style={styles.field}>
              <Label>Password</Label>
              <Input
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
              />
            </View>
            <Button title="Sign in" onPress={onSubmit} loading={loading} />
          </Card>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>DEMO</Text>
            <View style={styles.divider} />
          </View>
          <View style={styles.demoRow}>
            <View style={styles.demoCol}>
              <Button
                title="User Demo"
                variant="secondary"
                onPress={() => onDemo("user")}
                loading={demoLoading === "user"}
                disabled={demoLoading !== null}
              />
            </View>
            <View style={styles.demoCol}>
              <Button
                title="Admin Demo"
                onPress={() => onDemo("admin")}
                loading={demoLoading === "admin"}
                disabled={demoLoading !== null}
              />
            </View>
          </View>

          <Link href="/(auth)/register" style={styles.link}>
            Create account
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingTop: 12, paddingBottom: 40 },
  logo: { width: 72, height: 72, marginBottom: 12 },
  eyebrow: { fontSize: 11, letterSpacing: 2, color: colors.teal, fontWeight: "700" },
  backend: { fontSize: 12, color: colors.muted },
  field: { marginBottom: 14 },
  link: { color: colors.teal, fontWeight: "700" },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  divider: { flex: 1, height: 1, backgroundColor: colors.borderSolid },
  dividerText: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: colors.muted },
  demoRow: { flexDirection: "row", gap: 12 },
  demoCol: { flex: 1 },
  warn: {
    backgroundColor: "rgba(224, 184, 74, 0.12)",
    borderColor: colors.trustMedium,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  warnText: { color: colors.foreground, fontSize: 13, lineHeight: 18 },
});
