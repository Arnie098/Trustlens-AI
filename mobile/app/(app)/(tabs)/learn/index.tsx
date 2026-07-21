import { FlatList, Pressable, Text, StyleSheet, View, RefreshControl } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/src/lib/db";
import { useSession } from "@/src/features/auth/session";
import { Screen, Title, Muted, Card, SectionLabel } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";

type Module = {
  id: string;
  title: string;
  description?: string | null;
  slug?: string | null;
  sort_order?: number | null;
};

export default function LearnScreen() {
  const { user } = useSession();
  const q = useQuery({
    queryKey: ["learning-modules", user?.id],
    queryFn: async () => {
      const [{ data: modules, error }, { data: progress }] = await Promise.all([
        db.from("learning_modules").select("id, title, description, slug, sort_order").order("sort_order"),
        user
          ? db.from("user_learning_progress").select("module_id, progress_pct, completed").eq("user_id", user.id)
          : Promise.resolve({ data: [] as { module_id: string; progress_pct: number; completed: boolean }[] }),
      ]);
      if (error) throw error;
      const prog = (progress ?? []) as {
        module_id: string;
        progress_pct: number;
        completed: boolean;
      }[];
      return {
        modules: (modules ?? []) as Module[],
        progress: Object.fromEntries(prog.map((p) => [p.module_id, p])),
      };
    },
  });

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <FlatList
        data={q.data?.modules ?? []}
        keyExtractor={(m) => m.id}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <SectionLabel>Media literacy</SectionLabel>
            <Title>Learn</Title>
            <Muted>Courses and quizzes to build slower, sharper judgment.</Muted>
          </View>
        }
        ListEmptyComponent={
          <Card>
            <Muted>{q.isError ? "Could not load modules." : "No modules yet."}</Muted>
          </Card>
        }
        renderItem={({ item }) => {
          const p = q.data?.progress[item.id];
          return (
            <Pressable
              style={styles.card}
              onPress={() => {
                if (item.slug) router.push(`/(app)/learn/${item.slug}`);
              }}
            >
              <Text style={styles.title}>{item.title.replace(/^Course:\s*/i, "")}</Text>
              {item.description ? (
                <Text style={styles.desc} numberOfLines={3}>
                  {item.description}
                </Text>
              ) : null}
              {p ? (
                <Text style={styles.progress}>
                  {p.completed ? "Completed" : `${Math.round(p.progress_pct ?? 0)}% progress`}
                </Text>
              ) : (
                <Text style={styles.progress}>Start course →</Text>
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
  header: { gap: 8, paddingTop: 8, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderSolid,
    padding: 14,
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: "700", color: colors.foreground },
  desc: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 20 },
  progress: { marginTop: 10, color: colors.teal, fontWeight: "600", fontSize: 13 },
});
