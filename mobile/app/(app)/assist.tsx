import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "@/src/features/auth/session";
import {
  analyzeClipboardText,
  analyzeFromGallery,
  captureAndAnalyze,
  type AssistStructuredResult,
} from "@/src/features/assist/autoAnalyze";
import { FloatingAssist } from "@/src/features/assist/bridge";
import { StructuredAssistResult } from "@/src/features/assist/StructuredAssistResult";
import { colors } from "@/src/theme/colors";

type Action = "menu" | "clipboard" | "capture" | "screenshot";

/**
 * Floating Assist popup:
 * Primary: "Analyze content on my screen"
 *   → VeriSphere takes a screenshot (user permission) → AI analyzes
 * Secondary: copied text
 */
export default function AssistScreen() {
  const params = useLocalSearchParams<{ action?: string; path?: string }>();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useSession();
  const [phase, setPhase] = useState<"menu" | "working" | "result" | "error">("menu");
  const [result, setResult] = useState<AssistStructuredResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Working…");
  // Prevent re-running the same deep-link action when callbacks change identity
  const lastAutoKey = useRef<string>("");

  const runClipboard = useCallback(async () => {
    if (!user) {
      Alert.alert("Sign in required", "Sign in to VeriSphere, then try again.");
      router.replace("/(auth)/login");
      return;
    }
    setPhase("working");
    setError(null);
    setStatus("Reading clipboard…");
    try {
      setStatus("Analyzing copied text…");
      const r = await analyzeClipboardText(user.id, true);
      void refreshProfile();
      setResult(r);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, [user, refreshProfile]);

  const runCapture = useCallback(
    async (path?: string | null) => {
      if (!user) {
        Alert.alert("Sign in required", "Sign in to VeriSphere, then try again.");
        router.replace("/(auth)/login");
        return;
      }
      setPhase("working");
      setError(null);
      setStatus(path ? "Analyzing what was on your screen…" : "Taking screenshot of your screen…");
      try {
        const r = await captureAndAnalyze(user.id, true, path);
        if ("started" in r && r.started) {
          setStatus("Taking screenshot… Allow screen capture if Android asks.");
          return;
        }
        void refreshProfile();
        setResult(r as AssistStructuredResult);
        setPhase("result");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setPhase("error");
      }
    },
    [user, refreshProfile],
  );

  const runGalleryFallback = useCallback(async () => {
    if (!user) {
      Alert.alert("Sign in required", "Sign in to VeriSphere, then try again.");
      router.replace("/(auth)/login");
      return;
    }
    setPhase("working");
    setError(null);
    setStatus("Opening photos…");
    try {
      setStatus("Analyzing image…");
      const r = await analyzeFromGallery(user.id, true);
      void refreshProfile();
      setResult(r);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, [user, refreshProfile]);

  useEffect(() => {
    const a = (params.action || "menu") as Action;
    const path = typeof params.path === "string" ? params.path : "";
    const key = `${a}::${path}`;

    if (a === "menu") {
      lastAutoKey.current = key;
      setPhase("menu");
      return;
    }

    // Only auto-run once per action+path (avoids double analysis on re-render)
    if (lastAutoKey.current === key) return;
    lastAutoKey.current = key;

    if (a === "clipboard") {
      void runClipboard();
    } else if (a === "capture" || a === "screenshot") {
      void runCapture(path || undefined);
    }
  }, [params.action, params.path, runClipboard, runCapture]);

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace("/(app)/(tabs)");
  }

  const hasNativeCapture = FloatingAssist.hasNativeModule();
  const sheetPad = { paddingBottom: Math.max(insets.bottom, 12) };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={close}>
      <View style={[styles.backdrop, sheetPad]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />

        {phase === "menu" ? (
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheet}
            bounces={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.handle} />
            <Text style={styles.title}>Analyze this screen</Text>
            <Text style={styles.sub}>
              Choose <Text style={styles.em}>Analyze content on my screen</Text>. The floating
              window takes a screenshot for you (Android asks permission), then AI analyzes it. You
              do not need to screenshot yourself.
            </Text>

            <Pressable style={styles.optionPrimary} onPress={() => void runCapture()}>
              <Text style={styles.optionIcon}>▣</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Analyze content on my screen</Text>
                <Text style={styles.optionSub}>
                  {hasNativeCapture
                    ? "1) App screenshots  ·  2) AI analyzes"
                    : "Works in VeriSphere AI app — not Expo Go"}
                </Text>
              </View>
            </Pressable>

            {!hasNativeCapture ? (
              <View style={styles.expoNote}>
                <Text style={styles.expoNoteTitle}>You are in Expo Go</Text>
                <Text style={styles.expoNoteBody}>
                  Expo Go cannot take screenshots of Facebook. On your computer, connect the phone
                  with USB, open the mobile folder, and run:
                </Text>
                <Text style={styles.expoCmd}>npm run android</Text>
                <Text style={styles.expoNoteBody}>
                  Then open the installed <Text style={styles.em}>VeriSphere AI</Text> app (icon on
                  home screen) — not Expo Go.
                </Text>
              </View>
            ) : null}

            <Pressable style={styles.option} onPress={() => void runClipboard()}>
              <Text style={styles.optionIcon}>⎘</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Use copied text instead</Text>
                <Text style={styles.optionSub}>Works in Expo Go · copy caption first</Text>
              </View>
            </Pressable>

            <Pressable style={styles.optionMuted} onPress={() => void runGalleryFallback()}>
              <Text style={styles.optionTitle}>Pick a photo instead</Text>
              <Text style={styles.optionSub}>Works in Expo Go as a temporary fallback</Text>
            </Pressable>

            <Pressable onPress={close} style={styles.cancel}>
              <Text style={styles.cancelText}>Not now</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {phase === "working" ? (
          <View style={styles.sheet}>
            <ActivityIndicator size="large" color={colors.teal} />
            <Text style={[styles.title, { marginTop: 16, textAlign: "center" }]}>{status}</Text>
            <Text style={[styles.sub, { textAlign: "center" }]}>
              Screenshot first, then AI analysis (about 10–30s). Android may ask once to allow
              capture.
            </Text>
            <Pressable onPress={close} style={styles.cancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        {phase === "error" ? (
          <ScrollView style={styles.sheetScroll} contentContainerStyle={styles.sheet} bounces={false}>
            <Text style={styles.title}>Couldn’t analyze</Text>
            <Text style={styles.sub}>{error}</Text>
            <Pressable
              style={styles.option}
              onPress={() => {
                lastAutoKey.current = "";
                setPhase("menu");
              }}
            >
              <Text style={styles.optionTitle}>Try again</Text>
            </Pressable>
            <Pressable style={styles.optionMuted} onPress={() => void runGalleryFallback()}>
              <Text style={styles.optionTitle}>Pick a photo instead</Text>
            </Pressable>
            <Pressable style={styles.option} onPress={() => void runClipboard()}>
              <Text style={styles.optionTitle}>Use copied text</Text>
            </Pressable>
            <Pressable onPress={close} style={styles.cancel}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {phase === "result" && result ? (
          <View style={styles.resultWrap}>
            <StructuredAssistResult result={result} onDismiss={close} autoDismissMs={0} />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(12, 35, 64, 0.35)",
    justifyContent: "flex-end",
    padding: 16,
  },
  sheetScroll: {
    maxHeight: "88%",
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.borderSolid,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderSolid,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 6 },
  sub: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 14 },
  em: { fontWeight: "700", color: colors.foreground },
  option: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    backgroundColor: colors.mutedSurface,
    marginBottom: 10,
  },
  optionPrimary: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.teal,
    backgroundColor: colors.mutedSurface,
    marginBottom: 10,
  },
  optionMuted: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    marginBottom: 8,
  },
  optionIcon: { fontSize: 22, width: 28, textAlign: "center", color: colors.teal },
  optionTitle: { fontWeight: "700", fontSize: 15, color: colors.foreground },
  optionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  expoNote: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(45, 138, 158, 0.12)",
    borderWidth: 1,
    borderColor: colors.teal,
    marginBottom: 12,
  },
  expoNoteTitle: { fontWeight: "800", color: colors.teal, fontSize: 13, marginBottom: 6 },
  expoNoteBody: { fontSize: 12, color: colors.muted, lineHeight: 17, marginBottom: 6 },
  expoCmd: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
    marginBottom: 6,
  },
  cancel: { paddingVertical: 12, alignItems: "center" },
  cancelText: { color: colors.muted, fontWeight: "600", fontSize: 14 },
  resultWrap: { marginBottom: 8 },
});
