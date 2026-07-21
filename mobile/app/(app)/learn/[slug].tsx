import { useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/src/lib/db";
import { useSession } from "@/src/features/auth/session";
import { Screen, Title, Muted, Card, Button, SectionLabel } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";

type Lesson = {
  id: string;
  title: string;
  content?: string | null;
  body?: string | null;
  sort_order?: number | null;
};

export default function CourseScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { user } = useSession();
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());

  const q = useQuery({
    queryKey: ["module", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data: m } = await db.from("learning_modules").select("*").eq("slug", slug).maybeSingle();
      if (!m) return null;
      const [{ data: lessons }, { data: quiz }] = await Promise.all([
        db.from("lessons").select("*").eq("module_id", m.id).order("sort_order"),
        db.from("quizzes").select("id, title, pass_score").eq("module_id", m.id).maybeSingle(),
      ]);
      return { module: m, lessons: (lessons ?? []) as Lesson[], quiz };
    },
  });

  const lessons = q.data?.lessons ?? [];
  const total = lessons.length || 1;
  const pct = useMemo(() => {
    if (!lessons.length) return 0;
    return Math.min(95, Math.round((completed.size / total) * 80 + ((active + 1) / total) * 15));
  }, [active, completed, lessons.length, total]);

  async function markComplete() {
    if (!user || !q.data?.module) return;
    const next = new Set(completed);
    next.add(active);
    setCompleted(next);
    const progress_pct = Math.min(90, Math.round((next.size / total) * 90));
    await db.from("user_learning_progress").upsert(
      {
        user_id: user.id,
        module_id: q.data.module.id,
        progress_pct,
        completed: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,module_id" },
    );
    if (active < lessons.length - 1) setActive(active + 1);
    else Alert.alert("Lesson done", "You can take the quiz if available.");
  }

  if (q.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.teal} size="large" />
      </Screen>
    );
  }
  if (!q.data?.module) {
    return (
      <Screen>
        <Title>Course not found</Title>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const lesson = lessons[active];
  const body = lesson?.content || lesson?.body || "No lesson content.";

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>Course</SectionLabel>
        <Title>{String(q.data.module.title).replace(/^Course:\s*/i, "")}</Title>
        <Muted>
          Lesson {lessons.length ? active + 1 : 0} of {lessons.length} · ~{pct}%
        </Muted>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>

        {lesson ? (
          <Card>
            <Text style={styles.lessonTitle}>{lesson.title}</Text>
            <Text style={styles.body}>{body}</Text>
          </Card>
        ) : (
          <Card>
            <Muted>No lessons in this module yet.</Muted>
          </Card>
        )}

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Button
              title="Previous"
              variant="secondary"
              disabled={active <= 0}
              onPress={() => setActive((i) => Math.max(0, i - 1))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Mark complete" onPress={markComplete} />
          </View>
        </View>

        {q.data.quiz ? (
          <Button
            title="Take quiz"
            variant="secondary"
            onPress={() => router.push(`/(app)/quiz/${q.data!.module.id}`)}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12, paddingTop: 8 },
  barBg: { height: 8, backgroundColor: colors.border, borderRadius: 999, overflow: "hidden" },
  barFill: { height: 8, backgroundColor: colors.teal },
  lessonTitle: { fontSize: 18, fontWeight: "700", color: colors.foreground, marginBottom: 10 },
  body: { fontSize: 15, color: colors.foreground, lineHeight: 22 },
  row: { flexDirection: "row", gap: 8 },
});
