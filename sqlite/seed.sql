-- Stable UUIDs so seeds are idempotent and easy to map when moving to Supabase.
-- Run after schema.sql. Safe to re-run (INSERT OR IGNORE).

-- Password for seeded accounts: demo-trustlens-2026
-- (legacy sha256 hashes; server upgrades to scrypt on first successful login)

-- Learner demo (user role only) — user app / dashboard
INSERT OR IGNORE INTO users (id, email, full_name, password_hash, raw_user_meta_data) VALUES
(
  '11111111-1111-4111-8111-111111111111',
  'learner@trustlensai.app',
  'Demo Learner',
  'a8a688ab9d9d2681579f4a6aba21beae6860773c27e0e97f2308f0ddfef47b3f',
  '{"full_name":"Demo Learner"}'
);

INSERT OR IGNORE INTO profiles (id, full_name, email, preferred_language, ai_consent, notification_email)
VALUES (
  '11111111-1111-4111-8111-111111111111',
  'Demo Learner',
  'learner@trustlensai.app',
  'en',
  1,
  1
);

INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES
('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'user');

-- Admin demo (admin role) — separate admin console
INSERT OR IGNORE INTO users (id, email, full_name, password_hash, raw_user_meta_data) VALUES
(
  '11111111-1111-4111-8111-111111111110',
  'admin@trustlensai.app',
  'Platform Admin',
  'a8a688ab9d9d2681579f4a6aba21beae6860773c27e0e97f2308f0ddfef47b3f',
  '{"full_name":"Platform Admin"}'
);

INSERT OR IGNORE INTO profiles (id, full_name, email, preferred_language, ai_consent, notification_email)
VALUES (
  '11111111-1111-4111-8111-111111111110',
  'Platform Admin',
  'admin@trustlensai.app',
  'en',
  1,
  1
);

INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES
('22222222-2222-4222-8222-222222222200', '11111111-1111-4111-8111-111111111110', 'admin'),
('22222222-2222-4222-8222-22222222220a', '11111111-1111-4111-8111-111111111110', 'user');

-- Backward-compat alias: demo@trustlensai.app still works as learner (same person as learner)
INSERT OR IGNORE INTO users (id, email, full_name, password_hash, raw_user_meta_data) VALUES
(
  '11111111-1111-4111-8111-111111111113',
  'demo@trustlensai.app',
  'Demo Learner',
  'a8a688ab9d9d2681579f4a6aba21beae6860773c27e0e97f2308f0ddfef47b3f',
  '{"full_name":"Demo Learner"}'
);
INSERT OR IGNORE INTO profiles (id, full_name, email, preferred_language, ai_consent, notification_email)
VALUES (
  '11111111-1111-4111-8111-111111111113',
  'Demo Learner',
  'demo@trustlensai.app',
  'en',
  1,
  1
);
INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES
('22222222-2222-4222-8222-22222222220b', '11111111-1111-4111-8111-111111111113', 'user');

-- Learning modules
INSERT OR IGNORE INTO learning_modules (id, slug, title, description, category, difficulty, estimated_minutes, sort_order) VALUES
('a1000001-0001-4001-8001-000000000001', 'spot-misleading-headlines', 'How to Spot Misleading Headlines', 'Recognize sensational headlines, missing context, and common clickbait patterns.', 'Media Literacy', 'beginner', 8, 1),
('a1000001-0001-4001-8001-000000000002', 'verify-images-videos', 'Verifying Images and Videos Online', 'Learn techniques like reverse image search and metadata inspection.', 'Verification', 'intermediate', 12, 2),
('a1000001-0001-4001-8001-000000000003', 'understanding-ai-content', 'Understanding AI-Generated Content', 'Understand how AI-generated text and images look and where they show up.', 'AI Literacy', 'intermediate', 10, 3),
('a1000001-0001-4001-8001-000000000004', 'source-credibility', 'Checking Source Credibility', 'Evaluate publishers, authors, citations, and transparency practices.', 'Media Literacy', 'beginner', 9, 4),
('a1000001-0001-4001-8001-000000000005', 'think-before-sharing', 'Thinking Before Sharing', 'Build habits that slow down before sharing questionable content.', 'Behavior', 'beginner', 6, 5);

-- One lesson per module
INSERT OR IGNORE INTO lessons (id, module_id, title, body, sort_order) VALUES
('b2000002-0002-4002-8002-000000000001', 'a1000001-0001-4001-8001-000000000001', 'How to Spot Misleading Headlines', 'This lesson introduces core concepts and walks through practical examples. Read carefully, then take the quiz.', 1),
('b2000002-0002-4002-8002-000000000002', 'a1000001-0001-4001-8001-000000000002', 'Verifying Images and Videos Online', 'This lesson introduces core concepts and walks through practical examples. Read carefully, then take the quiz.', 1),
('b2000002-0002-4002-8002-000000000003', 'a1000001-0001-4001-8001-000000000003', 'Understanding AI-Generated Content', 'This lesson introduces core concepts and walks through practical examples. Read carefully, then take the quiz.', 1),
('b2000002-0002-4002-8002-000000000004', 'a1000001-0001-4001-8001-000000000004', 'Checking Source Credibility', 'This lesson introduces core concepts and walks through practical examples. Read carefully, then take the quiz.', 1),
('b2000002-0002-4002-8002-000000000005', 'a1000001-0001-4001-8001-000000000005', 'Thinking Before Sharing', 'This lesson introduces core concepts and walks through practical examples. Read carefully, then take the quiz.', 1);

-- Quizzes
INSERT OR IGNORE INTO quizzes (id, module_id, title, pass_score) VALUES
('c3000003-0003-4003-8003-000000000001', 'a1000001-0001-4001-8001-000000000001', 'How to Spot Misleading Headlines Quiz', 70),
('c3000003-0003-4003-8003-000000000002', 'a1000001-0001-4001-8001-000000000002', 'Verifying Images and Videos Online Quiz', 70),
('c3000003-0003-4003-8003-000000000003', 'a1000001-0001-4001-8001-000000000003', 'Understanding AI-Generated Content Quiz', 70),
('c3000003-0003-4003-8003-000000000004', 'a1000001-0001-4001-8001-000000000004', 'Checking Source Credibility Quiz', 70),
('c3000003-0003-4003-8003-000000000005', 'a1000001-0001-4001-8001-000000000005', 'Thinking Before Sharing Quiz', 70);

-- 3 shared-style questions per quiz (same MVP content as Supabase seed)
INSERT OR IGNORE INTO quiz_questions (id, quiz_id, question, options, correct_index, explanation, sort_order) VALUES
-- Module 1
('d4000004-0004-4004-8004-000000000011', 'c3000003-0003-4003-8003-000000000001', 'Which is a red flag in a headline?', '["States clear facts","Uses ALL CAPS and emotional words","Cites named sources","Includes a date"]', 1, 'Emotional language and all-caps often signal clickbait.', 1),
('d4000004-0004-4004-8004-000000000012', 'c3000003-0003-4003-8003-000000000001', 'A good first step when unsure about a claim is to:', '["Share it quickly","Trust the first result","Check multiple credible sources","Ignore it"]', 2, 'Triangulating across independent sources reduces the risk of being misled.', 2),
('d4000004-0004-4004-8004-000000000013', 'c3000003-0003-4003-8003-000000000001', 'AI-generated images sometimes show:', '["Perfect anatomy always","Consistent shadows always","Odd hands, teeth, or text artifacts","Camera EXIF data always"]', 2, 'Current AI image models often struggle with hands, small text, and consistent detail.', 3),
-- Module 2
('d4000004-0004-4004-8004-000000000021', 'c3000003-0003-4003-8003-000000000002', 'Which is a red flag in a headline?', '["States clear facts","Uses ALL CAPS and emotional words","Cites named sources","Includes a date"]', 1, 'Emotional language and all-caps often signal clickbait.', 1),
('d4000004-0004-4004-8004-000000000022', 'c3000003-0003-4003-8003-000000000002', 'A good first step when unsure about a claim is to:', '["Share it quickly","Trust the first result","Check multiple credible sources","Ignore it"]', 2, 'Triangulating across independent sources reduces the risk of being misled.', 2),
('d4000004-0004-4004-8004-000000000023', 'c3000003-0003-4003-8003-000000000002', 'AI-generated images sometimes show:', '["Perfect anatomy always","Consistent shadows always","Odd hands, teeth, or text artifacts","Camera EXIF data always"]', 2, 'Current AI image models often struggle with hands, small text, and consistent detail.', 3),
-- Module 3
('d4000004-0004-4004-8004-000000000031', 'c3000003-0003-4003-8003-000000000003', 'Which is a red flag in a headline?', '["States clear facts","Uses ALL CAPS and emotional words","Cites named sources","Includes a date"]', 1, 'Emotional language and all-caps often signal clickbait.', 1),
('d4000004-0004-4004-8004-000000000032', 'c3000003-0003-4003-8003-000000000003', 'A good first step when unsure about a claim is to:', '["Share it quickly","Trust the first result","Check multiple credible sources","Ignore it"]', 2, 'Triangulating across independent sources reduces the risk of being misled.', 2),
('d4000004-0004-4004-8004-000000000033', 'c3000003-0003-4003-8003-000000000003', 'AI-generated images sometimes show:', '["Perfect anatomy always","Consistent shadows always","Odd hands, teeth, or text artifacts","Camera EXIF data always"]', 2, 'Current AI image models often struggle with hands, small text, and consistent detail.', 3),
-- Module 4
('d4000004-0004-4004-8004-000000000041', 'c3000003-0003-4003-8003-000000000004', 'Which is a red flag in a headline?', '["States clear facts","Uses ALL CAPS and emotional words","Cites named sources","Includes a date"]', 1, 'Emotional language and all-caps often signal clickbait.', 1),
('d4000004-0004-4004-8004-000000000042', 'c3000003-0003-4003-8003-000000000004', 'A good first step when unsure about a claim is to:', '["Share it quickly","Trust the first result","Check multiple credible sources","Ignore it"]', 2, 'Triangulating across independent sources reduces the risk of being misled.', 2),
('d4000004-0004-4004-8004-000000000043', 'c3000003-0003-4003-8003-000000000004', 'AI-generated images sometimes show:', '["Perfect anatomy always","Consistent shadows always","Odd hands, teeth, or text artifacts","Camera EXIF data always"]', 2, 'Current AI image models often struggle with hands, small text, and consistent detail.', 3),
-- Module 5
('d4000004-0004-4004-8004-000000000051', 'c3000003-0003-4003-8003-000000000005', 'Which is a red flag in a headline?', '["States clear facts","Uses ALL CAPS and emotional words","Cites named sources","Includes a date"]', 1, 'Emotional language and all-caps often signal clickbait.', 1),
('d4000004-0004-4004-8004-000000000052', 'c3000003-0003-4003-8003-000000000005', 'A good first step when unsure about a claim is to:', '["Share it quickly","Trust the first result","Check multiple credible sources","Ignore it"]', 2, 'Triangulating across independent sources reduces the risk of being misled.', 2),
('d4000004-0004-4004-8004-000000000053', 'c3000003-0003-4003-8003-000000000005', 'AI-generated images sometimes show:', '["Perfect anatomy always","Consistent shadows always","Odd hands, teeth, or text artifacts","Camera EXIF data always"]', 2, 'Current AI image models often struggle with hands, small text, and consistent detail.', 3);

-- Badges
INSERT OR IGNORE INTO badges (id, slug, title, description, icon, criteria) VALUES
('e5000005-0005-4005-8005-000000000001', 'first-verification', 'First Verification', 'You completed your first content check.', 'search', 'Complete 1 verification'),
('e5000005-0005-4005-8005-000000000002', 'fact-checker-in-training', 'Fact Checker in Training', 'You completed your first lesson.', 'book-open', 'Complete 1 lesson'),
('e5000005-0005-4005-8005-000000000003', 'critical-thinker', 'Critical Thinker', 'You passed your first quiz.', 'brain', 'Pass 1 quiz'),
('e5000005-0005-4005-8005-000000000004', 'media-literacy-champion', 'Media Literacy Champion', 'You completed 3 learning modules.', 'trophy', 'Complete 3 modules'),
('e5000005-0005-4005-8005-000000000005', 'trust-builder', 'Trust Builder', 'You verified 10 pieces of content.', 'shield-check', 'Complete 10 verifications');

-- =============================================================================
-- SAMPLE ACTIVITY (demo user) — dashboard charts, history, achievements, admin
-- =============================================================================
-- DEMO_USER = 11111111-1111-4111-8111-111111111111

INSERT OR IGNORE INTO consent_records (id, user_id, granted, scope, created_at) VALUES
('f6000006-0006-4006-8006-000000000001', '11111111-1111-4111-8111-111111111111', 1, 'ai_processing', datetime('now', '-20 days'));

-- Learning progress: 3 modules touched (1 complete, 1 partial, 1 started)
INSERT OR IGNORE INTO user_learning_progress (id, user_id, module_id, progress_pct, completed, updated_at) VALUES
('f6000006-0006-4006-8006-000000000010', '11111111-1111-4111-8111-111111111111', 'a1000001-0001-4001-8001-000000000001', 100, 1, datetime('now', '-10 days')),
('f6000006-0006-4006-8006-000000000011', '11111111-1111-4111-8111-111111111111', 'a1000001-0001-4001-8001-000000000002', 60, 0, datetime('now', '-5 days')),
('f6000006-0006-4006-8006-000000000012', '11111111-1111-4111-8111-111111111111', 'a1000001-0001-4001-8001-000000000004', 100, 1, datetime('now', '-3 days')),
('f6000006-0006-4006-8006-000000000013', '11111111-1111-4111-8111-111111111111', 'a1000001-0001-4001-8001-000000000003', 30, 0, datetime('now', '-1 days'));

-- Quiz attempts
INSERT OR IGNORE INTO quiz_attempts (id, user_id, quiz_id, score, total, passed, answers, created_at) VALUES
('f6000006-0006-4006-8006-000000000020', '11111111-1111-4111-8111-111111111111', 'c3000003-0003-4003-8003-000000000001', 3, 3, 1, '[1,2,2]', datetime('now', '-10 days')),
('f6000006-0006-4006-8006-000000000021', '11111111-1111-4111-8111-111111111111', 'c3000003-0003-4003-8003-000000000004', 2, 3, 0, '[1,0,2]', datetime('now', '-4 days')),
('f6000006-0006-4006-8006-000000000022', '11111111-1111-4111-8111-111111111111', 'c3000003-0003-4003-8003-000000000004', 3, 3, 1, '[1,2,2]', datetime('now', '-3 days')),
('f6000006-0006-4006-8006-000000000023', '11111111-1111-4111-8111-111111111111', 'c3000003-0003-4003-8003-000000000002', 2, 3, 0, '[0,2,2]', datetime('now', '-2 days'));

-- Earned badges
INSERT OR IGNORE INTO user_badges (id, user_id, badge_id, awarded_at) VALUES
('f6000006-0006-4006-8006-000000000030', '11111111-1111-4111-8111-111111111111', 'e5000005-0005-4005-8005-000000000001', datetime('now', '-13 days')),
('f6000006-0006-4006-8006-000000000031', '11111111-1111-4111-8111-111111111111', 'e5000005-0005-4005-8005-000000000002', datetime('now', '-10 days')),
('f6000006-0006-4006-8006-000000000032', '11111111-1111-4111-8111-111111111111', 'e5000005-0005-4005-8005-000000000003', datetime('now', '-10 days'));

-- Sample verification requests (URLs match dashboard SAMPLE_ITEMS where possible)
INSERT OR IGNORE INTO verification_requests (id, user_id, type, input_url, input_text, status, created_at) VALUES
('f7000007-0007-4007-8007-000000000001', '11111111-1111-4111-8111-111111111111', 'url', 'https://www.reuters.com/world/sample-report', NULL, 'completed', datetime('now', '-13 days', '+9 hours')),
('f7000007-0007-4007-8007-000000000002', '11111111-1111-4111-8111-111111111111', 'url', 'https://apnews.com/article/sample-briefing', NULL, 'completed', datetime('now', '-12 days', '+10 hours')),
('f7000007-0007-4007-8007-000000000003', '11111111-1111-4111-8111-111111111111', 'url', 'https://www.bbc.co.uk/news/sample-analysis', NULL, 'completed', datetime('now', '-11 days', '+11 hours')),
('f7000007-0007-4007-8007-000000000004', '11111111-1111-4111-8111-111111111111', 'url', 'https://nature.com/articles/sample-study', NULL, 'completed', datetime('now', '-10 days', '+14 hours')),
('f7000007-0007-4007-8007-000000000005', '11111111-1111-4111-8111-111111111111', 'url', 'https://example-blog.net/you-wont-believe-this', NULL, 'completed', datetime('now', '-9 days', '+9 hours')),
('f7000007-0007-4007-8007-000000000006', '11111111-1111-4111-8111-111111111111', 'url', 'https://viral-news.example/shocking-headline', NULL, 'completed', datetime('now', '-8 days', '+16 hours')),
('f7000007-0007-4007-8007-000000000007', '11111111-1111-4111-8111-111111111111', 'url', 'https://unknown-outlet.example/breaking', NULL, 'completed', datetime('now', '-7 days', '+12 hours')),
('f7000007-0007-4007-8007-000000000008', '11111111-1111-4111-8111-111111111111', 'text', NULL, '[SAMPLE] A viral post claims a new study proves miracle cures — no citations included.', 'completed', datetime('now', '-6 days', '+10 hours')),
('f7000007-0007-4007-8007-000000000009', '11111111-1111-4111-8111-111111111111', 'text', NULL, '[SAMPLE] Official statement from the health ministry with sources listed.', 'completed', datetime('now', '-5 days', '+11 hours')),
('f7000007-0007-4007-8007-00000000000a', '11111111-1111-4111-8111-111111111111', 'text', NULL, '[SAMPLE] Anonymous forum thread alleging a conspiracy about local elections.', 'completed', datetime('now', '-4 days', '+15 hours')),
('f7000007-0007-4007-8007-00000000000b', '11111111-1111-4111-8111-111111111111', 'text', NULL, '[SAMPLE] Reuters wire quotes multiple experts on a technology trend.', 'completed', datetime('now', '-3 days', '+9 hours')),
('f7000007-0007-4007-8007-00000000000c', '11111111-1111-4111-8111-111111111111', 'image', NULL, '[SAMPLE]-portrait.jpg', 'completed', datetime('now', '-2 days', '+13 hours')),
('f7000007-0007-4007-8007-00000000000d', '11111111-1111-4111-8111-111111111111', 'image', NULL, '[SAMPLE]-infographic.png', 'completed', datetime('now', '-1 days', '+10 hours')),
('f7000007-0007-4007-8007-00000000000e', '11111111-1111-4111-8111-111111111111', 'image', NULL, '[SAMPLE]-screenshot.jpg', 'completed', datetime('now', '-2 hours'));

-- Matching verification results (varied trust categories for charts)
INSERT OR IGNORE INTO verification_results (
  id, request_id, user_id, trust_score, category, confidence, summary,
  source_assessment, context_analysis, ai_generated_detected,
  concerns, evidence, next_steps, replay_data, created_at
) VALUES
(
  'f8000008-0008-4008-8008-000000000001',
  'f7000007-0007-4007-8007-000000000001',
  '11111111-1111-4111-8111-111111111111',
  92, 'high_trust', 88.5,
  'The analysis suggests this content shows several markers of credibility. Independent verification is still recommended before sharing.',
  'Source appears in publicly maintained lists of established outlets.',
  'Tone is measured, sources are named, and the piece follows editorial standards typical of wire reporting.',
  0,
  '["Limited local context for secondary claims"]',
  '["Author information is present","Publication date is clearly stated","Domain appears in known reference lists"]',
  '["Cross-check the claim with two independent, credible sources","Look for the author''s credentials or publisher''s About page","Search the exact quote or claim to see original context"]',
  '{"nodes":[{"id":"origin","label":"reuters.com","platform":"Web","timestamp":"T+0h","reach":1,"warning":false,"connections":["amp-1"]},{"id":"amp-1","label":"Social share","platform":"X / Twitter","timestamp":"T+2h","reach":4200,"warning":false,"connections":[]}]}',
  datetime('now', '-13 days', '+9 hours')
),
(
  'f8000008-0008-4008-8008-000000000002',
  'f7000007-0007-4007-8007-000000000002',
  '11111111-1111-4111-8111-111111111111',
  88, 'high_trust', 85.0,
  'The analysis suggests this content shows several markers of credibility. Independent verification is still recommended before sharing.',
  'Source appears in publicly maintained lists of established outlets.',
  'Clear byline and dateline; claims are attributed to named officials.',
  0,
  '[]',
  '["Author information is present","Multiple independent sources reference similar facts","Content structure follows editorial standards"]',
  '["Cross-check the claim with two independent, credible sources","Look for the author''s credentials or publisher''s About page"]',
  NULL,
  datetime('now', '-12 days', '+10 hours')
),
(
  'f8000008-0008-4008-8008-000000000003',
  'f7000007-0007-4007-8007-000000000003',
  '11111111-1111-4111-8111-111111111111',
  84, 'high_trust', 82.0,
  'The analysis suggests this content shows several markers of credibility. Independent verification is still recommended before sharing.',
  'Source appears in publicly maintained lists of established outlets.',
  'Analysis piece with linked primary documents and expert quotes.',
  0,
  '["Opinion framing in the headline may be stronger than the body"]',
  '["Publication date is clearly stated","Domain appears in known reference lists"]',
  '["Cross-check the claim with two independent, credible sources","Search the exact quote or claim to see original context"]',
  NULL,
  datetime('now', '-11 days', '+11 hours')
),
(
  'f8000008-0008-4008-8008-000000000004',
  'f7000007-0007-4007-8007-000000000004',
  '11111111-1111-4111-8111-111111111111',
  90, 'high_trust', 91.0,
  'The analysis suggests this content shows several markers of credibility. Independent verification is still recommended before sharing.',
  'Source appears in publicly maintained lists of established outlets.',
  'Peer-reviewed style abstract with DOIs and methods summary.',
  0,
  '[]',
  '["Author information is present","Multiple independent sources reference similar facts","Domain appears in known reference lists"]',
  '["Look for the author''s credentials or publisher''s About page","Cross-check the claim with two independent, credible sources"]',
  NULL,
  datetime('now', '-10 days', '+14 hours')
),
(
  'f8000008-0008-4008-8008-000000000005',
  'f7000007-0007-4007-8007-000000000005',
  '11111111-1111-4111-8111-111111111111',
  28, 'potentially_misleading', 74.0,
  'The analysis suggests this content may be misleading. Multiple potential indicators of unreliable framing were detected. We strongly recommend verifying with independent sources.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Headline uses emotional/clickbait patterns; body lacks citations and primary sources.',
  0,
  '["Emotionally charged or sensational language detected","Source could not be independently verified in known credible databases","Similar claims have appeared in low-credibility outlets"]',
  '["Publication date is clearly stated"]',
  '["Cross-check the claim with two independent, credible sources","Pause before sharing","Take a lesson on spotting misleading headlines"]',
  '{"nodes":[{"id":"origin","label":"example-blog.net","platform":"Web","timestamp":"T+0h","reach":1,"warning":true,"connections":["amp-1","amp-2"]},{"id":"amp-1","label":"Viral thread","platform":"Facebook","timestamp":"T+4h","reach":28000,"warning":true,"connections":[]},{"id":"amp-2","label":"Messaging groups","platform":"WhatsApp","timestamp":"T+9h","reach":61000,"warning":true,"connections":[]}]}',
  datetime('now', '-9 days', '+9 hours')
),
(
  'f8000008-0008-4008-8008-000000000006',
  'f7000007-0007-4007-8007-000000000006',
  '11111111-1111-4111-8111-111111111111',
  35, 'potentially_misleading', 70.5,
  'The analysis suggests this content may be misleading. Multiple potential indicators of unreliable framing were detected. We strongly recommend verifying with independent sources.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Sensational framing with urgency language and no verifiable author.',
  0,
  '["Emotionally charged or sensational language detected","Limited context or missing publication date","Source could not be independently verified in known credible databases"]',
  '[]',
  '["Cross-check the claim with two independent, credible sources","Search the exact quote or claim to see original context","Take a lesson on spotting misleading headlines"]',
  NULL,
  datetime('now', '-8 days', '+16 hours')
),
(
  'f8000008-0008-4008-8008-000000000007',
  'f7000007-0007-4007-8007-000000000007',
  '11111111-1111-4111-8111-111111111111',
  48, 'low_confidence', 65.0,
  'The analysis suggests low confidence. Several potential indicators of misleading framing were detected. Pause before sharing and verify independently.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Unknown domain; partial sourcing and ambiguous claims.',
  0,
  '["Source could not be independently verified in known credible databases","Limited context or missing publication date"]',
  '["Author information is present"]',
  '["Cross-check the claim with two independent, credible sources","Look for the author''s credentials or publisher''s About page"]',
  NULL,
  datetime('now', '-7 days', '+12 hours')
),
(
  'f8000008-0008-4008-8008-000000000008',
  'f7000007-0007-4007-8007-000000000008',
  '11111111-1111-4111-8111-111111111111',
  32, 'potentially_misleading', 78.0,
  'The analysis suggests this content may be misleading. Multiple potential indicators of unreliable framing were detected. We strongly recommend verifying with independent sources.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Miracle-cure language without citations is a classic misinformation pattern.',
  0,
  '["Emotionally charged or sensational language detected","Similar claims have appeared in low-credibility outlets","Source could not be independently verified in known credible databases"]',
  '[]',
  '["Cross-check the claim with two independent, credible sources","Search the exact quote or claim to see original context","Pause before sharing"]',
  NULL,
  datetime('now', '-6 days', '+10 hours')
),
(
  'f8000008-0008-4008-8008-000000000009',
  'f7000007-0007-4007-8007-000000000009',
  '11111111-1111-4111-8111-111111111111',
  76, 'needs_verification', 72.0,
  'The analysis suggests mixed signals. Some elements look credible, but potential indicators of concern were also found. Further verification is recommended.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Official-sounding language with listed sources; original document not attached.',
  0,
  '["Limited context or missing publication date"]',
  '["Author information is present","Content structure follows editorial standards"]',
  '["Cross-check the claim with two independent, credible sources","Search the exact quote or claim to see original context"]',
  NULL,
  datetime('now', '-5 days', '+11 hours')
),
(
  'f8000008-0008-4008-8008-00000000000a',
  'f7000007-0007-4007-8007-00000000000a',
  '11111111-1111-4111-8111-111111111111',
  22, 'potentially_misleading', 81.0,
  'The analysis suggests this content may be misleading. Multiple potential indicators of unreliable framing were detected. We strongly recommend verifying with independent sources.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Anonymous conspiracy framing with no primary evidence.',
  0,
  '["Emotionally charged or sensational language detected","Source could not be independently verified in known credible databases","Similar claims have appeared in low-credibility outlets"]',
  '[]',
  '["Pause before sharing","Cross-check the claim with two independent, credible sources","Take a lesson on spotting misleading headlines"]',
  NULL,
  datetime('now', '-4 days', '+15 hours')
),
(
  'f8000008-0008-4008-8008-00000000000b',
  'f7000007-0007-4007-8007-00000000000b',
  '11111111-1111-4111-8111-111111111111',
  81, 'high_trust', 80.0,
  'The analysis suggests this content shows several markers of credibility. Independent verification is still recommended before sharing.',
  'Source appears in publicly maintained lists of established outlets.',
  'Multiple named experts and a clear original wire-style structure.',
  0,
  '[]',
  '["Author information is present","Multiple independent sources reference similar facts","Publication date is clearly stated"]',
  '["Cross-check the claim with two independent, credible sources"]',
  NULL,
  datetime('now', '-3 days', '+9 hours')
),
(
  'f8000008-0008-4008-8008-00000000000c',
  'f7000007-0007-4007-8007-00000000000c',
  '11111111-1111-4111-8111-111111111111',
  55, 'needs_verification', 68.0,
  'The analysis suggests mixed signals. Some elements look credible, but potential indicators of concern were also found. Further verification is recommended.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Portrait image without EXIF or provenance metadata.',
  1,
  '["Image shows possible signs of AI generation or editing","Limited context or missing publication date"]',
  '["Author information is present"]',
  '["Use a reverse image search if the piece includes visuals","Cross-check the claim with two independent, credible sources"]',
  NULL,
  datetime('now', '-2 days', '+13 hours')
),
(
  'f8000008-0008-4008-8008-00000000000d',
  'f7000007-0007-4007-8007-00000000000d',
  '11111111-1111-4111-8111-111111111111',
  62, 'needs_verification', 66.5,
  'The analysis suggests mixed signals. Some elements look credible, but potential indicators of concern were also found. Further verification is recommended.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Infographic claims numbers without linked datasets.',
  0,
  '["Limited context or missing publication date"]',
  '["Content structure follows editorial standards"]',
  '["Search the exact quote or claim to see original context","Cross-check the claim with two independent, credible sources"]',
  NULL,
  datetime('now', '-1 days', '+10 hours')
),
(
  'f8000008-0008-4008-8008-00000000000e',
  'f7000007-0007-4007-8007-00000000000e',
  '11111111-1111-4111-8111-111111111111',
  44, 'low_confidence', 63.0,
  'The analysis suggests low confidence. Several potential indicators of misleading framing were detected. Pause before sharing and verify independently.',
  'Source credibility could not be strongly established. Further checks are recommended.',
  'Screenshot of a post; original account and timestamp not verifiable from the image alone.',
  0,
  '["Source could not be independently verified in known credible databases","Limited context or missing publication date"]',
  '[]',
  '["Use a reverse image search if the piece includes visuals","Cross-check the claim with two independent, credible sources","Pause before sharing"]',
  NULL,
  datetime('now', '-2 hours')
);

-- Analytics events (admin / product metrics)
INSERT OR IGNORE INTO analytics_events (id, user_id, event_type, payload, created_at) VALUES
('f9000009-0009-4009-8009-000000000001', '11111111-1111-4111-8111-111111111111', 'verification_completed', '{"request_id":"f7000007-0007-4007-8007-000000000001","score":92}', datetime('now', '-13 days', '+9 hours')),
('f9000009-0009-4009-8009-000000000002', '11111111-1111-4111-8111-111111111111', 'lesson_completed', '{"module_id":"a1000001-0001-4001-8001-000000000001"}', datetime('now', '-10 days')),
('f9000009-0009-4009-8009-000000000003', '11111111-1111-4111-8111-111111111111', 'quiz_passed', '{"quiz_id":"c3000003-0003-4003-8003-000000000001","score":100}', datetime('now', '-10 days')),
('f9000009-0009-4009-8009-000000000004', '11111111-1111-4111-8111-111111111111', 'verification_completed', '{"request_id":"f7000007-0007-4007-8007-000000000005","score":28}', datetime('now', '-9 days', '+9 hours')),
('f9000009-0009-4009-8009-000000000005', '11111111-1111-4111-8111-111111111111', 'badge_awarded', '{"badge":"critical-thinker"}', datetime('now', '-10 days'));

-- One open moderation report for the admin panel
INSERT OR IGNORE INTO moderation_reports (id, reporter_id, verification_result_id, reason, status, notes, created_at) VALUES
(
  'fa00000a-000a-400a-800a-000000000001',
  '11111111-1111-4111-8111-111111111111',
  'f8000008-0008-4008-8008-000000000005',
  'User flagged analysis as too harsh on a satirical blog post',
  'open',
  'Review category threshold for satire domains.',
  datetime('now', '-8 days')
);

-- Extra learner for admin user lists
INSERT OR IGNORE INTO users (id, email, full_name, password_hash, raw_user_meta_data) VALUES
(
  '11111111-1111-4111-8111-111111111112',
  'amina@trustlensai.app',
  'Amina Learner',
  'a8a688ab9d9d2681579f4a6aba21beae6860773c27e0e97f2308f0ddfef47b3f',
  '{"full_name":"Amina Learner"}'
);
INSERT OR IGNORE INTO profiles (id, full_name, email, preferred_language, ai_consent, notification_email, created_at) VALUES
(
  '11111111-1111-4111-8111-111111111112',
  'Amina Learner',
  'amina@trustlensai.app',
  'en',
  1,
  1,
  datetime('now', '-7 days')
);
INSERT OR IGNORE INTO user_roles (id, user_id, role) VALUES
('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111112', 'user');
INSERT OR IGNORE INTO user_learning_progress (id, user_id, module_id, progress_pct, completed, updated_at) VALUES
('f6000006-0006-4006-8006-000000000014', '11111111-1111-4111-8111-111111111112', 'a1000001-0001-4001-8001-000000000001', 40, 0, datetime('now', '-2 days'));
INSERT OR IGNORE INTO verification_requests (id, user_id, type, input_url, input_text, status, created_at) VALUES
('f7000007-0007-4007-8007-0000000000f1', '11111111-1111-4111-8111-111111111112', 'url', 'https://www.bbc.co.uk/news/sample-learner', NULL, 'completed', datetime('now', '-1 days'));
INSERT OR IGNORE INTO verification_results (
  id, request_id, user_id, trust_score, category, confidence, summary,
  source_assessment, context_analysis, ai_generated_detected,
  concerns, evidence, next_steps, replay_data, created_at
) VALUES
(
  'f8000008-0008-4008-8008-0000000000f1',
  'f7000007-0007-4007-8007-0000000000f1',
  '11111111-1111-4111-8111-111111111112',
  79, 'needs_verification', 75.0,
  'The analysis suggests mixed signals. Some elements look credible, but potential indicators of concern were also found. Further verification is recommended.',
  'Source appears in publicly maintained lists of established outlets.',
  'Short news brief; secondary claims need independent confirmation.',
  0,
  '["Limited context or missing publication date"]',
  '["Domain appears in known reference lists","Publication date is clearly stated"]',
  '["Cross-check the claim with two independent, credible sources"]',
  NULL,
  datetime('now', '-1 days')
);
