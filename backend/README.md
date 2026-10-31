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

The migrations are **not** idempotent: re-running one fails at the first
`CREATE`, by design. Never add `IF NOT EXISTS` or `DROP` to a migration.

### Applying to the hosted Supabase project

Open **Supabase Dashboard → SQL Editor** and run the eight files above, in
order, as the project owner. No dashboard schema edits are required, and no
service-role key or database password is involved. Confirm afterwards that
`public` contains nine tables and every one has RLS enabled, that the six
auth-lifecycle functions from step 6 exist, and that the three player-directory
functions from step 8 (`set_profile_roles`, `link_player_account`,
`unlink_player_account`) exist.

**Status:** files 1–5 have been applied to the hosted `mbc-arena` project
(2026-10-30). `npm run check:supabase` passes, and a PostgREST probe with the
publishable key returns `42501 permission denied` for all nine tables to
`anon` — they exist, and anon grants are revoked. Files 6–7 (Group G) were
applied on 2026-10-31: all six functions now resolve and `anon` receives
`42501 permission denied` for each, where it received `404 PGRST202` before.
Policy 004 only narrows `authenticated` grants, which the API cannot read back;
confirm it with `select has_table_privilege('authenticated', 'public.profiles',
'INSERT');` returning `false`. Step 8 (Phase 2, Group K) was applied on
2026-10-31: `set_profile_roles`, `link_player_account`, and
`unlink_player_account` all resolve, and `anon` receives `42501 permission
denied` for each. The repository intentionally stores no credentials that would
let an agent apply migrations automatically.

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
nullable so the seed's repair pass is exercised), applies all four migrations
and all four policy files, and asserts (90 checks):

- all nine tables exist and have RLS enabled;
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
- the first Super Admin bootstrap (Group J): it refuses without an explicit
  email, activates a pending profile, grants the role once, audits once, and
  rejects unknown or suspended accounts.

PGlite is a development dependency only; it is not shipped to the frontend.

## Regenerating database types

After any schema migration, regenerate the committed types with the Supabase
CLI:

```bash
supabase gen types typescript --project-id <project-ref> --schema public \
  > ../frontend/src/types/database.ts
```

The committed `frontend/src/types/database.ts` covers migrations 001–004: the
`players` table and its profile relationship, the four auth-lifecycle RPCs, and
the three Group K RPCs (`set_profile_roles`, `link_player_account`,
`unlink_player_account`). The Supabase CLI was unavailable in the development
environment, so the Group K signatures were checked against
`migrations/004_players.sql` and added to the committed file; application builds
treat it as authoritative. Regenerate it against the hosted project after step 8
and after every later migration. Never edit regenerated output by hand.

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
- Approval flows and starting SP are implemented as RPCs in
  `migrations/003_auth_lifecycle.sql`; `migrations/001`–`002` deliberately
  contain no approval logic. Registration is RPC-only, because
  `policies/004_auth_lifecycle.sql` removes the direct `profiles` INSERT grant
  and its self-insert policy.
