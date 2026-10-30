# Backend

SQL only. There is no application server (decision D1): privileged logic lives
in Postgres functions/RPCs, and every exposed table is protected by RLS.

```
backend/
├─ migrations/        schema, applied in filename order
├─ policies/          RLS policies and grants, applied after the migrations
├─ tests/             local policy/constraint assertions (real Postgres via PGlite)
└─ seeds/             fictional data only (Group I)
```

## Apply order

1. `migrations/001_identity.sql`
2. `migrations/002_shuttlepower_bootstrap.sql`
3. `policies/001_identity.sql`
4. `policies/002_operations.sql`
5. `policies/003_shuttlepower.sql`

The migrations are **not** idempotent: re-running one fails at the first
`CREATE`, by design. Never add `IF NOT EXISTS` or `DROP` to a migration.

### Applying to the hosted Supabase project

Open **Supabase Dashboard → SQL Editor** and run the five files above, in
order, as the project owner. No dashboard schema edits are required, and no
service-role key or database password is involved. Confirm afterwards that
`public` contains nine tables and every one has RLS enabled.

The developer must do this once; the repository intentionally does not store
credentials that would let an agent apply it automatically.

## Local verification

```bash
npm install          # from the repository root
npm run test:db
```

`backend/tests/run.mjs` runs a real PostgreSQL engine compiled to WebAssembly
(PGlite), stubs `auth.users` and `auth.uid()` with the same shape Supabase
provides, applies both migrations and all policies, and asserts:

- all nine tables exist and have RLS enabled;
- both migrations fail loudly on a second run;
- `has_role()`, uniqueness, status, email, and SP-ledger constraints;
- least-privilege column grants;
- positive and negative policy cases for player, pending, staff, admin, and anon.

PGlite is a development dependency only; it is not shipped to the frontend.

## Regenerating database types

After any schema migration, regenerate the committed types with the Supabase
CLI:

```bash
supabase gen types typescript --project-id <project-ref> --schema public \
  > ../frontend/src/types/database.ts
```

The current `frontend/src/types/database.ts` was generated from migrations
001 and 002 (via the CLI against a local Postgres with the same schema). It
must be regenerated against the hosted project once the migrations are applied
there, and after every later migration. Never edit the generated file by hand.

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
- Approval flows and starting SP are implemented as RPCs in Group G; this
  migration deliberately contains no approval logic.
