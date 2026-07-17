/** Column metadata for SQLite ↔ app shape conversion. */

export const BOOLEAN_COLUMNS = new Set([
  "ai_consent",
  "notification_email",
  "granted",
  "ai_generated_detected",
  "passed",
  "completed",
]);

export const JSON_COLUMNS = new Set([
  "concerns",
  "evidence",
  "next_steps",
  "replay_data",
  "options",
  "answers",
  "payload",
  "raw_user_meta_data",
]);

/** Known embeds used by the app (PostgREST-style nested select). */
export const EMBEDS: Record<
  string,
  Record<string, { table: string; localKey: string; foreignKey: string; many: boolean }>
> = {
  verification_results: {
    verification_requests: {
      table: "verification_requests",
      localKey: "request_id",
      foreignKey: "id",
      many: false,
    },
  },
  verification_requests: {
    verification_results: {
      table: "verification_results",
      localKey: "id",
      foreignKey: "request_id",
      many: true,
    },
  },
  user_badges: {
    badges: {
      table: "badges",
      localKey: "badge_id",
      foreignKey: "id",
      many: false,
    },
  },
};

export const TABLES_WITH_ID = new Set([
  "users",
  "profiles",
  "user_roles",
  "consent_records",
  "uploaded_content",
  "verification_requests",
  "verification_results",
  "learning_modules",
  "lessons",
  "quizzes",
  "quiz_questions",
  "quiz_attempts",
  "user_learning_progress",
  "badges",
  "user_badges",
  "analytics_events",
  "moderation_reports",
]);
