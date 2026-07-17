
# TrustLensAI — Build Plan

A full-scope web MVP with auth, verification (mock AI), learning modules, quizzes, badges, TrustReplay, and admin dashboard. This is a large build, so I'll break it into phases and ship them in order. You can stop me at any phase to adjust.

## Stack

- TanStack Start (React 19 + TypeScript, already scaffolded)
- Tailwind CSS v4 with semantic design tokens (navy/teal/white/gray in `src/styles.css`)
- Lovable Cloud (Supabase under the hood) — auth, Postgres, Storage, RLS
- Mock AI service in `src/lib/ai/` — swappable for OpenAI/Gemini later
- shadcn/ui components with custom variants

## Phase 1 — Foundation
- Enable Lovable Cloud
- Design system: navy/teal palette, TrustScore color tokens, typography, shadows in `src/styles.css`
- Landing page (`/`) — hero, feature cards, disclaimer, nav, footer
- Public routes: `/about`, plus SEO metadata per route

## Phase 2 — Auth + Profiles
- Email/password sign up + login + forgot/reset password
- Google OAuth (via Lovable broker) — optional, can skip if you prefer email-only
- `profiles` table (full_name, preferred_language, avatar_url) with auto-create trigger
- `user_roles` table + `has_role()` security definer (admin/user enum)
- `consent_records` table with AI processing consent checkbox gate
- `_authenticated/` protected subtree, admin subtree gated via `has_role`

## Phase 3 — Verify + Results + Pause Before Sharing
- `/verify` with three tabs (URL / Text / Image), drag-drop upload → Supabase Storage
- Mock AI service returns `{ score, category, confidence, explanation, sources, concerns, suggestions }`
- `/verify/$id` results page: circular gauge, category, explainable breakdown, evidence
- "Pause Before Sharing" modal for Low Confidence / Potentially Misleading
- Tables: `verification_requests`, `verification_results`, `uploaded_content`

## Phase 4 — Dashboard + TrustReplay
- User dashboard: welcome, quick actions, recent verifications, progress, badges, stats
- `/trust-replay/$id` — timeline + source/spread node graph (SVG-based, mock data)

## Phase 5 — Learning + Quizzes + Badges
- Learning Center with 5 sample lessons (seeded via migration)
- Lesson detail + quiz flow with multiple choice, score tracking
- Badges: 5 sample badges, auto-award on milestones (DB trigger)
- Achievements page — earned vs locked
- Tables: `learning_modules`, `lessons`, `quizzes`, `quiz_questions`, `quiz_attempts`, `user_learning_progress`, `badges`, `user_badges`

## Phase 6 — Profile/Settings + Admin
- Profile & settings: edit info, avatar upload, consent management, delete data, notification prefs
- Admin dashboard at `/_authenticated/admin/*`: KPIs, TrustScore distribution chart, user table, module management, moderation queue, audit log stub
- Tables: `analytics_events`, `moderation_reports`

## Explainable AI + Safety
- All copy uses hedged language ("analysis suggests", "potential indicators")
- Visible AI disclaimer on results, landing, and consent flow
- No content is ever labeled "true"/"false"

## Security
- RLS on every user-data table scoped to `auth.uid()`
- Admin-only tables gated with `has_role(auth.uid(),'admin')`
- All schema migrations include GRANT statements
- Storage bucket `verification-uploads` private with owner-only policies
- Zod validation on all form inputs and server functions

## Design tokens (src/styles.css)
```text
--navy: deep navy blue background/foreground on dark surfaces
--teal: primary accent
--trust-high (green), --trust-medium (amber),
--trust-low (orange), --trust-danger (red)
```

## Questions before I start

1. **Google sign-in?** Add Google OAuth alongside email/password, or email/password only for now?
2. **First admin user?** After you sign up, I'll need to promote your account to admin — I can do this via a seed script that grants admin to the first registered user, or you can tell me an email to hardcode as admin at signup.
3. **Scope confirmation:** This is ~15–20 route files, ~14 DB tables, and several hours of iterative build. I'll ship it phase-by-phase and pause after Phase 3 so you can try the core verify flow before I continue. OK?

Say "go" (with answers to the above) and I'll start with Phase 1 + 2.
