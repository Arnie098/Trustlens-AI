-- TrustLensAI local SQLite schema
-- Mirrors supabase/migrations (public tables) for easy later migration to Supabase.
-- Differences from Postgres:
--   * auth.users → local users table
--   * UUID / TIMESTAMPTZ / ENUM / JSONB → TEXT + CHECK constraints
--   * No RLS (enforce in app until Supabase)

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ============= AUTH STAND-IN (maps to Supabase auth.users later) =============
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT UNIQUE,
  full_name TEXT,
  password_hash TEXT,
  raw_user_meta_data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Server-side sessions (local SQLite auth). Maps loosely to auth.sessions in Supabase.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT,
  revoked INTEGER NOT NULL DEFAULT 0 CHECK (revoked IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============= PROFILES =============
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  avatar_url TEXT,
  ai_consent INTEGER NOT NULL DEFAULT 0 CHECK (ai_consent IN (0, 1)),
  ai_consent_at TEXT,
  notification_email INTEGER NOT NULL DEFAULT 1 CHECK (notification_email IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============= USER ROLES =============
CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

-- ============= CONSENT RECORDS =============
CREATE TABLE IF NOT EXISTS consent_records (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
  scope TEXT NOT NULL DEFAULT 'ai_processing',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id);

-- ============= UPLOADED CONTENT =============
CREATE TABLE IF NOT EXISTS uploaded_content (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploaded_content(user_id);

-- ============= VERIFICATION REQUESTS =============
CREATE TABLE IF NOT EXISTS verification_requests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('url', 'text', 'image')),
  input_url TEXT,
  input_text TEXT,
  uploaded_content_id TEXT REFERENCES uploaded_content(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vr_user_created ON verification_requests(user_id, created_at DESC);

-- ============= VERIFICATION RESULTS =============
CREATE TABLE IF NOT EXISTS verification_results (
  id TEXT PRIMARY KEY NOT NULL,
  request_id TEXT NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trust_score INTEGER NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  category TEXT NOT NULL CHECK (
    category IN (
      'high_trust',
      'needs_verification',
      'low_confidence',
      'potentially_misleading'
    )
  ),
  confidence REAL NOT NULL,
  summary TEXT NOT NULL,
  source_assessment TEXT,
  context_analysis TEXT,
  ai_generated_detected INTEGER NOT NULL DEFAULT 0 CHECK (ai_generated_detected IN (0, 1)),
  concerns TEXT NOT NULL DEFAULT '[]',
  evidence TEXT NOT NULL DEFAULT '[]',
  next_steps TEXT NOT NULL DEFAULT '[]',
  replay_data TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vresults_user ON verification_results(user_id);
CREATE INDEX IF NOT EXISTS idx_vresults_request ON verification_results(request_id);

-- ============= LEARNING =============
CREATE TABLE IF NOT EXISTS learning_modules (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  estimated_minutes INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);

CREATE TABLE IF NOT EXISTS quizzes (
  id TEXT PRIMARY KEY NOT NULL,
  module_id TEXT NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pass_score INTEGER NOT NULL DEFAULT 70
);

CREATE INDEX IF NOT EXISTS idx_quizzes_module ON quizzes(module_id);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id TEXT PRIMARY KEY NOT NULL,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  correct_index INTEGER NOT NULL,
  explanation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_questions_quiz ON quiz_questions(quiz_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  passed INTEGER NOT NULL DEFAULT 0 CHECK (passed IN (0, 1)),
  answers TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id);

CREATE TABLE IF NOT EXISTS user_learning_progress (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON user_learning_progress(user_id);

-- ============= BADGES =============
CREATE TABLE IF NOT EXISTS badges (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'award',
  criteria TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_badges (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ============= ANALYTICS + MODERATION =============
CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id);

CREATE TABLE IF NOT EXISTS moderation_reports (
  id TEXT PRIMARY KEY NOT NULL,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  verification_result_id TEXT REFERENCES verification_results(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_moderation_status ON moderation_reports(status);

-- Keep profiles.updated_at fresh (only when real columns change — avoids recursion)
CREATE TRIGGER IF NOT EXISTS trg_profiles_updated
AFTER UPDATE OF
  full_name, email, preferred_language, avatar_url,
  ai_consent, ai_consent_at, notification_email
ON profiles
FOR EACH ROW
BEGIN
  UPDATE profiles SET updated_at = datetime('now') WHERE id = NEW.id;
END;
