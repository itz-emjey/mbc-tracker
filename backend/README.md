# Backend

SQL only. There is no application server (decision D1): privileged logic lives
in Postgres functions/RPCs, and every exposed table is protected by RLS.

```
backend/
├─ migrations/        schema, applied in filename order
├─ policies/          RLS policies and grants, applied after the migrations
├─ tests/             local policy/constraint assertions (real Postgres via PGlite)
└─ seeds/             fictional data and the one-time bootstrap (Groups I, J)
```

## Apply order

1. `migrations/001_identity.sql`
2. `migrations/002_shuttlepower_bootstrap.sql`
3. `policies/001_identity.sql`
4. `policies/002_operations.sql`
5. `policies/003_shuttlepower.sql`
6. `migrations/003_auth_lifecycle.sql`
7. `policies/004_auth_lifecycle.sql`
8. `migrations/004_players.sql`
9. `migrations/005_tournaments.sql`
10. `policies/005_tournaments.sql`
11. `migrations/006_shuttlepower_rules.sql`
12. `policies/006_shuttlepower_rules.sql`
13. `migrations/007_training.sql`
14. `policies/007_training.sql`
15. `migrations/008_club_activities.sql`
16. `policies/008_club_activities.sql`
17. `migrations/009_jersey_images.sql`
18. `policies/009_jersey_images.sql`
19. `migrations/010_friendly_matches.sql`
20. `policies/010_friendly_matches.sql`
21. `migrations/011_friendly_sp_award.sql`
22. `migrations/012_seasons.sql`
23. `policies/012_seasons.sql`
24. `migrations/013_players_friends_notifications.sql`
25. `policies/013_players_social.sql`
26. `migrations/014_tournament_registration.sql`
27. `policies/014_tournament_registration.sql`
28. `migrations/015_payment_receipts.sql`
29. `policies/015_payment_receipts.sql`
30. `migrations/016_approved_sp_rule.sql`
31. `migrations/017_tournament_sp_award.sql`

The migrations are **not** idempotent: re-running one fails at the first
`CREATE`, by design. Never add `IF NOT EXISTS` or `DROP` to a migration.

### Applying to the hosted Supabase project

Open **Supabase Dashboard → SQL Editor** and run the thirty-one files above, in
order, as the project owner. No dashboard schema edits are required, and no
service-role key or database password is involved. Confirm afterwards that
`public` contains every expected table and every one has RLS enabled, that the six
auth-lifecycle functions from step 6 exist, that the three player-directory
functions from step 8 (`set_profile_roles`, `link_player_account`,
`unlink_player_account`) exist, that the tournament functions from step 9
(`create_tournament`, `create_tournament_event`, `register_tournament_entry`,
`save_tournament_draw`, `record_match_result`, `correct_match_result`) exist,
that the SP reconciliation function from step 11
(`reconcile_sp_balances`) exists, and that the training functions from step 13
(`create_training_session`, `set_training_session_status`,
`mark_training_attendance`, `create_training_fee_period`,
`record_training_payment`, `void_training_payment`) exist, and that the club
activity functions from step 15 (`create_jersey_project`,
`set_jersey_project_status`, `add_jersey_design`, `add_jersey_size`,
`submit_jersey_order`, `cancel_jersey_order`, `create_poll`, `set_poll_status`,
`cast_poll_vote`, `poll_results`, `create_announcement`,
`set_announcement_status`) exist (step 17 adds `set_jersey_design_image`), and
that the `jersey-designs` bucket exists as public with a 5 MB limit. Storage
policies are applied by step 18 and are skipped when the `storage` schema is
absent, which is how the local harness runs. Step 19 adds the friendly match
functions (`create_friendly_challenge`, `respond_friendly_challenge`,
`cancel_friendly_challenge`, `submit_friendly_result`,
`approve_friendly_result`, `dispute_friendly_result`,
`auto_approve_friendly_matches`) and, where pg_cron is installed, schedules the
15-minute auto-approval job. Migration 011 (`011_friendly_sp_award.sql`) adds the
internal `award_friendly_sp` helper and supersedes both friendly finalizers to
call it. It ships no rule: the award reads the one approved **and** enabled
`sp_rule_versions` row, returns `disabled` and writes nothing when there is none,
and keys each ledger row `friendly:<match_id>:<player>` so a retry cannot award
twice. Step 22–23 add the seasonal tables and their Super Admin RPCs. Step 24–25
add player IDs, friendships, and notifications (SELECT-only for clients, RPC-only
writes). Step 26–27 add the tournament poster path and per-player entrance fee,
`tournament_entry_payments`, `tournament_partner_invitations`, guest partners,
self-entry, and draw eligibility; they also create the public
`tournament-posters` bucket with a 5 MB PNG/JPEG/WebP limit. Step 28–29 add
payment receipts. Step 30 (`016_approved_sp_rule.sql`) inserts the club-approved
`approved-2026-11` rule version and enables it, which is the deliberate step that
lets a confirmed friendly award SP; the applied `provisional-2026-11` row is left
untouched. Step 31 (`017_tournament_sp_award.sql`) adds the internal
`award_tournament_sp` and `reverse_tournament_sp` helpers and supersedes
`record_match_result` and `correct_match_result`. A completed tournament match
now awards the approved 2× adjustment from the two team averages, split across
the rated players, with ledger keys `tournament:<match>:<player>`; a winner-flip
correction writes append-only `reversal` rows keyed to the original row and
re-awards under the **original** rule version (F4, D14), while a score-only
correction that keeps the winner writes no SP rows. Guests and unlinked players
without an SP account are skipped, and Seasonal SP accrues for the active season.

**Status:** files 1–20 are applied to the hosted `mbc-arena` project.
Files 1–5 went in on 2026-10-30 and files 6–8 on 2026-10-31; files 9–12
(Phases 3–4) went in on 2026-11-01, and files 13–20 (Phases 5–7) were confirmed
applied on 2026-11-01. `npm run check:supabase` passes, and
PostgREST probes with the publishable key return `42501 permission denied` for
`anon` on the Phase 1 tables, `tournaments`, `matches`, and `sp_rule_versions`,
and on `reconcile_sp_balances()`, while a deliberately missing function still
returns `404 PGRST202`. Policy 004 only narrows `authenticated` grants, which the
API cannot read back; the owner confirmed
`has_table_privilege('authenticated', 'public.profiles', 'INSERT')` is `false`
and that `profiles_insert_self_pending` is gone. A signed-in demo Super Admin
reads `provisional-2026-11` (provisional, disabled) and gets
`{checked: 7, consistent: true}` from reconciliation. The Phase 3 walkthrough,
the Gate G replay, and the owner's Super Admin bootstrap are complete. Files
13–20 (Phase 6 training and payments; Phase 7 jerseys, polls, announcements,
and design images; Phase 5 friendly matches) are verified locally only; apply
them to the hosted project before using those screens. Migration 011 (the
friendly SP award), migration 012 (the seasonal schema), migrations 013–015
(player IDs, friendships, notifications, tournament registration, and payment
receipts), migration 016 (the approved SP rule), and migration 017 (the
tournament award and F4 reversals) are verified locally only as well. Migration
016 is what turns the friendly award on, and migration 017 turns the tournament
award on; the seasonal schema stays inert until a Super Admin starts a season.
Remaining work is product scope (§7 rules and the next phase), not hosted setup.
The repository intentionally stores no credentials that would let an agent apply
migrations automatically.

## Seeds

`seeds/001_fictional_players.sql` adds a development-only demo dataset: six
fictional accounts, all four roles, four approved profiles, one pending
registration with no player record, one suspended account, six player records
(five linked accounts plus one unlinked active player for demonstrating the
account-link flow), an approved and a pending registration request, and five
1,000 SP starting transactions written through `grant_starting_sp`. The unlinked
demo player has no SP account until an account is linked and funded.

It refuses to run unless the project is explicitly marked as development. Run
both steps as the project owner in the Supabase SQL Editor:

```sql
insert into public.app_settings (key, value)
values ('club.environment', '"development"'::jsonb)
on conflict (key) do update set value = excluded.value;
```

Then run `seeds/001_fictional_players.sql`. Both steps are idempotent, and the
seed never overwrites a record a developer changed through the app.

Every demo account uses an `@example.test` address and the development-only
password `mbc-demo-2026`:

| Account | Role | Status |
| --- | --- | --- |
| `ada.demo@example.test` | Super Admin | active |
| `ben.sample@example.test` | Tournament Manager | active |
| `cleo.placeholder@example.test` | Trainer | active |
| `drew.testcase@example.test` | Player | active |
| `erin.pending@example.test` | none (awaiting approval) | pending |
| `finn.suspended@example.test` | Player | suspended |

Passwords are hashed with pgcrypto from Supabase's `extensions` schema. If the
hosted project does not have that schema, enable the pgcrypto extension first.
No real member data ever belongs in this file.

GoTrue scans `auth.users` into non-nullable Go values, so a NULL in any of them
makes password sign-in fail with `500 Database error querying schema`
(supabase/auth#1940). Besides the string token/change columns, its user model
has plain `bool` fields (`is_sso_user`, `is_anonymous`) and a plain `int`
(`email_change_confirm_status`), which a text-only repair cannot fix. On every
run the seed therefore normalizes both groups on the seeded rows: every NULL
text/varchar column becomes `''`, and those three fields become `false`,
`false`, and `0`. The column names come from `information_schema`, so a column
added or renamed by a later GoTrue version cannot silently break demo sign-in.

Columns with a unique index are skipped, because several demo rows cannot hold
the same empty value: hosted `auth.users.phone` carries `users_phone_key`, and
GoTrue reads `phone` into a NULL-safe value, so it stays NULL. A
`unique_violation` from an index the query cannot predict raises a notice
instead of aborting the repair.

`seeds/002_tournament_demo.sql` adds a ready-to-draw demo on top of the
fictional accounts: eight unlinked sample players and a published
**Sample Open 2026** tournament with two single-elimination events - eight paid
singles entries and four paid mixed-doubles teams (one male and one female per
team). Every participant is already marked paid, so a Tournament Manager or
Super Admin can generate either draw immediately from the tournament screen;
marking one participant unpaid demonstrates the draw-exclusion rule. It has the
same development-marker guard and is idempotent, so re-running adds nothing.
The SQL gate generates both demo draws through `save_tournament_draw` to prove
the dataset is usable.

`seeds/bootstrap_super_admin.sql` grants the first `super_admin` to an existing
account (decision D8). It requires the address through
`set mbc.bootstrap_super_admin_email = '…'` in the same SQL Editor execution,
activates a pending profile, writes one audit row, and is a no-op when re-run.
It creates no function or endpoint. The root `README.md` documents the full
manual step.

## Local verification

```bash
npm install          # from the repository root
npm run test:db
```

`backend/tests/run.mjs` runs a real PostgreSQL engine compiled to WebAssembly
(PGlite), stubs `auth.users` and `auth.uid()` with the same shape Supabase
provides (the token, bool, and integer columns GoTrue reads are declared
nullable so the seed's repair pass is exercised), applies all seventeen migrations
and all fourteen policy files, and asserts (176 checks):

- every expected table exists and has RLS enabled;
- the migrations fail loudly on a second run;
- `has_role()`, uniqueness, status, email, and SP-ledger constraints;
- least-privilege column grants;
- positive and negative policy cases for player, pending, staff, admin, and anon;
- registration, approval, rejection, role assignment, status changes, and the
  one-time 1,000 SP award, including the double-approval replay (Gate G);
- ownership and privacy negatives (Group H): own-profile-only reads and
  updates, no contact columns, `auth.users` unreachable, no client writes to
  role/audit/SP tables, and authorization errors for unapproved RPC callers;
- the fictional seed (Group I): it refuses without the development marker,
  creates the full demo dataset (six accounts, six player records - five linked
  and one unlinked - every role, and five 1,000 SP awards), leaves no NULL
  column that GoTrue scans into a non-nullable field, repairs deliberately
  NULLed ones (strings, bools, and the integer) on a re-run while leaving unique
  `phone` NULL, and adds nothing else on a second run;
- the tournament demo seed (Group I): it is idempotent, creates the eight sample
  players and the published demo tournament with fully paid singles and doubles
  entries, and both draws generate successfully through `save_tournament_draw`;
- the first Super Admin bootstrap (Group J): it refuses without an explicit
  email, activates a pending profile, grants the role once, audits once, and
  rejects unknown or suspended accounts;
- tournaments (Group N): drafts are staff-only until published, all tournament
  tables are read-only to clients, the lifecycle and RPCs are audited, D10
  rejects same-gender and missing-gender doubles pairs, caps/seeds/withdrawals
  behave before a draw, a draw must cover every entry exactly once and may only
  reference earlier sources, round robin stores each pair once, results advance
  both final slots, a level or split score list is refused, the grand-final
  reset is cancelled or played correctly, and a correction requires a reason
  while refusing to overwrite a played downstream match;
- ShuttlePower rules (Phase 4): two rule versions ship - the original
  `provisional-2026-11` proposal, still provisional and disabled, and the
  club-approved `approved-2026-11`, enabled with base 20, sensitivity 0.02,
  clamp 5–40, floor 0, tournament ×2, half-up rounding, and an even split. An
  unapproved version cannot be enabled, only one version can be enabled at a
  time, clients read but never write rule versions, reconciliation confirms a
  matching ledger and reports drift without repairing it, and only a Super Admin
  can run it. A confirmed friendly at equal ratings awards +20 / −20 under the
  approved rule and records its version on both ledger rows. A completed
  tournament match awards the 2× team adjustment from the two team averages,
  splits it across the rated players, and is idempotent per player; a correction
  writes append-only `reversal` rows and re-awards under the original version;
- training and payments (Phase 6): every table is read-only to clients, a
  player or tournament manager cannot create sessions or fee periods, session
  creation is audited, times and forward-only status transitions are enforced,
  attendance upserts one row per session and player (visible to staff or the
  player only), partial payments are allowed while overpayment is refused, a
  void needs a reason and keeps the row, a voided payment stops counting toward
  the total, and neither direct inserts nor deletes are possible;
- club activities (Phase 7): jersey projects, designs, sizes, and orders are
  read-only to clients, staff must add a design and a size before a project can
  open, a player holds one active order per project (cancelling frees it), and a
  closed project or passed deadline refuses orders; a poll replaces a player's
  previous submission, single mode accepts exactly one option, duplicate and
  unknown options are refused, a closed poll or passed window refuses votes, and
  results only carry tallies when the poll is closed or results are enabled;
  drafts stay staff-only, announcements publish once, and `anon` can neither read
  the tables nor call the RPCs;
- design images (Phase 7): `set_jersey_design_image` is staff-only and audited,
  it refuses URLs, path traversal, and non-image extensions, a null path clears
  the mockup, the column constraint rejects any path outside `designs/`, and
  `anon` cannot execute the RPC. The bucket and its storage policies are
  skipped locally because PGlite has no `storage` schema;
- friendly matches (Phase 5): only two active, linked players can be paired,
  the pair holds one open match at a time, only the challenged player responds,
  only the challenger cancels before a result, only the winner submits their own
  win, only the loser approves or disputes, a dispute needs a reason, neither
  player can act on a settled match, auto-approval waits for the stored 24-hour
  deadline and is idempotent, a confirmed or auto-approved result writes no SP row
  while no approved rule version is enabled, and awards each player exactly once
  (winner +, loser −, half-up on the size of the change) once one is enabled,
  with a replay awarding nothing and reconciliation still exact, participants
  and Super Admins see a match while an unrelated member sees none, `anon` is
  denied, and the internal award helper is callable by nobody but the finalizers;
- tournament SP award and reversals (Phase 4, migration 017): a completed match
  awards both sides from the approved rule, a replay writes nothing, a doubles
  team splits evenly, a winner-flip correction reverses every prior row and
  re-awards under the original version while a score-only correction writes
  nothing, no award runs while no rule version is enabled, an
  awarded tournament match accrues Seasonal SP in the active season, and the
  internal award and reversal helpers are callable by nobody;
- seasons (S1–S23, migration 012): every seasonal table is read-only to clients
  and `anon` is denied, only a Super Admin creates, starts, closes, and decides a
  season, one season is active at a time and overlapping ranges are refused, an
  awarded friendly accrues Seasonal SP in the active season, closing writes one
  snapshot per player with competition ranks (ties share a position) and excludes
  a negative balance with a reason code, the generated batch carries the fixed
  40/30/20/10 tiers, approval caps each deduction at the balance and waives the
  remainder exactly once, a deduction never touches Seasonal SP, and a rejected
  batch is preserved, applies nothing, and blocks no later season;
- player IDs and social graph (migration 013): every player receives a stable,
  unique, readable `MBC-XXXXXXXX` code, a request needs an active linked target
  and can be accepted once, a declined request creates no friendship and can be
  retried, and a member reads and clears only their own notifications;
- tournament registration (migration 014): an unpaid entry stays registered but
  blocks the draw until staff mark every participant paid or waived, a guest
  doubles partner is stored on `team_members` without a `players` row and still
  owes a fee row, a club partner invitation creates the team, entry, and payment
  rows only after acceptance, cancelling or declining creates no entry, and
  publishing notifies active club members once while a draft notifies nobody.

PGlite is a development dependency only; it is not shipped to the frontend.

## Regenerating database types

After any schema migration, regenerate the committed types with the Supabase
CLI:

```bash
supabase gen types typescript --project-id <project-ref> --schema public \
  > ../frontend/src/types/database.ts
```

The committed `frontend/src/types/database.ts` covers migrations 001–010 and
013–014: the
`players` table and its profile relationship, the four auth-lifecycle RPCs, the
three Group K RPCs (`set_profile_roles`, `link_player_account`,
`unlink_player_account`), the tournament tables and RPCs, the
`sp_rule_versions` table plus `reconcile_sp_balances()`, the four training
tables plus their six RPCs, the eight club activity tables plus their twelve
RPCs, `jersey_designs.image_path` plus `set_jersey_design_image(uuid,text)`, and
the `friendly_matches` table plus its seven RPCs, `players.player_code`, the
friendship and notification tables plus their six RPCs, and the tournament
payment, invitation, poster, fee, self-entry, and withdrawal RPCs. The Supabase
CLI was unavailable in the development environment, so those
signatures were checked against `migrations/004_players.sql`,
`migrations/005_tournaments.sql`, `migrations/006_shuttlepower_rules.sql`,
`migrations/007_training.sql`, `migrations/008_club_activities.sql`,
`migrations/009_jersey_images.sql`, `migrations/010_friendly_matches.sql`,
`migrations/013_players_friends_notifications.sql`, and
`migrations/014_tournament_registration.sql` and
added to the committed file; application builds treat it as authoritative.
Regenerate it against the hosted project after step 27 and after every later
migration. Never edit regenerated output by hand.

## Security notes

- `anon` has no table access. `authenticated` receives only the column grants
  in `policies/`.
- Players cannot write profiles beyond their own display name, cannot change
  their status, cannot assign roles, cannot create registration requests
  directly, and cannot write `sp_accounts` or `sp_transactions`.
- `sp_transactions` is append-only: update, delete, and truncate are blocked by
  triggers in addition to the absence of client grants.
- `has_role()` is `security definer` with `search_path = ''` and only returns true for `status = 'active'`
  profiles, so suspension/deactivation takes effect immediately.
- `app_settings` is readable only by active club members.
- Every tournament table is read-only to clients. Entries, draws, results, and
  corrections cross audited RPCs that enforce the cap, D10 pairings, draw
  coverage, bracket advancement, and correction order in one transaction.
- `sp_rule_versions` is read-only to clients. The original `provisional-2026-11`
  row is provisional and disabled; `approved-2026-11` (migration 016) is the
  single enabled row. A CHECK constraint makes an unapproved version impossible
  to enable, and a partial unique index allows only one enabled version. Clients
  cannot award SP: the internal friendly and tournament helpers do, and the
  correction RPC writes the compensating reversal.
- `reconcile_sp_balances()` is Super Admin only, reports every cached balance
  that differs from its ledger sum, and never writes a correction.
- Training and payment tables are read-only to clients. Sessions, attendance,
  fee periods, and payments cross audited RPCs guarded by
  `require_training_staff()` (trainer or Super Admin). Payments are never
  edited or deleted: a mistake is voided with a reason, and only recorded rows
  count toward a period total.
- Approval flows and starting SP are implemented as RPCs in
  `migrations/003_auth_lifecycle.sql`; `migrations/001`–`002` deliberately
  contain no approval logic. Registration is RPC-only, because
  `policies/004_auth_lifecycle.sql` removes the direct `profiles` INSERT grant
  and its self-insert policy.
