import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, Platform, Switch, ScrollView } from "react-native";
import { router } from "expo-router";
import { useSession } from "@/src/features/auth/session";
import { FloatingAssist } from "@/src/features/assist/bridge";
import { Screen, Title, Muted, Card, Button, SectionLabel } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";
import { getApiBaseUrl } from "@/src/lib/api/analyze";
import { getOcrBaseUrl, getOcrSpaceApiKey, hasOcrSpaceDirectKey } from "@/src/lib/config";
import { isOcrSpaceAvailable } from "@/src/lib/ocrspace";

export default function ProfileScreen() {
  const { user, profile, signOut, backendLabel } = useSession();
  const [assistOn, setAssistOn] = useState(false);
  const [assistMsg, setAssistMsg] = useState("");

  useEffect(() => {
    void FloatingAssist.isEnabled().then(setAssistOn);
  }, []);

  async function toggleAssist(next: boolean) {
    const res = await FloatingAssist.setEnabled(next);
    setAssistOn(next && res.ok ? true : next === false ? false : assistOn);
    if (next && res.ok) setAssistOn(true);
    if (!next) setAssistOn(false);
    setAssistMsg(res.message);
    if (!res.ok) Alert.alert("Floating Assist", res.message);
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Account</SectionLabel>
        <Title>Profile</Title>
        <Muted>{user?.email ?? "Not signed in"}</Muted>

        <Card>
          <Text style={styles.rowLabel}>Display name</Text>
          <Text style={styles.rowValue}>{profile?.full_name || profile?.display_name || "—"}</Text>
          <Text style={styles.rowLabel}>AI consent</Text>
          <Text style={styles.rowValue}>{profile?.ai_consent ? "Granted" : "Not granted"}</Text>
        </Card>

        <Card>
          <Text style={styles.h}>Floating Assist</Text>
          <Muted>
            On Facebook: open the floating window → choose{" "}
            <Text style={styles.em}>Analyze content on my screen</Text>. The floating window takes a
            screenshot (Android asks permission first), then AI analyzes it. You do not screenshot
            yourself.
          </Muted>
          <Muted>
            Default is off. After you enable it, look for a teal <Text style={styles.em}>TL</Text>{" "}
            circle on the <Text style={styles.em}>right edge</Text> of the screen (also over Facebook).
            A notification “VeriSphere assist is on” stays in the status bar.
          </Muted>
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Enable floating assist</Text>
            <Switch
              value={assistOn}
              onValueChange={(v) => void toggleAssist(v)}
              trackColor={{ true: colors.teal, false: colors.borderSolid }}
            />
          </View>
          {assistMsg ? <Muted>{assistMsg}</Muted> : null}
          <Muted style={{ marginTop: 6 }}>
            Native bubble:{" "}
            {FloatingAssist.hasNativeModule()
              ? "ready on this build"
              : "not linked — reinstall VeriSphere AI (not Expo Go)"}
          </Muted>
          <View style={{ height: 8 }} />
          <Button
            title="Try assist now"
            variant="secondary"
            onPress={() => router.push("/(app)/assist")}
          />
          <View style={{ height: 8 }} />
          <Button
            title="Hide for 1 hour"
            variant="ghost"
            onPress={async () => {
              await FloatingAssist.hideForHours(1);
              setAssistOn(false);
              setAssistMsg("Hidden for 1 hour.");
            }}
          />
          {Platform.OS === "android" ? (
            <>
              <Button
                title="Allow display over apps"
                variant="ghost"
                onPress={() => void FloatingAssist.openOverlaySettings()}
              />
              <Button
                title="Allow screen capture (once)"
                variant="ghost"
                onPress={() => void FloatingAssist.requestScreenCapturePermission()}
              />
            </>
          ) : null}
          {Platform.OS === "ios" ? (
            <Muted>
              iOS cannot show a bubble over Facebook. Use Share → VeriSphere, or Try assist now after copying
              text.
            </Muted>
          ) : null}
          {Platform.OS === "web" ? (
            <Muted>
              Web demo: after enabling, use the floating TL button (bottom-right). Over-Facebook bubble needs
              Android native build.
            </Muted>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.h}>Shortcuts</Text>
          <Button title="Achievements" variant="secondary" onPress={() => router.push("/(app)/(tabs)/achievements")} />
          <View style={{ height: 8 }} />
          <Button title="Learn" variant="secondary" onPress={() => router.push("/(app)/(tabs)/learn")} />
        </Card>

        <Card>
          <Text style={styles.h}>Configuration</Text>
          <Text style={styles.mono}>{backendLabel}</Text>
          <Text style={styles.mono}>Analyze API: {getApiBaseUrl() || "(not set)"}</Text>
          <Text style={styles.mono}>
            OCR.space:{" "}
            {isOcrSpaceAvailable()
              ? hasOcrSpaceDirectKey()
                ? "direct key set (demo)"
                : `via API ${getApiBaseUrl()}/api/ocr`
              : "(not set — server OCR_SPACE_API_KEY + API base URL)"}
          </Text>
          <Text style={styles.mono}>
            UNESCO OCR: {getOcrBaseUrl() || "(optional local Tesseract)"}
          </Text>
          {hasOcrSpaceDirectKey() && getOcrSpaceApiKey() ? (
            <Text style={styles.mono}>OCR.space key: set in env (not shown)</Text>
          ) : null}
          <Text style={styles.mono}>
            Native capture:{" "}
            {FloatingAssist.hasNativeModule()
              ? "YES — VeriSphere AI app (screenshot works)"
              : "NO — you are in Expo Go. Run: npm run android"}
          </Text>
        </Card>

        <Button
          title="Sign out"
          variant="secondary"
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/login");
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 120, gap: 12, paddingTop: 8 },
  h: { fontSize: 16, fontWeight: "700", color: colors.foreground, marginBottom: 8 },
  em: { fontWeight: "700", color: colors.foreground },
  rowLabel: { fontSize: 12, color: colors.muted, marginTop: 6 },
  rowValue: { fontSize: 15, color: colors.foreground, fontWeight: "600" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 12,
  },
  switchLabel: { fontSize: 15, fontWeight: "600", color: colors.foreground, flex: 1 },
  mono: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 4,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
});
