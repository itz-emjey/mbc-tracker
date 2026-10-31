# MBC Arena

Club management and badminton competition platform for **Matag-ob Badminton Club**.

Phase 1 delivers the foundation: real Supabase authentication, pending → approved registration,
multi-role accounts, the one-time 1,000 ShuttlePower (SP) award, and an admin screen for approvals
and access changes. Phase 2 adds the club directory: searchable players, staff-managed records,
player profiles, account linking, and role editing. Product requirements live in `AGENT.md`; the
approved plan and current status live in `PLAN.md`.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS, React Router |
| Backend | Supabase (Postgres, Auth, RLS, SQL RPCs) |
| Business logic | Postgres functions — there is **no application server** (decision D1) |
| Tests | Vitest (frontend units), PGlite (real Postgres for SQL/RLS checks) |
| Hosting | Any static host (Vercel free tier is the plan) |

## Prerequisites

- Node.js **>= 20.19** and npm
- A Supabase project you own (free tier is fine)
- No Docker, database password, or service-role key is needed for local development

## Repository layout

```
frontend/    React app; one typed Supabase client, no service-role key
backend/     SQL only: migrations, policies, seeds, local PGlite test harness
AGENT.md     product requirements and business rules
PLAN.md      approved implementation plan, decisions, and status
```

## 1. Install dependencies

```bash
npm install
npm --prefix frontend install
```

## 2. Configure environment variables

```bash
cp frontend/.env.example frontend/.env.local
```

Fill `frontend/.env.local` from **Supabase → Project Settings → API**:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable / anon key |

Never put the service-role key or an `sb_secret_…` key in a `VITE_` variable — anything in the
frontend is public. `.env.local` is gitignored and must stay uncommitted.

Check the connection:

```bash
npm --prefix frontend run check:supabase
```

## 3. Apply the database SQL

In **Supabase → SQL Editor**, as the project owner, run these files in order:

```
backend/migrations/001_identity.sql
backend/migrations/002_shuttlepower_bootstrap.sql
backend/policies/001_identity.sql
backend/policies/002_operations.sql
backend/policies/003_shuttlepower.sql
backend/migrations/003_auth_lifecycle.sql
backend/policies/004_auth_lifecycle.sql
backend/migrations/004_players.sql
```

The migrations are **not** idempotent: re-running one fails at the first `CREATE` by design. There
are no manual dashboard schema edits.

## 4. Optional: load the development seed

The seed adds a complete demo dataset — six fictional accounts covering all four roles, one pending
registration, one suspended account, six player records (five linked accounts plus one unlinked active
player), and five 1,000 SP starting awards.

Mark the project as development **once** (the seed refuses any project without this marker):

```sql
insert into public.app_settings (key, value)
values ('club.environment', '"development"'::jsonb)
on conflict (key) do update set value = excluded.value;
```

Then run `backend/seeds/001_fictional_players.sql`. Both steps are idempotent, and the seed never
overwrites changes made through the app. Re-running it also repairs seeded auth rows that would otherwise
make sign-in fail with `500 Database error querying schema`: it fills every NULL column GoTrue scans into a
non-nullable field — the token/change strings, plus `is_sso_user`, `is_anonymous` (bool) and
`email_change_confirm_status` (int) — with `''`, `false`, and `0`. Columns with a unique index (such as
hosted `auth.users.phone`, `users_phone_key`) are skipped, since demo rows cannot share one empty value. Demo accounts use `@example.test` addresses and
the development-only password `mbc-demo-2026`:

| Account | Role | Status |
| --- | --- | --- |
| `ada.demo@example.test` | Super Admin | active |
| `ben.sample@example.test` | Tournament Manager | active |
| `cleo.placeholder@example.test` | Trainer | active |
| `drew.testcase@example.test` | Player | active |
| `erin.pending@example.test` | none (awaiting approval) | pending |
| `finn.suspended@example.test` | Player | suspended |

The seed also creates an unlinked active player, **Gabi Walkin**, so a Super Admin can exercise the
account-link flow after unlinking an approved member. That player has no SP account until it is linked
and funded.

## 5. Create the first Super Admin (one time)

There is no public Super Admin signup, and approval needs an existing Super Admin, so the first one
is granted by hand (decision D8):

1. Create or invite the account in **Supabase → Authentication → Users** and confirm it (or register
   through the app and confirm the email), then sign in once so its `profiles` row exists.
2. In the SQL Editor, run the `set` line and the contents of `backend/seeds/bootstrap_super_admin.sql`
   **in the same execution**, replacing the address:

```sql
set mbc.bootstrap_super_admin_email = 'owner@example.com';
-- then paste backend/seeds/bootstrap_super_admin.sql below this line and run
```

The script activates the profile, grants `super_admin` once, and writes one audit row. Re-running it
is a no-op; an unknown address or a suspended account fails loudly. It creates no function or
endpoint, so no client can call it.

## 6. Run the app

```bash
npm --prefix frontend run dev
```

Open the printed URL (Vite defaults to `http://localhost:5173`), sign in, and Super Admins land on
`/admin` for approvals and access changes. Every approved member can open **Players** for the club
directory, and the account menu's **My profile** opens the signed-in member's linked player record.

## Tests and checks

```bash
npm run test:db                       # 90 SQL checks on real Postgres (PGlite), no Docker
npm --prefix frontend test            # 71 frontend unit tests (Vitest)
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

`npm run test:db` applies all four migrations and all four policy files to a real PostgreSQL engine,
stubs Supabase Auth (`auth.users`, `auth.uid()`), and covers schema, RLS, column privileges,
ownership/privacy negatives, approval idempotency, starting SP, player role/link RPCs, and the
development seed and bootstrap scripts.

## Security notes

- The browser only ever holds the anon/publishable key; RLS and RPC guards authorize every read and
  write. The service-role key is never used by the frontend.
- `sp_transactions` is append-only; clients cannot write SP, roles, or audit logs.
- Players read only their own profile and private records.
- Seed data is fictional. Never add real member data, email addresses, or phone numbers.
- Email confirmation is disabled for development. Production must enable it.

## Current status

Phase 1 (Groups A-J) and Phase 2 (Groups K-M) are implemented and verified locally. Group M added an
unlinked demo player, refreshed/validated the committed database types, and completed the final docs and
check suite. Migration 004 is applied and its three RPCs are verified (anon is denied); the hosted policy 004
check and Phase 1 walkthrough remain open. Remaining hosted steps and open product decisions (SP formulas
and seasons) are tracked in `PLAN.md` §9 and §7.
