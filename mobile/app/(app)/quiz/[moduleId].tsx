import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/src/lib/db";
import { useSession } from "@/src/features/auth/session";
import { Screen, Title, Muted, Card, Button, SectionLabel } from "@/src/components/ui";
import { colors } from "@/src/theme/colors";

type Question = {
  id: string;
  question: string;
  options: string[] | string;
  correct_index: number;
  explanation: string | null;
};

function parseOptions(options: string[] | string): string[] {
  if (Array.isArray(options)) return options;
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function QuizScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const { user } = useSession();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [saving, setSaving] = useState(false);

  const q = useQuery({
    queryKey: ["quiz", moduleId],
    enabled: !!moduleId,
    queryFn: async () => {
      const { data: quiz } = await db.from("quizzes").select("*").eq("module_id", moduleId).maybeSingle();
      if (!quiz) return null;
      const { data: questions } = await db
        .from("quiz_questions")
        .select("*")
        .eq("quiz_id", quiz.id)
        .order("sort_order");
      return { quiz, questions: (questions ?? []) as Question[] };
    },
  });

  if (q.isLoading) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.teal} size="large" />
      </Screen>
    );
  }
  if (!q.data?.questions?.length) {
    return (
      <Screen>
        <Title>No quiz</Title>
        <Muted>This module has no quiz questions yet.</Muted>
        <Button title="Back" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const { quiz, questions } = q.data;
  const question = questions[i];
  const options = parseOptions(question.options);
  const score = answers.reduce((s, a, idx) => s + (a === questions[idx].correct_index ? 1 : 0), 0);

  async function submitFinal(finalAnswers: number[]) {
    if (!user) return;
    setSaving(true);
    try {
      const correct = finalAnswers.reduce(
        (s, a, idx) => s + (a === questions[idx].correct_index ? 1 : 0),
        0,
      );
      const pct = Math.round((correct / questions.length) * 100);
      const passed = pct >= (quiz.pass_score ?? 70);
      await db.from("quiz_attempts").insert({
        user_id: user.id,
        quiz_id: quiz.id,
        score: correct,
        total: questions.length,
        passed,
        answers: finalAnswers,
      });
      if (passed) {
        const { data: b } = await db.from("badges").select("id").eq("slug", "critical-thinker").maybeSingle();
        if (b?.id) {
          await db.from("user_badges").upsert(
            { user_id: user.id, badge_id: b.id },
            { onConflict: "user_id,badge_id", ignoreDuplicates: true },
          );
        }
        await db.from("user_learning_progress").upsert(
          {
            user_id: user.id,
            module_id: moduleId,
            progress_pct: 100,
            completed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,module_id" },
        );
      }
      setShowResult(true);
    } catch (e) {
      Alert.alert("Could not save attempt", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    const passed = pct >= (quiz.pass_score ?? 70);
    return (
      <Screen>
        <SectionLabel>Quiz result</SectionLabel>
        <Title>{passed ? "Passed" : "Keep practicing"}</Title>
        <Card>
          <Text style={styles.bigScore}>{pct}%</Text>
          <Muted>
            {score} of {questions.length} correct · pass at {quiz.pass_score ?? 70}%
          </Muted>
        </Card>
        <Button title="Back to learn" onPress={() => router.push("/(app)/(tabs)/learn")} />
        <Button title="Achievements" variant="secondary" onPress={() => router.push("/(app)/(tabs)/achievements")} />
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingHorizontal: 0 }}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionLabel>
          Question {i + 1} / {questions.length}
        </SectionLabel>
        <Title>{quiz.title || "Quiz"}</Title>
        <Card>
          <Text style={styles.q}>{question.question}</Text>
          <View style={styles.options}>
            {options.map((opt, idx) => {
              const active = selected === idx;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setSelected(idx)}
                  style={[styles.opt, active && styles.optActive]}
                >
                  <Text style={[styles.optText, active && styles.optTextActive]}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <Button
          title={i === questions.length - 1 ? "Finish" : "Next"}
          loading={saving}
          disabled={selected === null}
          onPress={() => {
            if (selected === null) return;
            const nextAnswers = [...answers, selected];
            setAnswers(nextAnswers);
            setSelected(null);
            if (i === questions.length - 1) void submitFinal(nextAnswers);
            else setI(i + 1);
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 48, gap: 12, paddingTop: 8 },
  q: { fontSize: 17, fontWeight: "600", color: colors.foreground, lineHeight: 24, marginBottom: 14 },
  options: { gap: 8 },
  opt: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.background,
  },
  optActive: { borderColor: colors.teal, backgroundColor: "#e8f6f8" },
  optText: { color: colors.foreground, fontSize: 15 },
  optTextActive: { color: colors.foreground, fontWeight: "600" },
  bigScore: { fontSize: 40, fontWeight: "700", color: colors.foreground, marginBottom: 8 },
});
