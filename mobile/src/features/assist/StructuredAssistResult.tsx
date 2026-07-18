import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { colors, trustColor } from "@/src/theme/colors";
import { confidencePercent, trustLabel } from "@/src/lib/trust";
import type { AssistStructuredResult } from "./autoAnalyze";

type Props = {
  result: AssistStructuredResult;
  onDismiss: () => void;
  /** Auto-collapse after ms (non-annoying). Default 12s. 0 = never. */
  autoDismissMs?: number;
};

/**
 * Compact, structured result card for Floating Assist.
 * Score · category · summary · top concerns — not a full-page takeover.
 */
export function StructuredAssistResult({ result, onDismiss, autoDismissMs = 12000 }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(
    autoDismissMs > 0 ? Math.ceil(autoDismissMs / 1000) : 0,
  );
  const c = trustColor(result.category);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    let dismissed = false;
    const tick = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(tick);
          if (!dismissed) {
            dismissed = true;
            onDismiss();
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      clearInterval(tick);
      dismissed = true;
    };
  }, [autoDismissMs, onDismiss]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.kicker}>TrustLens · quick check</Text>
        {secondsLeft > 0 ? (
          <Text style={styles.timer}>closes in {secondsLeft}s</Text>
        ) : null}
      </View>

      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: c }]}>{Math.round(result.trustScore)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.chip, { color: c, borderColor: c }]}>
            {trustLabel(result.category)}
          </Text>
          <Text style={styles.conf}>Confidence {confidencePercent(result.confidence)}%</Text>
        </View>
      </View>

      <Text style={styles.summary} numberOfLines={3}>
        {result.summary}
      </Text>

      {result.preview ? (
        <Text style={styles.preview} numberOfLines={2}>
          From{" "}
          {result.source === "clipboard"
            ? "copied text"
            : result.source === "capture"
              ? "screen capture"
              : "photo"}
          : “{result.preview}”
        </Text>
      ) : null}

      {result.concerns.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Concerns</Text>
          {result.concerns.slice(0, 3).map((item, i) => (
            <Text key={i} style={styles.bullet} numberOfLines={2}>
              · {item}
            </Text>
          ))}
        </View>
      ) : null}

      {result.nextSteps.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Next steps</Text>
          {result.nextSteps.slice(0, 2).map((item, i) => (
            <Text key={i} style={styles.bullet} numberOfLines={2}>
              · {item}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={styles.btnPrimary}
          onPress={() => {
            onDismiss();
            router.push(`/(app)/verify/${result.requestId}`);
          }}
        >
          <Text style={styles.btnPrimaryText}>Full report</Text>
        </Pressable>
        <Pressable style={styles.btnGhost} onPress={onDismiss}>
          <Text style={styles.btnGhostText}>Done</Text>
        </Pressable>
      </View>

      <Text style={styles.disclaimer}>Signals, not verdicts. Always double-check before sharing.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    maxHeight: "70%",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  kicker: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: colors.teal,
    textTransform: "uppercase",
  },
  timer: { fontSize: 11, color: colors.muted },
  scoreRow: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 10 },
  score: { fontSize: 40, fontWeight: "700", minWidth: 56 },
  chip: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  conf: { marginTop: 4, fontSize: 12, color: colors.muted },
  summary: { fontSize: 15, lineHeight: 21, color: colors.foreground, marginBottom: 8 },
  preview: {
    fontSize: 12,
    color: colors.muted,
    fontStyle: "italic",
    marginBottom: 10,
    lineHeight: 17,
  },
  block: { marginBottom: 8 },
  blockTitle: { fontSize: 12, fontWeight: "700", color: colors.teal, marginBottom: 4 },
  bullet: { fontSize: 13, color: colors.foreground, lineHeight: 18, marginBottom: 2 },
  actions: { flexDirection: "row", gap: 8, marginTop: 8 },
  btnPrimary: {
    flex: 1,
    backgroundColor: colors.tealMuted,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  btnGhost: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.borderSolid,
  },
  btnGhostText: { color: colors.muted, fontWeight: "700", fontSize: 14 },
  disclaimer: { marginTop: 10, fontSize: 11, color: colors.muted, textAlign: "center" },
});
