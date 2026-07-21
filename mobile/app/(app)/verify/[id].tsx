import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Linking,
} from "react-native";
import { db } from "@/src/lib/db";
import { useSession } from "@/src/features/auth/session";
import { Screen, Card, Muted, Title, SectionLabel } from "@/src/components/ui";
import { TrustGauge } from "@/src/components/TrustGauge";
import { colors } from "@/src/theme/colors";
import type { TrustCategory, ReplayNode } from "@/src/lib/types/analysis";
import { confidencePercent } from "@/src/lib/trust";

type ResultRow = {
  trust_score: number;
  category: TrustCategory;
  confidence: number;
  summary: string;
  source_assessment: string;
  context_analysis: string;
  ai_generated_detected: boolean;
  concerns: string[] | null;
  evidence: string[] | null;
  next_steps: string[] | null;
  replay_data: ReplayNode[] | null;
  provider: "perplexity" | "mock" | null;
};

const URL_RE = /(https?:\/\/[^\s)]+)/i;

/** Split stored evidence into plain signals and citation URLs (stored as "Citation: <url>"). */
function splitEvidence(evidence: string[] | null | undefined) {
  const signals: string[] = [];
  const sources: string[] = [];
  for (const item of evidence ?? []) {
    const match = item.match(URL_RE);
    if (/^\s*citation\s*:/i.test(item) && match) {
      sources.push(match[1]);
    } else if (match && item.trim() === match[1]) {
      sources.push(match[1]);
    } else {
      signals.push(item);
    }
  }
  return { signals, sources: Array.from(new Set(sources)) };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function VerifyResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();

  const q = useQuery({
    queryKey: ["verify-result", id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const byRequest = await db
        .from("verification_results")
        .select("*")
        .eq("request_id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (byRequest.data) return byRequest.data as ResultRow;
      const byId = await db
        .from("verification_results")
        .select("*")
        .eq("id", id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (byId.error) throw byId.error;
      return byId.data as ResultRow | null;
    },
  });

  if (q.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator size="large" color={colors.teal} />
      </Screen>
    );
  }
  if (!q.data) {
    return (
      <Screen>
        <Title>Result not found</Title>
        <Muted>Still processing or failed to save.</Muted>
      </Screen>
    );
  }

  const r = q.data;
  const { signals, sources } = splitEvidence(r.evidence);
  const isLive = r.provider === "perplexity";
  const providerLabel = r.provider
    ? isLive
      ? "Live AI analysis"
      : "Offline heuristic"
    : null;
  const list = (items: string[] | null | undefined) =>
    (items ?? []).map((item, i) => (
      <Text key={i} style={styles.bullet}>
        • {item}
      </Text>
    ));

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Result</SectionLabel>
        <Title>Trust assessment</Title>
        <View style={styles.gaugeWrap}>
          <TrustGauge score={r.trust_score} category={r.category} />
          <Muted>Confidence {confidencePercent(r.confidence)}%</Muted>
          {providerLabel ? (
            <View
              style={[
                styles.providerBadge,
                { borderColor: isLive ? colors.teal : colors.trustMedium },
              ]}
            >
              <View
                style={[
                  styles.providerDot,
                  { backgroundColor: isLive ? colors.teal : colors.trustMedium },
                ]}
              />
              <Text
                style={[
                  styles.providerText,
                  { color: isLive ? colors.teal : colors.trustMedium },
                ]}
              >
                {providerLabel}
              </Text>
            </View>
          ) : null}
          {!isLive && r.provider === "mock" ? (
            <Muted style={styles.providerNote}>
              Live analysis was unavailable — this score is a heuristic estimate. Verify independently.
            </Muted>
          ) : null}
          {r.ai_generated_detected ? (
            <Text style={styles.aiFlag}>Possible AI-generated signals detected</Text>
          ) : null}
        </View>
        <Card>
          <Text style={styles.h}>Summary</Text>
          <Text style={styles.body}>{r.summary}</Text>
        </Card>
        <Card>
          <Text style={styles.h}>Source assessment</Text>
          <Text style={styles.body}>{r.source_assessment}</Text>
        </Card>
        <Card>
          <Text style={styles.h}>Context</Text>
          <Text style={styles.body}>{r.context_analysis}</Text>
        </Card>
        {(r.concerns?.length ?? 0) > 0 ? (
          <Card>
            <Text style={styles.h}>Concerns</Text>
            {list(r.concerns)}
          </Card>
        ) : null}
        {signals.length > 0 ? (
          <Card>
            <Text style={styles.h}>Evidence</Text>
            {list(signals)}
          </Card>
        ) : null}
        {sources.length > 0 ? (
          <Card>
            <Text style={styles.h}>Sources</Text>
            {sources.map((url) => (
              <Pressable
                key={url}
                onPress={() => void Linking.openURL(url)}
                style={styles.sourceRow}
              >
                <Text style={styles.sourceHost}>{hostOf(url)}</Text>
                <Text style={styles.sourceUrl} numberOfLines={1}>
                  {url}
                </Text>
              </Pressable>
            ))}
          </Card>
        ) : null}
        {(r.next_steps?.length ?? 0) > 0 ? (
          <Card>
            <Text style={styles.h}>Next steps</Text>
            {list(r.next_steps)}
          </Card>
        ) : null}
        {(r.replay_data?.length ?? 0) > 0 ? (
          <Card>
            <Text style={styles.h}>Trust Replay</Text>
            {(r.replay_data ?? []).map((n) => (
              <View key={n.id} style={styles.replayRow}>
                <Text style={styles.replayLabel}>
                  {n.warning ? "⚠ " : ""}
                  {n.label}
                </Text>
                <Muted>
                  {n.platform} · reach {n.reach}
                </Muted>
              </View>
            ))}
          </Card>
        ) : null}
        <Text style={styles.back} onPress={() => router.push("/(app)/(tabs)/verify")}>
          New verification →
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12, paddingTop: 8 },
  gaugeWrap: { alignItems: "center", gap: 8, marginVertical: 8 },
  providerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  providerDot: { width: 7, height: 7, borderRadius: 4 },
  providerText: { fontSize: 12, fontWeight: "700", letterSpacing: 0.3 },
  providerNote: { textAlign: "center", maxWidth: 300, fontSize: 12 },
  aiFlag: { color: colors.trustMedium, fontWeight: "600", fontSize: 13 },
  h: { fontSize: 15, fontWeight: "700", color: colors.foreground, marginBottom: 8 },
  body: { fontSize: 15, color: colors.foreground, lineHeight: 22 },
  bullet: { fontSize: 14, color: colors.foreground, lineHeight: 22, marginBottom: 4 },
  sourceRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sourceHost: { fontSize: 14, fontWeight: "700", color: colors.teal },
  sourceUrl: { fontSize: 12, color: colors.muted, marginTop: 2 },
  replayRow: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  replayLabel: { fontWeight: "600", color: colors.foreground },
  back: { color: colors.teal, fontWeight: "700", marginTop: 8, fontSize: 15 },
});
