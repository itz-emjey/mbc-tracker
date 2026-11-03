# MBC Arena

Club management and badminton competition platform for **Matag-ob Badminton Club**.

Phase 1 delivers the foundation: real Supabase authentication, pending → approved registration,
multi-role accounts, the one-time 1,000 ShuttlePower (SP) award, and an admin screen for approvals
and access changes. Phase 2 adds the club directory: searchable players, staff-managed records,
player profiles, account linking, and role editing. Phase 3 adds the tournament console: events,
entries, draws, brackets, and official results. Phase 4 delivers ShuttlePower: versioned rule
configuration, the leaderboard, personal SP history, and live friendly and tournament awards under the
club-approved formula. Product requirements live in `AGENT.md`; the approved plan and
current status live in `PLAN.md`.

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
backend/migrations/005_tournaments.sql
backend/policies/005_tournaments.sql
backend/migrations/006_shuttlepower_rules.sql
backend/policies/006_shuttlepower_rules.sql
backend/migrations/007_training.sql
backend/policies/007_training.sql
backend/migrations/008_club_activities.sql
backend/policies/008_club_activities.sql
backend/migrations/009_jersey_images.sql
backend/policies/009_jersey_images.sql
backend/migrations/010_friendly_matches.sql
backend/policies/010_friendly_matches.sql
backend/migrations/011_friendly_sp_award.sql
backend/migrations/012_seasons.sql
backend/policies/012_seasons.sql
backend/migrations/013_players_friends_notifications.sql
backend/policies/013_players_social.sql
backend/migrations/014_tournament_registration.sql
backend/policies/014_tournament_registration.sql
backend/migrations/015_payment_receipts.sql
backend/policies/015_payment_receipts.sql
backend/migrations/016_approved_sp_rule.sql
backend/migrations/017_tournament_sp_award.sql
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

### Ready-to-draw tournament (optional)

After `001_fictional_players.sql`, run `backend/seeds/002_tournament_demo.sql` to add eight unlinked
sample players and a published **Sample Open 2026** tournament. It contains two single-elimination
events: eight paid singles entries and four paid mixed-doubles teams. Every participant is already
marked paid, so signing in as `ben.sample@example.test` (Tournament Manager) or
`ada.demo@example.test` and opening **Tournaments → Sample Open 2026** lets you generate either draw
immediately. Change one participant to unpaid to see that entry excluded from the draw. This file is
idempotent and also refuses projects that are not marked as development.

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
Tournament staff get **Tournaments** to run events and results. **ShuttlePower** shows the current-SP
leaderboard with rank titles and per-rank positions, your own ledger history, and the live rule version;
a Super Admin also gets a balance check that compares every cached balance with its ledger sum. **Training** and **Payments** are
visible to every approved member: staff schedule sessions and record fees, while players see their own
attendance, their period balance, and their payment history.

## Tests and checks

```bash
npm run test:db                       # 176 SQL checks on real Postgres (PGlite), no Docker
npm --prefix frontend test            # 228 frontend unit tests (Vitest)
npm --prefix frontend run typecheck
npm --prefix frontend run lint
npm --prefix frontend run build
```

`npm run test:db` applies all seventeen migrations and all fourteen policy files to a real PostgreSQL
engine, stubs Supabase Auth (`auth.users`, `auth.uid()`), and covers schema, RLS, column privileges,
ownership/privacy negatives, approval idempotency, starting SP, player role/link RPCs, tournament
visibility, D10 entry rules, draw validation, result advancement, correction order, the SP rule-version
guardrails, balance reconciliation, training sessions and attendance, partial-payment and soft-void rules,
player IDs, friend request/accept, notifications, per-player tournament fees, guest partners, partner
invitations, self-entry, draw eligibility, the friendly and tournament SP awards with reversals, and the
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
check suite. Phase 3 now has its pure engines (single/double elimination with byes and a grand-final
reset, round-robin generation, D9 standings, D10 entry validation) and its database gate (migration 005:
tournament tables, RLS, audited entry/draw/result RPCs, and typed client definitions). Every migration and
policy file through 006 is applied to the hosted project, so the screens read real data. The Phase 3 staff
UI is built: `/tournaments` lists and creates tournaments, `/tournaments/:id` shows events, entries, draws,
brackets, round-robin standings, and result entry/correction. The hosted Phase 3 walkthrough, the Gate G
replay, and the owner's Super Admin bootstrap are complete.

Phase 6 adds training and payments: sessions, attendance, club-wide fee periods, and manual payments that
are voided rather than edited or deleted. Staff schedule sessions, mark attendance, record partial or full
payments, and void a mistake with a reason; players see their own attendance and payment records. The
schema (migration 007) and screens are verified locally and still need applying to the hosted project.

Tournament registration is now player-facing. Migration 013 adds `players.player_code` (`MBC-` plus eight
hex characters), friend requests that require acceptance, and notifications; migration 014 adds the poster
path and per-player entrance fee, per-participant payment rows, guest partners on `team_members`, player
self-entry, doubles partner invitations, and draw eligibility. `/tournaments` and `/tournaments/:id` are
open to every approved member: players see published tournaments, the poster, events, draws, and results,
join singles directly, invite an accepted friend for doubles, or name a guest partner. An entry exists for
a club partnership only after the partner accepts, and only fully paid or waived entries enter the draw.
Staff mark each participant paid, unpaid, or waived and keep the poster current. The notification bell and
`/notifications` surface publishing, invitation, and payment announcements. Migrations 013–014 and
policies 013–014 are verified locally and still need applying to the hosted project.

Phase 7 adds jerseys, polls, and announcements: jersey projects with designs, sizes, and one active order
per player; single- or multiple-choice polls that refuse late and duplicate votes; and announcements that
staff publish and archive. Staff manage everything through audited RPCs, players view designs, vote, and
update their own order before the deadline. Migration 009 adds design mockups: the bytes live in the public
`jersey-designs` bucket (created by the migration), and only training staff may upload, replace, or delete an
object. Migrations 008–009 and their screens are verified locally only; the bucket is created when the file is
applied to the hosted project, since the local harness has no storage schema.

Phase 5 adds friendly matches: singles challenges between two active players with linked accounts, the
winner submits the result, and the losing side confirms or disputes it within 24 hours (a scheduled job
auto-approves after that). A disputed result stays disputed — no resolution process is invented while the
club rule is open. **A confirmed friendly and a completed tournament match now award ShuttlePower** under the
approved `approved-2026-11` rule (D13, 2026-11-03); the awards are idempotent and write one immutable ledger row
per player. Migration 017 adds the tournament award and F4's compensating reversals (D14): a winner-flip correction
reverses the prior rows and re-awards under the original rule version, while a score-only correction writes nothing.
Migrations 010, 016, and 017 are verified locally; the hosted project is migrated through 010, so 011–017 still need
applying.

Phase 4's formula is approved and live for friendlies and tournaments. Migration 006 adds versioned SP rule
configuration with a provisional, disabled proposal and a reconciliation function; migration 016 records the
club-approved formula as the enabled `approved-2026-11` version, and migration 017 implements the tournament award
and corrections. The pure engine in `domain/sp.ts` uses the approved order (clamp → round → multiply), the approved
2× tournament impact, and the even doubles split. `/shuttlepower` shows the leaderboard with rank titles and per-rank
positions, your own ledger history, and the live rule version. Placement, unplayed-match SP, and the seasonal
implementation remain unbuilt; the open decisions are tracked in `PLAN.md` §7 and §9.
