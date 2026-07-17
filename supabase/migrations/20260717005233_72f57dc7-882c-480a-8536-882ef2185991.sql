
-- ============= ENUMS =============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.verify_type AS ENUM ('url', 'text', 'image');
CREATE TYPE public.trust_category AS ENUM ('high_trust', 'needs_verification', 'low_confidence', 'potentially_misleading');
CREATE TYPE public.verify_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============= UTILITY FN =============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============= PROFILES =============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  avatar_url TEXT,
  ai_consent BOOLEAN NOT NULL DEFAULT false,
  ai_consent_at TIMESTAMPTZ,
  notification_email BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= USER ROLES =============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "admins view roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger: auto-create profile + default 'user' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============= CONSENT RECORDS =============
CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL,
  scope TEXT NOT NULL DEFAULT 'ai_processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consent select" ON public.consent_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own consent insert" ON public.consent_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view consent" ON public.consent_records FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= UPLOADED CONTENT =============
CREATE TABLE public.uploaded_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.uploaded_content TO authenticated;
GRANT ALL ON public.uploaded_content TO service_role;
ALTER TABLE public.uploaded_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own uploads all" ON public.uploaded_content FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view uploads" ON public.uploaded_content FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= VERIFICATION REQUESTS =============
CREATE TABLE public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type verify_type NOT NULL,
  input_url TEXT,
  input_text TEXT,
  uploaded_content_id UUID REFERENCES public.uploaded_content(id) ON DELETE SET NULL,
  status verify_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.verification_requests TO authenticated;
GRANT ALL ON public.verification_requests TO service_role;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own requests all" ON public.verification_requests FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view requests" ON public.verification_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_vr_user_created ON public.verification_requests(user_id, created_at DESC);

-- ============= VERIFICATION RESULTS =============
CREATE TABLE public.verification_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trust_score INT NOT NULL CHECK (trust_score BETWEEN 0 AND 100),
  category trust_category NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  summary TEXT NOT NULL,
  source_assessment TEXT,
  context_analysis TEXT,
  ai_generated_detected BOOLEAN NOT NULL DEFAULT false,
  concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  replay_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.verification_results TO authenticated;
GRANT ALL ON public.verification_results TO service_role;
ALTER TABLE public.verification_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own results select" ON public.verification_results FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own results insert" ON public.verification_results FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view results" ON public.verification_results FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= LEARNING =============
CREATE TABLE public.learning_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  estimated_minutes INT NOT NULL DEFAULT 10,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.learning_modules TO authenticated, anon;
GRANT ALL ON public.learning_modules TO service_role;
ALTER TABLE public.learning_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "modules readable" ON public.learning_modules FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins manage modules" ON public.learning_modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.lessons TO authenticated;
GRANT ALL ON public.lessons TO service_role;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lessons readable" ON public.lessons FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage lessons" ON public.lessons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  pass_score INT NOT NULL DEFAULT 70
);
GRANT SELECT ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quizzes readable" ON public.quizzes FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage quizzes" ON public.quizzes FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INT NOT NULL,
  explanation TEXT,
  sort_order INT NOT NULL DEFAULT 0
);
GRANT SELECT ON public.quiz_questions TO authenticated;
GRANT ALL ON public.quiz_questions TO service_role;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions readable" ON public.quiz_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage questions" ON public.quiz_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score INT NOT NULL,
  total INT NOT NULL,
  passed BOOLEAN NOT NULL DEFAULT false,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.quiz_attempts TO authenticated;
GRANT ALL ON public.quiz_attempts TO service_role;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attempts" ON public.quiz_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view attempts" ON public.quiz_attempts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.learning_modules(id) ON DELETE CASCADE,
  progress_pct INT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  completed BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_learning_progress TO authenticated;
GRANT ALL ON public.user_learning_progress TO service_role;
ALTER TABLE public.user_learning_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own progress" ON public.user_learning_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view progress" ON public.user_learning_progress FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= BADGES =============
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'award',
  criteria TEXT NOT NULL
);
GRANT SELECT ON public.badges TO authenticated, anon;
GRANT ALL ON public.badges TO service_role;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "badges readable" ON public.badges FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY "admins manage badges" ON public.badges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
GRANT SELECT, INSERT ON public.user_badges TO authenticated;
GRANT ALL ON public.user_badges TO service_role;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own badges" ON public.user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own badges insert" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view badges" ON public.user_badges FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============= ANALYTICS + MODERATION =============
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT ALL ON public.analytics_events TO service_role;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own events insert" ON public.analytics_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins view events" ON public.analytics_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_result_id UUID REFERENCES public.verification_results(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT ON public.moderation_reports TO authenticated;
GRANT ALL ON public.moderation_reports TO service_role;
ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reporters insert" ON public.moderation_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "own reports select" ON public.moderation_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "admins manage reports" ON public.moderation_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= SEED LEARNING CONTENT =============
INSERT INTO public.learning_modules (slug, title, description, category, difficulty, estimated_minutes, sort_order) VALUES
('spot-misleading-headlines', 'How to Spot Misleading Headlines', 'Recognize sensational headlines, missing context, and common clickbait patterns.', 'Media Literacy', 'beginner', 8, 1),
('verify-images-videos', 'Verifying Images and Videos Online', 'Learn techniques like reverse image search and metadata inspection.', 'Verification', 'intermediate', 12, 2),
('understanding-ai-content', 'Understanding AI-Generated Content', 'Understand how AI-generated text and images look and where they show up.', 'AI Literacy', 'intermediate', 10, 3),
('source-credibility', 'Checking Source Credibility', 'Evaluate publishers, authors, citations, and transparency practices.', 'Media Literacy', 'beginner', 9, 4),
('think-before-sharing', 'Thinking Before Sharing', 'Build habits that slow down before sharing questionable content.', 'Behavior', 'beginner', 6, 5);

-- Lessons (one per module for MVP)
INSERT INTO public.lessons (module_id, title, body, sort_order)
SELECT id, title, 'This lesson introduces core concepts and walks through practical examples. Read carefully, then take the quiz.', 1
FROM public.learning_modules;

-- Quizzes
INSERT INTO public.quizzes (module_id, title, pass_score)
SELECT id, title || ' Quiz', 70 FROM public.learning_modules;

-- 3 questions per quiz
INSERT INTO public.quiz_questions (quiz_id, question, options, correct_index, explanation, sort_order)
SELECT q.id,
  'Which is a red flag in a headline?',
  '["States clear facts","Uses ALL CAPS and emotional words","Cites named sources","Includes a date"]'::jsonb,
  1, 'Emotional language and all-caps often signal clickbait.', 1
FROM public.quizzes q;

INSERT INTO public.quiz_questions (quiz_id, question, options, correct_index, explanation, sort_order)
SELECT q.id,
  'A good first step when unsure about a claim is to:',
  '["Share it quickly","Trust the first result","Check multiple credible sources","Ignore it"]'::jsonb,
  2, 'Triangulating across independent sources reduces the risk of being misled.', 2
FROM public.quizzes q;

INSERT INTO public.quiz_questions (quiz_id, question, options, correct_index, explanation, sort_order)
SELECT q.id,
  'AI-generated images sometimes show:',
  '["Perfect anatomy always","Consistent shadows always","Odd hands, teeth, or text artifacts","Camera EXIF data always"]'::jsonb,
  2, 'Current AI image models often struggle with hands, small text, and consistent detail.', 3
FROM public.quizzes q;

-- ============= SEED BADGES =============
INSERT INTO public.badges (slug, title, description, icon, criteria) VALUES
('first-verification', 'First Verification', 'You completed your first content check.', 'search', 'Complete 1 verification'),
('fact-checker-in-training', 'Fact Checker in Training', 'You completed your first lesson.', 'book-open', 'Complete 1 lesson'),
('critical-thinker', 'Critical Thinker', 'You passed your first quiz.', 'brain', 'Pass 1 quiz'),
('media-literacy-champion', 'Media Literacy Champion', 'You completed 3 learning modules.', 'trophy', 'Complete 3 modules'),
('trust-builder', 'Trust Builder', 'You verified 10 pieces of content.', 'shield-check', 'Complete 10 verifications');
