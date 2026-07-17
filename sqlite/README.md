# Local SQLite (pre-Supabase)

The app defaults to **local SQLite** so you can develop without a cloud project.
The schema mirrors Supabase `public` tables for a clean migration later.

## Quick start

```bash
npm run db:init    # create data/trustlens.db + seed
npm run db:reset   # wipe and recreate
npm run dev        # VITE_DB_PROVIDER=sqlite (see .env)
```

Database file: `data/trustlens.db` (gitignored).

### Demo login

| Account | Password | Role |
|---------|----------|------|
| `demo@trustlensai.app` | `demo-trustlens-2026` | Admin + full sample history |
| `learner@trustlensai.app` | `demo-trustlens-2026` | Regular learner |

Or click **Try the demo** on `/auth` (demo admin).

### Sample data included

For the demo admin user:

- **14** verification requests/results (URLs, text, images; high → misleading mix over ~2 weeks)
- **4** quiz attempts, **4** learning progress rows
- **3** earned badges, consent record, analytics events
- **1** open moderation report (admin panel)
- Second user **Amina Learner** with light activity for admin lists

```bash
npm run db:reset   # wipe + reseed everything
npm run db:init    # apply schema/seed if missing (INSERT OR IGNORE)
```

## How the app is wired

| Piece | Role |
|-------|------|
| `src/lib/db.ts` | Provider switch (`sqlite` \| `supabase`) |
| `src/lib/sqlite/client.ts` | Browser client (Supabase-like `from` / `auth` / `storage`) |
| `src/lib/sqlite/server-db.ts` | Node `node:sqlite` query engine |
| `src/lib/sqlite/api-handler.ts` | HTTP API at `/api/local/*` |
| `vite.config.ts` | Dev middleware for `/api/local` |
| `src/server.ts` | Same API for production SSR entry |

## Switch to Supabase

1. Create a Supabase project and apply `supabase/migrations/`.
2. In `.env`:

```env
VITE_DB_PROVIDER=supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. Restart `npm run dev`. Route code stays the same (`db.from(...)`, `supabase.auth...`).

## Layout

| File | Purpose |
|------|---------|
| `schema.sql` | Tables matching `supabase/migrations` |
| `seed.sql` | Learning modules, quizzes, badges, demo user |
| `../scripts/init-sqlite.mjs` | Applies schema + seed via Node `node:sqlite` |

## Mapping to Supabase

| SQLite | Supabase |
|--------|----------|
| `users` | `auth.users` |
| `profiles`, `user_roles`, … | same names in `public` |
| `TEXT` UUIDs | `UUID` |
| `INTEGER` 0/1 | `BOOLEAN` |
| `TEXT` JSON | `JSONB` |
| `TEXT` timestamps | `TIMESTAMPTZ` |
| `CHECK (...)` enums | Postgres `ENUM` types |
| App-level access control | RLS policies |
| `data/uploads/` | Supabase Storage buckets |
