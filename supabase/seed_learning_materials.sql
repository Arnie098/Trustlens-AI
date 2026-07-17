-- =============================================================================
-- TrustLensAI — Sample learning materials (paste into Supabase SQL Editor)
-- Replaces placeholder lesson bodies with full multi-section content
-- and module-specific quiz questions.
-- Safe to re-run.
-- =============================================================================

-- Keep module metadata sharp
UPDATE public.learning_modules SET
  title = 'How to Spot Misleading Headlines',
  description = 'Recognize sensational headlines, missing context, and common clickbait patterns.',
  estimated_minutes = 10
WHERE slug = 'spot-misleading-headlines';

UPDATE public.learning_modules SET
  title = 'Verifying Images and Videos Online',
  description = 'Learn reverse image search, context checks, and basic metadata inspection.',
  estimated_minutes = 14
WHERE slug = 'verify-images-videos';

UPDATE public.learning_modules SET
  title = 'Understanding AI-Generated Content',
  description = 'Spot common AI text and image tells — and know the limits of detection.',
  estimated_minutes = 12
WHERE slug = 'understanding-ai-content';

UPDATE public.learning_modules SET
  title = 'Checking Source Credibility',
  description = 'Evaluate publishers, authors, citations, and transparency practices.',
  estimated_minutes = 12
WHERE slug = 'source-credibility';

UPDATE public.learning_modules SET
  title = 'Thinking Before Sharing',
  description = 'Build pause habits that reduce the spread of misleading content.',
  estimated_minutes = 8
WHERE slug = 'think-before-sharing';

-- Wipe existing lessons for these modules, then re-insert rich content
DELETE FROM public.lessons
WHERE module_id IN (SELECT id FROM public.learning_modules);

INSERT INTO public.lessons (module_id, title, body, sort_order)
SELECT m.id, v.title, v.body, v.sort_order
FROM public.learning_modules m
JOIN (
  VALUES
  -- ========== MODULE 1: headlines ==========
  (
    'spot-misleading-headlines',
    1,
    'Why headlines mislead',
    $m1l1$
## Why this matters
Headlines are designed to compete for attention. That incentive can push writers toward emotional, incomplete, or exaggerated framing — even when the article body is more careful.

## Common patterns
- ALL CAPS, multiple exclamation points, or words like "shocking", "unbelievable", "they don't want you to know"
- Absolute claims with no source: "Scientists prove…", "Everyone is saying…"
- Missing who / when / where — the classic "context gap"
- Questions that imply a scandal without stating a verifiable fact

## Practice
When you feel a strong emotional reaction to a headline, pause. Open the full piece and ask: does the body actually support the headline, or only tease it?

## Key takeaway
Treat the headline as a claim to check — not as proof.
$m1l1$
  ),
  (
    'spot-misleading-headlines',
    2,
    'A quick headline checklist',
    $m1l2$
## 60-second checklist
1. Who published this? Is the outlet known for corrections and bylines?
2. Does the headline name a specific person, study, place, or date?
3. Are there loaded emotional words that could be removed without losing the fact?
4. Can you find the same claim on two independent reputable outlets?
5. Is this an opinion / analysis label that is being presented as hard news?

## Example (fictional)
"YOU WON'T BELIEVE What This Miracle Herb Does Overnight!!!"
→ Red flags: miracle language, urgency, no named study, pure emotion.

Vs. "Small trial of compound X shows modest blood-pressure drop, researchers say"
→ Names a limited claim and frames uncertainty.

## Key takeaway
If removing the emotional words leaves almost nothing concrete, be skeptical.
$m1l2$
  ),
  (
    'spot-misleading-headlines',
    3,
    'What to do next',
    $m1l3$
## Healthy next steps
- Read past the headline before sharing
- Search the exact claim in quotes plus a trusted outlet name
- Look for original documents (papers, official statements)
- Use TrustLensAI for a second pass of signals — then verify independently

## Remember
TrustLens scores are educational signals, not final verdicts.
$m1l3$
  ),

  -- ========== MODULE 2: images/videos ==========
  (
    'verify-images-videos',
    1,
    'Images can lie without editing',
    $m2l1$
## The problem
A real photo can still mislead if it is shown with the wrong caption, date, or place. Editing is only one risk; out-of-context reuse is extremely common.

## Red flags
- Dramatic claim with a stock-looking image
- No photographer credit or original post
- "Forwarded many times" messaging screenshots
- Video clips with no full context or original upload date

## Key takeaway
Always ask: is this image/video from the event being described?
$m2l1$
  ),
  (
    'verify-images-videos',
    2,
    'Reverse image search & context',
    $m2l2$
## Practical techniques
1. Reverse image search (Google Images, TinEye, Yandex) to find earlier appearances
2. Check whether the first known use matches the claim's date and location
3. Look for EXIF/metadata when available (often stripped on social platforms)
4. For video: search distinctive phrases, signs, or landmarks visible in the frame
5. Prefer primary sources (official accounts, wire services, original livestreams)

## Example workflow
You see a photo of a flood labeled "today in City A". Reverse search shows the same photo from three years ago in City B. Conclusion: the image is real, but the caption is not.

## Key takeaway
Provenance beats vibes: find the earliest trustworthy appearance.
$m2l2$
  ),
  (
    'verify-images-videos',
    3,
    'Deepfakes and edited media',
    $m2l3$
## What to watch for
- Unnatural blinking, warped hands, melted backgrounds
- Mismatched lip-sync or lighting
- Text artifacts or warped logos
- Audio that sounds slightly off or too clean for the setting

## Limits of detection
Tools and human eyes both make mistakes. Treat "looks AI" as a signal, not proof. Seek corroboration from reputable outlets when stakes are high.

## Key takeaway
Combine visual checks with independent reporting — never rely on a single tell.
$m2l3$
  ),

  -- ========== MODULE 3: AI content ==========
  (
    'understanding-ai-content',
    1,
    'How AI content shows up online',
    $m3l1$
## Where you will meet AI content
- Social posts and comment spam
- "News-like" articles rewritten from thin sources
- Synthetic profile photos and product images
- Political memes and fabricated quotes

## Why it spreads
AI lowers the cost of producing fluent text and persuasive images. Quantity + emotional framing can overwhelm careful readers.

## Key takeaway
Fluency is not the same as truthfulness.
$m3l1$
  ),
  (
    'understanding-ai-content',
    2,
    'Signals in AI text and images',
    $m3l2$
## Text signals (imperfect)
- Generic, balanced-sounding prose with no concrete details
- Invented citations or links that do not resolve
- Overconfident claims without named primary sources
- Sudden style shifts mid-thread

## Image signals (imperfect)
- Distorted hands, teeth, jewelry, or small text
- Inconsistent shadows or reflections
- Odd backgrounds that "melt" at edges

## Important caution
Human writing can look generic; AI can look specific. Use signals as prompts to investigate further.

## Key takeaway
Ask for sources you can independently open and check.
$m3l2$
  ),
  (
    'understanding-ai-content',
    3,
    'Responsible use of AI checkers',
    $m3l3$
## Using TrustLensAI well
TrustLensAI surfaces media-literacy signals and suggested next steps. It may miss things or flag innocent content.

## Good habits
- Never present an AI score as courtroom proof
- Prefer primary documents and multiple outlets
- Disclose uncertainty when you share analysis with others

## Key takeaway
AI can assist judgment; it should not replace it.
$m3l3$
  ),

  -- ========== MODULE 4: source credibility ==========
  (
    'source-credibility',
    1,
    'Who is speaking?',
    $m4l1$
## Questions that matter
- Who owns or funds the publisher?
- Is there a named author with real expertise?
- Does the site publish corrections and contact information?
- Are claims linked to primary documents?

## Stronger sources (generally)
Established wire services, peer-reviewed journals, official government/statistical agencies, and outlets with clear editorial standards.

## Weaker sources (generally)
Anonymous blogs, pure social virality, "document dumps" with no chain of custody, and sites that only publish outrage.

## Key takeaway
Authority is earned through transparency and track record — not just a professional design.
$m4l1$
  ),
  (
    'source-credibility',
    2,
    'Citations, dates, and evidence',
    $m4l2$
## Check the evidence trail
1. Follow links — do they support the claim or only vaguely relate?
2. Prefer primary sources over screenshots of screenshots
3. Note publication and update dates
4. Watch for outdated studies presented as current
5. Spot single-source stories that major outlets are not covering at all

## "Study says" claims
Find the original paper or pre-print. Read the sample size, funding, and limitations. Media summaries often overstate results.

## Key takeaway
A citation is only useful if you can verify what it actually says.
$m4l2$
  ),
  (
    'source-credibility',
    3,
    'Bias without conspiracy',
    $m4l3$
## Framing bias
Even serious outlets select which stories to cover and which words to use. Bias does not automatically mean fabrication — but it does mean you should compare frames.

## Healthy approach
- Read across the spectrum for major claims
- Separate facts (who / what / when) from interpretation
- Be extra careful when a story perfectly confirms your existing beliefs

## Key takeaway
Seek disconfirming evidence on purpose.
$m4l3$
  ),

  -- ========== MODULE 5: sharing habits ==========
  (
    'think-before-sharing',
    1,
    'Why speed spreads harm',
    $m5l1$
## The sharing impulse
Outrage, fear, and novelty make us hit "share" before we check. Platforms amplify content that triggers engagement — not necessarily accuracy.

## Cost of a quick share
Even a later deletion rarely undoes the first wave of forwards. Your network may trust you more than the original source.

## Key takeaway
Your share is a recommendation — treat it like one.
$m5l1$
  ),
  (
    'think-before-sharing',
    2,
    'A practical pause routine',
    $m5l2$
## The 5-question pause
1. What emotion is this trying to create in me?
2. Can I name the original source?
3. Have two independent reputable outlets confirmed it?
4. What would change if this turned out to be false?
5. Am I sharing to inform — or to vent?

## If you cannot answer
Do not share yet. Save the link, verify, then decide.

## Key takeaway
A two-minute pause beats a two-day correction.
$m5l2$
  ),
  (
    'think-before-sharing',
    3,
    'How to correct gracefully',
    $m5l3$
## If you shared something wrong
- Correct in the same thread/chat when possible
- Link a better source without shaming people who trusted you
- Model the behavior you want in your community

## Building a culture of verification
Praise careful checking. Ask "source?" kindly. Use tools like TrustLensAI as a conversation starter, not a gavel.

## Key takeaway
Humility is a media-literacy skill.
$m5l3$
  )
) AS v(slug, sort_order, title, body)
  ON m.slug = v.slug;

-- ========== Module-specific quiz questions ==========
-- Remove existing questions for TrustLens quizzes, then insert tailored ones
DELETE FROM public.quiz_questions
WHERE quiz_id IN (
  SELECT q.id
  FROM public.quizzes q
  JOIN public.learning_modules m ON m.id = q.module_id
);

INSERT INTO public.quiz_questions (quiz_id, question, options, correct_index, explanation, sort_order)
SELECT q.id, v.question, v.options::jsonb, v.correct_index, v.explanation, v.sort_order
FROM public.quizzes q
JOIN public.learning_modules m ON m.id = q.module_id
JOIN (
  VALUES
  -- Module 1
  ('spot-misleading-headlines', 1,
   'Which is a red flag in a headline?',
   '["States clear facts with named sources","Uses ALL CAPS and emotional words","Includes a publication date","Links to a primary study"]',
   1,
   'Emotional language and all-caps often signal clickbait rather than careful reporting.'),
  ('spot-misleading-headlines', 2,
   'A good first step when a headline makes you angry is to:',
   '["Share it immediately so others know","Read the full article and check sources","Trust the first comment you see","Ignore all news forever"]',
   1,
   'Slow down, read past the headline, and look for independent confirmation.'),
  ('spot-misleading-headlines', 3,
   'If removing emotional words leaves almost no concrete claim, the headline is likely:',
   '["Highly trustworthy","Carefully peer-reviewed","Weak or misleading","Always illegal"]',
   2,
   'Strong feelings without specifics are a classic misleading pattern.'),

  -- Module 2
  ('verify-images-videos', 1,
   'A real photo can still mislead when it is:',
   '["Taken in daylight","Shown with the wrong date or location caption","Published by a wire service","Saved as JPEG"]',
   1,
   'Out-of-context reuse is one of the most common image deceptions.'),
  ('verify-images-videos', 2,
   'Reverse image search is mainly used to:',
   '["Improve photo resolution","Find earlier appearances of the same image","Delete the original post","Translate text in images"]',
   1,
   'It helps establish provenance and whether the caption matches the original context.'),
  ('verify-images-videos', 3,
   'Warped hands or melted backgrounds in an image may indicate:',
   '["Perfect camera focus","Possible AI generation or heavy editing","That the photo is automatically true","Nothing useful"]',
   1,
   'These are imperfect signals that warrant further checks, not automatic proof.'),

  -- Module 3
  ('understanding-ai-content', 1,
   'Fluent, confident writing automatically means the content is true.',
   '["True","False","Only on social media","Only for science topics"]',
   1,
   'AI and humans can both produce fluent falsehoods. Fluency is not evidence.'),
  ('understanding-ai-content', 2,
   'Which is a better response to suspected AI-generated misinformation?',
   '["Repost it with laughing emojis","Demand primary sources and corroboration","Assume detectors are always correct","Ban all AI tools"]',
   1,
   'Seek independent sources and primary documents; detection tools have limits.'),
  ('understanding-ai-content', 3,
   'Invented citations that do not resolve are a signal of:',
   '["Strong scholarship","Possible low-quality or AI-generated text","Guaranteed human authorship","Government approval"]',
   1,
   'Fake references are a known failure mode of generative text systems.'),

  -- Module 4
  ('source-credibility', 1,
   'A transparent news outlet typically provides:',
   '["Only anonymous posts","Bylines, contact info, and correction practices","No dates","Unlimited ads only"]',
   1,
   'Transparency about who wrote and how errors are fixed builds accountability.'),
  ('source-credibility', 2,
   'When a post says "a study proves", you should first:',
   '["Share the summary","Find and skim the original study or official summary","Trust the meme format","Count the likes"]',
   1,
   'Media summaries often overstate findings; check the primary source.'),
  ('source-credibility', 3,
   'Comparing coverage across independent outlets helps you detect:',
   '["Wi-Fi passwords","Framing differences and unsupported claims","Printer ink levels","Battery health"]',
   1,
   'Cross-checking reduces reliance on a single frame or error.'),

  -- Module 5
  ('think-before-sharing', 1,
   'Your share is best thought of as:',
   '["Harmless noise","A recommendation to your network","Proof the claim is true","Required by platforms"]',
   1,
   'People often trust you more than the original poster — share carefully.'),
  ('think-before-sharing', 2,
   'A useful pause question is:',
   '["How angry am I and who benefits if I share this uncritically?","How can I get more likes?","Which filter looks best?","How do I mute corrections?"]',
   0,
   'Noticing emotion and incentives reduces impulsive resharing.'),
  ('think-before-sharing', 3,
   'If you shared something false, a responsible step is to:',
   '["Delete silently and hope no one noticed","Correct in the same place and link a better source","Double down","Blame the algorithm only"]',
   1,
   'Clear corrections in the same thread reduce ongoing harm.')
) AS v(slug, sort_order, question, options, correct_index, explanation)
  ON m.slug = v.slug;

-- Ensure quizzes exist / titles refreshed
UPDATE public.quizzes q
SET title = m.title || ' Quiz',
    pass_score = 70
FROM public.learning_modules m
WHERE q.module_id = m.id;

SELECT
  'Learning materials seeded' AS status,
  (SELECT count(*) FROM public.lessons) AS lessons,
  (SELECT count(*) FROM public.quiz_questions) AS questions;
