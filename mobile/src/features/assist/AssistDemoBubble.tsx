import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { router } from "expo-router";
import { FloatingAssist } from "./bridge";
import { colors } from "@/src/theme/colors";

type Props = {
  /** Keep bubble above the tab bar + system nav (already includes inset). */
  tabBarHeight?: number;
};

/**
 * In-app / web demo of the floating bubble.
 * On a real Android dev build, the native SYSTEM_ALERT_WINDOW bubble replaces this.
 */
export function AssistDemoBubble({ tabBarHeight = 72 }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(() => {
    void FloatingAssist.isEnabled().then(setEnabled);
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  // Native bubble handles Facebook overlay — hide JS FAB to avoid double UI
  if (!enabled || FloatingAssist.hasNativeModule()) return null;

  // tabBarHeight already includes safe-area bottom inset
  const bottom = tabBarHeight + 12;

  return (
    <View style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.title}>TrustLens</Text>
          <Text style={styles.hint}>
            Analyze content on your screen: the floating window screenshots, then AI checks it.
          </Text>
          <Pressable
            style={[styles.action, styles.actionPrimary]}
            onPress={() => {
              setExpanded(false);
              router.push({ pathname: "/(app)/assist", params: { action: "capture" } });
            }}
          >
            <Text style={styles.actionText}>Analyze content on my screen</Text>
            <Text style={styles.actionSub}>1) Screenshot  ·  2) AI analyzes</Text>
          </Pressable>
          <Pressable
            style={styles.action}
            onPress={() => {
              setExpanded(false);
              router.push({ pathname: "/(app)/assist", params: { action: "clipboard" } });
            }}
          >
            <Text style={styles.actionText}>Use copied text instead</Text>
            <Text style={styles.actionSub}>Only if you already copied a caption</Text>
          </Pressable>
          <Pressable onPress={() => setExpanded(false)}>
            <Text style={styles.dismiss}>Not now</Text>
          </Pressable>
        </View>
      ) : null}

      <Pressable
        style={[styles.bubble, expanded && styles.bubbleActive]}
        onPress={() => setExpanded((v) => !v)}
        accessibilityLabel="TrustLens floating assist"
      >
        <Text style={styles.bubbleText}>TL</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 16,
    zIndex: 1000,
    alignItems: "flex-end",
    maxWidth: 280,
  },
  bubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.navy,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.teal,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  bubbleActive: { opacity: 0.95 },
  bubbleText: { color: colors.white, fontWeight: "800", fontSize: 14, letterSpacing: 0.5 },
  panel: {
    marginBottom: 10,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    width: 260,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontWeight: "700", color: colors.foreground, fontSize: 15, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.muted, lineHeight: 16, marginBottom: 10 },
  action: {
    backgroundColor: colors.mutedSurface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderSolid,
  },
  actionPrimary: {
    borderWidth: 2,
    borderColor: colors.teal,
  },
  actionText: { fontWeight: "700", color: colors.foreground, fontSize: 14 },
  actionSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  dismiss: {
    textAlign: "center",
    color: colors.muted,
    fontWeight: "600",
    fontSize: 13,
    paddingVertical: 6,
  },
});
