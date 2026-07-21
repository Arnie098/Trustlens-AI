import { View, Text, StyleSheet, FlatList, RefreshControl } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/src/lib/db";
import { useSession } from "@/src/features/auth/session";
import { Screen, Title, Muted, Card, SectionLabel } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";

type Badge = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon?: string | null;
  criteria?: string | null;
};

export default function AchievementsScreen() {
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["achievements", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: badges }, { data: mine }] = await Promise.all([
        db.from("badges").select("*"),
        db.from("user_badges").select("badge_id, awarded_at").eq("user_id", user!.id),
      ]);
      return { all: (badges ?? []) as Badge[], earned: mine ?? [] };
    },
  });

  const earnedCount = q.data
    ? q.data.all.filter((b) =>
        q.data!.earned.some((x: { badge_id: string }) => x.badge_id === b.id),
      ).length
    : 0;

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <FlatList
        data={q.data?.all ?? []}
        keyExtractor={(b) => b.id}
        numColumns={1}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionLabel>Your progress</SectionLabel>
            <Title>Achievements</Title>
            <Muted>Earn badges as you verify content and complete lessons.</Muted>
            {q.data ? (
              <Card>
                <Text style={styles.count}>
                  {earnedCount} of {q.data.all.length} earned
                </Text>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Muted>{q.isError ? "Could not load badges." : "No badges configured yet."}</Muted>
          </Card>
        }
        renderItem={({ item }) => {
          const earned = q.data?.earned.find((x: { badge_id: string; awarded_at: string }) => x.badge_id === item.id);
          return (
            <View style={[styles.badge, !earned && styles.locked]}>
              <Text style={styles.icon}>{earned ? "★" : "○"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.desc}>{item.description}</Text>
                {item.criteria ? <Text style={styles.criteria}>{item.criteria}</Text> : null}
                {earned ? (
                  <Text style={styles.earned}>Earned {new Date(earned.awarded_at).toLocaleDateString()}</Text>
                ) : (
                  <Text style={styles.lockedText}>Locked</Text>
                )}
              </View>
            </View>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 120 },
  header: { gap: 8, paddingTop: 8, marginBottom: 12 },
  count: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  badge: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.teal,
    padding: 14,
    marginBottom: 10,
  },
  locked: { opacity: 0.55, borderColor: colors.borderSolid },
  icon: { fontSize: 28, color: colors.teal, width: 36, textAlign: "center" },
  title: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  desc: { marginTop: 4, fontSize: 13, color: colors.muted, lineHeight: 18 },
  criteria: { marginTop: 6, fontSize: 11, color: colors.muted },
  earned: { marginTop: 8, fontSize: 12, fontWeight: "600", color: colors.trustHigh },
  lockedText: { marginTop: 8, fontSize: 12, fontWeight: "600", color: colors.muted },
});
