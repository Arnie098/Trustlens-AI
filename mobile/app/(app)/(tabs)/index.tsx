import { useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Alert,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useSession } from "@/src/features/auth/session";
import { db } from "@/src/lib/db";
import { Screen, Title, Muted, Button, Card, SectionLabel } from "@/src/components/ui";
import { colors, trustColor } from "@/src/theme/colors";
import { fonts } from "@/src/theme/typography";
import { trustLabel } from "@/src/lib/trust";
import type { TrustCategory } from "@/src/lib/types/analysis";

type RecentRow = {
  id: string;
  type: string;
  input_url: string | null;
  input_text: string | null;
  created_at: string;
  verification_results:
    | { trust_score: number; category: TrustCategory }
    | { trust_score: number; category: TrustCategory }[]
    | null;
};

function resultOf(row: RecentRow) {
  const r = row.verification_results;
  if (!r) return null;
  return Array.isArray(r) ? r[0] : r;
}

export default function HomeScreen() {
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["home-recent", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("verification_requests")
        .select("id, type, input_url, input_text, created_at, verification_results(trust_score, category)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as RecentRow[];
    },
  });

  useFocusEffect(useCallback(() => { void q.refetch(); }, [q.refetch]));

  async function verifyClipboard() {
    const text = (await Clipboard.getStringAsync()).trim();
    if (!text) {
      Alert.alert("Clipboard empty", "Copy a caption or link first.");
      return;
    }
    const tab = /^https?:\/\//i.test(text) ? "url" : "text";
    router.push({ pathname: "/(app)/(tabs)/verify", params: { tab, prefill: text } });
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <FlatList
        data={q.data ?? []}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Image
                source={require("@/assets/images/brand-logo.png")}
                style={styles.brandLogo}
                resizeMode="contain"
              />
              <Text style={styles.brandWord}>VeriSphere AI</Text>
            </View>
            <SectionLabel>Media literacy, quietly</SectionLabel>
            <Title>Home</Title>
            <Muted>Verify a link, paste a claim, or scan a post before you share.</Muted>
            <View style={styles.actions}>
              <Button title="Verify content" onPress={() => router.push("/(app)/(tabs)/verify")} />
              <Button
                title="Scan post"
                variant="secondary"
                onPress={() => router.push({ pathname: "/(app)/(tabs)/verify", params: { tab: "scan" } })}
              />
              <Button title="Verify clipboard" variant="ghost" onPress={verifyClipboard} />
              <Button
                title="Achievements"
                variant="ghost"
                onPress={() => router.push("/(app)/(tabs)/achievements")}
              />
            </View>
            <Text style={styles.section}>Recent</Text>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Muted>No verifications yet.</Muted>
          </Card>
        }
        renderItem={({ item }) => {
          const res = resultOf(item);
          const preview = item.input_url || item.input_text || item.type;
          const cat = res?.category;
          return (
            <Pressable onPress={() => router.push(`/(app)/verify/${item.id}`)} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowType}>{item.type.toUpperCase()}</Text>
                <Text style={styles.rowPreview} numberOfLines={2}>
                  {preview}
                </Text>
              </View>
              {res ? (
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={[styles.score, cat ? { color: trustColor(cat) } : null]}>
                    {Math.round(res.trust_score)}
                  </Text>
                  {cat ? (
                    <Text style={[styles.cat, { color: trustColor(cat) }]}>{trustLabel(cat)}</Text>
                  ) : null}
                </View>
              ) : (
                <Muted>—</Muted>
              )}
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  header: { gap: 10, marginBottom: 12, paddingTop: 8 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  brandLogo: { width: 34, height: 34 },
  brandWord: {
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  actions: { gap: 8, marginTop: 8 },
  section: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: "700",
    color: colors.muted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  row: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    padding: 14,
    marginBottom: 10,
  },
  rowType: { fontSize: 11, fontWeight: "700", color: colors.teal },
  rowPreview: { marginTop: 4, color: colors.foreground, fontSize: 14 },
  score: { fontSize: 22, fontWeight: "700" },
  cat: { fontSize: 10, fontWeight: "600", marginTop: 2, maxWidth: 100, textAlign: "right" },
});
