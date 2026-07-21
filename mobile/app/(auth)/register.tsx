import { useState } from "react";
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Link, router } from "expo-router";
import { useSession } from "@/src/features/auth/session";
import { Button, Input, Label, Screen, Title, Muted, Card } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";

export default function RegisterScreen() {
  const { signUp, configured, backendLabel } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    if (!configured) {
      Alert.alert("Backend not configured", "Set mobile/.env and start the web API if using local mode.");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Missing email", "Enter an email address.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Invalid", "Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, fullName.trim() || undefined);
      // Session is set inside signUp when confirmation is off; app layout redirects if not.
      router.replace("/(app)/(tabs)");
    } catch (e) {
      Alert.alert("Sign up failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title>Create account</Title>
          <Muted>Backend: {backendLabel}</Muted>
          <Card>
            <View style={styles.field}>
              <Label>Name</Label>
              <Input value={fullName} onChangeText={setFullName} placeholder="Optional" />
            </View>
            <View style={styles.field}>
              <Label>Email</Label>
              <Input autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            </View>
            <View style={styles.field}>
              <Label>Password</Label>
              <Input secureTextEntry value={password} onChangeText={setPassword} />
            </View>
            <Button title="Create account" onPress={onSubmit} loading={loading} />
          </Card>
          <Link href="/(auth)/login" style={styles.link}>
            Back to sign in
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 12, paddingBottom: 40 },
  field: { marginBottom: 14 },
  link: { color: colors.teal, fontWeight: "700" },
});
