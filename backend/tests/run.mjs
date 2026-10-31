#!/usr/bin/env node
/**
 * Local verification for the identity migration and its RLS policies.
 *
 * Runs a real PostgreSQL engine in WebAssembly (PGlite), so the gate can be
 * checked without Docker, a hosted database, or a database password. Supabase
 * Auth is stubbed with the same `auth.users` table shape and an `auth.uid()`
 * that reads the JWT claim from the session.
 *
 * Run from the repository root:
 *   npm run test:db
 */
import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendDir = join(dirname(fileURLToPath(import.meta.url)), '..')

const [
  migration,
  spMigration,
  authMigration,
  identityPolicies,
  operationPolicies,
  spPolicies,
  authPolicies,
  seed,
  bootstrap,
] = await Promise.all([
  readFile(join(backendDir, 'migrations', '001_identity.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '002_shuttlepower_bootstrap.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '003_auth_lifecycle.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '001_identity.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '002_operations.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '003_shuttlepower.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '004_auth_lifecycle.sql'), 'utf8'),
  readFile(join(backendDir, 'seeds', '001_fictional_players.sql'), 'utf8'),
  readFile(join(backendDir, 'seeds', 'bootstrap_super_admin.sql'), 'utf8'),
])

const db = new PGlite()

const A = '11111111-1111-4111-8111-111111111111' // player
const B = '22222222-2222-4222-8222-222222222222' // pending, no roles
const C = '33333333-3333-4333-8333-333333333333' // super admin
const D = '44444444-4444-4444-8444-444444444444' // tournament manager
const E = '55555555-5555-4555-8555-555555555555' // pending, has a request
const G = '66666666-6666-4666-8666-666666666666' // auth user without a profile
const H = '77777777-7777-4777-8777-777777777777' // pending, no request
const P1 = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa' // player record linked to A
const P2 = 'dddddddd-1111-4111-8111-dddddddddddd' // unlinked player record
const RR1 = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
const RR2 = 'cccccccc-1111-4111-8111-cccccccccccc'
const RR3 = 'eeeeeeee-1111-4111-8111-eeeeeeeeeeee'

const tables = [
  'profiles',
  'players',
  'roles',
  'user_roles',
  'registration_requests',
  'audit_logs',
  'app_settings',
  'sp_accounts',
  'sp_transactions',
]

let passed = 0
const failures = []

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function test(name, run) {
  try {
    await run()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failures.push({ name, error })
    console.error(`FAIL  ${name}\n      ${error.message}`)
  }
}

async function expectError(name, action, pattern) {
  let caught
  try {
    await action()
  } catch (error) {
    caught = error
  }

  if (!caught) throw new Error('expected an error, but the statement succeeded')
  if (pattern && !pattern.test(caught.message)) {
    throw new Error(`expected ${pattern}, got: ${caught.message}`)
  }
}

/** Runs a query as an authenticated user inside a rolled-back transaction. */
async function asUser(uid, sql, params) {
  await db.exec('begin')
  try {
    await db.exec(`set local role authenticated; set local request.jwt.claim.sub = '${uid}'`)
    return await db.query(sql, params)
  } finally {
    await db.exec('rollback')
  }
}

/** Runs a query as any role inside a rolled-back transaction. */
async function asRole(role, sql, params) {
  await db.exec('begin')
  try {
    await db.exec(`set local role ${role}`)
    return await db.query(sql, params)
  } finally {
    await db.exec('rollback')
  }
}

/** Runs a multi-step scenario in one rolled-back transaction. */
async function inTransaction(run) {
  await db.exec('begin')
  try {
    return await run()
  } finally {
    await db.exec('rollback')
  }
}

/** Switches the current transaction to a role and optional auth user. */
async function actAs(role, uid = null) {
  await db.exec('reset role')

  if (uid) {
    await db.exec(`set local request.jwt.claim.sub = '${uid}'`)
  }

  await db.exec(`set local role ${role}`)
}

async function expectErrorAs(uid, sql, pattern) {
  return expectError(
    `denied query as ${uid}`,
    () => asUser(uid, sql),
    pattern,
  )
}

// ---------------------------------------------------------------------------
// Supabase Auth stand-in
// ---------------------------------------------------------------------------
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    instance_id uuid,
    id uuid primary key,
    aud text,
    role text,
    email text not null unique,
    encrypted_password text,
    -- Supabase has users_phone_key on this column, so the seed must not try to
    -- give several demo rows the same empty value.
    phone text unique,
    confirmation_token text,
    recovery_token text,
    email_change text,
    email_change_token_new text,
    email_change_token_current text,
    phone_change text,
    phone_change_token text,
    reauthentication_token text,
    -- GoTrue also scans these into non-nullable Go values (bool, bool, int).
    -- They are nullable here so the seed's repair pass is exercised; on a
    -- hosted project they normally carry defaults.
    is_sso_user boolean,
    is_anonymous boolean,
    email_change_confirm_status smallint,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  -- Supabase declares its token indexes as *partial* unique indexes: rows whose
  -- value is empty or NULL are outside the index, so every demo row can hold ''
  -- without colliding. The seed must still repair these columns, because GoTrue
  -- scans them into plain Go strings. Skipping every unique-indexed column
  -- (the v20 bug) leaves them NULL and password sign-in stays broken.
  create unique index users_confirmation_token_idx
    on auth.users (confirmation_token)
    where confirmation_token !~ '^[0-9 ]*$';
  create unique index users_recovery_token_idx
    on auth.users (recovery_token)
    where recovery_token !~ '^[0-9 ]*$';
  create unique index users_email_change_token_new_idx
    on auth.users (email_change_token_new)
    where email_change_token_new !~ '^[0-9 ]*$';
  create unique index users_email_change_token_current_idx
    on auth.users (email_change_token_current)
    where email_change_token_current !~ '^[0-9 ]*$';
  create unique index users_reauthentication_token_idx
    on auth.users (reauthentication_token)
    where reauthentication_token !~ '^[0-9 ]*$';

  create table auth.identities (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    identity_data jsonb not null,
    provider text not null,
    provider_id text not null,
    last_sign_in_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (provider, provider_id)
  );

  -- Supabase installs pgcrypto into the extensions schema; the password
  -- hashing used by the seed is stubbed so this harness needs no extension.
  create schema extensions;
  create function extensions.gen_salt(text)
  returns text
  language sql
  immutable
  as $fn$ select '$2a$06$mbcstubmbcstubmbcstubmbcstubmbcstubmbcstubmbcstubmbcstub' $fn$;
  create function extensions.crypt(text, text)
  returns text
  language sql
  immutable
  as $fn$ select '$2a$06$' || md5($1 || $2) $fn$;

  create function auth.uid()
  returns uuid
  language sql
  stable
  as $function$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $function$;

  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`)

await db.exec(migration)
await db.exec(spMigration)
await db.exec(authMigration)
await db.exec(identityPolicies)
await db.exec(operationPolicies)
await db.exec(spPolicies)
await db.exec(authPolicies)

// ---------------------------------------------------------------------------
// Schema and catalogue
// ---------------------------------------------------------------------------
await test('all nine tables exist', async () => {
  const { rows } = await db.query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  )
  const found = new Set(rows.map((row) => row.table_name))
  for (const table of tables) assert(found.has(table), `missing table ${table}`)
})

await test('row level security is enabled on every table', async () => {
  const { rows } = await db.query(
    `select relname, relrowsecurity
       from pg_class
      where relnamespace = 'public'::regnamespace
        and relname in ('profiles','players','roles','user_roles','registration_requests','audit_logs','app_settings','sp_accounts','sp_transactions')`,
  )
  assert(rows.length === tables.length, `expected ${tables.length} tables, found ${rows.length}`)
  for (const row of rows) assert(row.relrowsecurity, `RLS is off on ${row.relname}`)
})

await test('roles are seeded once', async () => {
  const { rows } = await db.query(`select key from public.roles order by key`)
  assert(
    rows.map((row) => row.key).join(',') ===
      'player,super_admin,tournament_manager,trainer',
    `unexpected roles: ${rows.map((row) => row.key).join(',')}`,
  )
})

await test('re-running the identity migration fails loudly', async () => {
  await expectError(
    're-run identity migration',
    async () => {
      try {
        await db.exec(migration)
      } finally {
        await db.exec('rollback')
      }
    },
    /already exists/i,
  )
})

await test('re-running the ShuttlePower migration fails loudly', async () => {
  await expectError(
    're-run SP migration',
    async () => {
      try {
        await db.exec(spMigration)
      } finally {
        await db.exec('rollback')
      }
    },
    /already exists/i,
  )
})

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${A}', 'alex@example.test', '{"full_name":"Alex Player"}'::jsonb),
    ('${B}', 'bea@example.test', '{"full_name":"Bea Pending"}'::jsonb),
    ('${C}', 'cara@example.test', '{"full_name":"Cara Admin"}'::jsonb),
    ('${D}', 'dino@example.test', '{"full_name":"Dino Manager"}'::jsonb),
    ('${E}', 'eve@example.test', '{"full_name":"Eve Pending"}'::jsonb),
    ('${G}', 'gina@example.test', '{"full_name":"Gina Metadata"}'::jsonb),
    ('${H}', 'hal@example.test', '{"full_name":"Hal Pending"}'::jsonb);

  insert into public.profiles (id, full_name, status) values
    ('${A}', 'Alex Player', 'active'),
    ('${B}', 'Bea Pending', 'pending'),
    ('${C}', 'Cara Admin', 'active'),
    ('${D}', 'Dino Manager', 'active'),
    ('${E}', 'Eve Pending', 'pending'),
    ('${H}', 'Hal Pending', 'pending');

  insert into public.user_roles (profile_id, role_id, granted_by)
    select '${A}', id, '${C}' from public.roles where key = 'player';
  insert into public.user_roles (profile_id, role_id, granted_by)
    select '${C}', id, '${C}' from public.roles where key = 'super_admin';
  insert into public.user_roles (profile_id, role_id, granted_by)
    select '${D}', id, '${C}' from public.roles where key = 'tournament_manager';

  insert into public.players (id, profile_id, full_name, gender)
    values ('${P1}', '${A}', 'Alex Player', 'male');

  insert into public.players (id, full_name, gender)
    values ('${P2}', 'Unlinked Player', 'female');

  insert into public.registration_requests (id, profile_id, email, full_name) values
    ('${RR1}', '${B}', 'bea@example.test', 'Bea Pending'),
    ('${RR2}', '${E}', 'shared@example.test', 'Eve Pending');

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
    values ('${C}', 'role.grant', 'user_roles', '${A}', '{"role":"player"}'::jsonb);

  insert into public.app_settings (key, value, description)
    values ('club.name', '"Matag-ob Badminton Club"'::jsonb, 'Display name');

  insert into public.sp_accounts (player_id, current_sp)
    values ('${P1}', 1000);

  insert into public.sp_transactions
    (player_id, transaction_type, sp_before, sp_delta, sp_after, idempotency_key, created_by)
    values ('${P1}', 'initial', 0, 1000, 1000, 'player:${P1}:initial', '${C}');
`)

// ---------------------------------------------------------------------------
// Role predicate
// ---------------------------------------------------------------------------
await test('has_role resolves only assigned roles', async () => {
  const { rows } = await db.query(
    `select public.has_role($1, 'player') as player,
            public.has_role($1, 'super_admin') as admin,
            public.has_role($2, 'player') as pending_player`,
    [A, B],
  )
  assert(rows[0].player === true, 'A should hold player')
  assert(rows[0].admin === false, 'A should not hold super_admin')
  assert(rows[0].pending_player === false, 'B should hold no role')
})

await test('suspension revokes role-based access immediately', async () => {
  await db.exec('begin')
  try {
    await db.exec(`update public.profiles set status = 'suspended' where id = '${A}'`)
    const role = await db.query(`select public.has_role($1, 'player') as allowed`, [A])
    assert(role.rows[0].allowed === false, 'suspended profile must not hold its role')

    await db.exec(`set local role authenticated; set local request.jwt.claim.sub = '${A}'`)
    const players = await db.query(`select id from public.players`)
    const own = await db.query(`select id from public.profiles`)
    assert(players.rows.length === 0, `suspended player must see 0 players, got ${players.rows.length}`)
    assert(own.rows.length === 1 && own.rows[0].id === A, 'suspended player may still read their own profile')
  } finally {
    await db.exec('rollback')
  }
})

await test('anon cannot execute has_role', async () => {
  const { rows } = await db.query(
    `select has_function_privilege('anon', 'public.has_role(uuid,text)', 'EXECUTE') as allowed`,
  )
  assert(rows[0].allowed === false, 'anon must not execute has_role')
})

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------
await test('one account per player record', async () => {
  await expectError(
    'duplicate player link',
    () => db.exec(`insert into public.players (profile_id, full_name) values ('${A}', 'Copy')`),
    /duplicate key|unique/i,
  )
})

await test('one role assignment per profile and role', async () => {
  await expectError(
    'duplicate role assignment',
    () =>
      db.exec(
        `insert into public.user_roles (profile_id, role_id) select '${A}', id from public.roles where key = 'player'`,
      ),
    /duplicate key|unique/i,
  )
})

await test('one pending registration per email', async () => {
  await expectError(
    'duplicate pending email',
    () =>
      db.exec(
        `update public.registration_requests set email = 'shared@example.test' where id = '${RR1}'`,
      ),
    /duplicate key|unique/i,
  )
})

await test('approving a request frees the email for a new request', async () => {
  await db.exec('begin')
  try {
    await db.exec(`
      update public.registration_requests
         set status = 'approved',
             reviewed_at = now(),
             reviewed_by = '${C}',
             linked_player_id = '${P1}'
       where id = '${RR2}'
    `)
    await db.exec(
      `insert into public.registration_requests (profile_id, email, full_name) values ('${H}', 'shared@example.test', 'Hal Pending')`,
    )
  } finally {
    await db.exec('rollback')
  }
})

await test('review state must match status', async () => {
  await expectError(
    'approve without review metadata',
    () =>
      db.exec(
        `update public.registration_requests set status = 'approved' where id = '${RR1}'`,
      ),
    /registration_requests_review_state_check/i,
  )
})

await test('emails are stored lowercase', async () => {
  await expectError(
    'uppercase email',
    () =>
      db.exec(
        `update public.registration_requests set email = 'BEA@example.test' where id = '${RR1}'`,
      ),
    /registration_requests_email_check/i,
  )
})

// ---------------------------------------------------------------------------
// Column privileges
// ---------------------------------------------------------------------------
await test('least-privilege column grants are in place', async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('authenticated', 'public.user_roles', 'INSERT') as user_roles_insert,
      has_table_privilege('authenticated', 'public.audit_logs', 'INSERT') as audit_insert,
      has_table_privilege('authenticated', 'public.players', 'SELECT') as players_select,
      has_table_privilege('authenticated', 'public.profiles', 'INSERT') as profile_insert,
      has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE') as profile_status_update,
      has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') as profile_name_update,
      has_column_privilege('authenticated', 'public.players', 'profile_id', 'UPDATE') as player_link_update,
      has_table_privilege('authenticated', 'public.roles', 'INSERT') as roles_insert,
      has_table_privilege('authenticated', 'public.roles', 'UPDATE') as roles_update,
      has_table_privilege('authenticated', 'public.user_roles', 'UPDATE') as user_roles_update,
      has_table_privilege('authenticated', 'public.user_roles', 'DELETE') as user_roles_delete,
      has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE') as audit_update,
      has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') as audit_delete,
      has_table_privilege('authenticated', 'public.sp_accounts', 'UPDATE') as sp_accounts_update,
      has_table_privilege('authenticated', 'public.sp_transactions', 'INSERT') as sp_ledger_insert,
      has_table_privilege('authenticated', 'public.sp_transactions', 'DELETE') as sp_ledger_delete,
      has_function_privilege('authenticated', 'public.has_role(uuid,text)', 'EXECUTE') as has_role_execute,
      has_function_privilege('authenticated', 'public.submit_registration(text)', 'EXECUTE') as submit_execute,
      has_function_privilege('authenticated', 'public.approve_registration(uuid,text[],uuid)', 'EXECUTE') as approve_execute,
      has_function_privilege('authenticated', 'public.reject_registration(uuid,text)', 'EXECUTE') as reject_execute,
      has_function_privilege('authenticated', 'public.set_profile_status(uuid,text)', 'EXECUTE') as status_execute,
      has_function_privilege('authenticated', 'public.grant_starting_sp(uuid,uuid)', 'EXECUTE') as sp_execute,
      has_function_privilege('anon', 'public.submit_registration(text)', 'EXECUTE') as anon_submit_execute
  `)
  const row = rows[0]
  assert(row.user_roles_insert === false, 'authenticated must not insert user_roles')
  assert(row.audit_insert === false, 'authenticated must not insert audit_logs')
  assert(row.players_select === true, 'authenticated should read players')
  assert(row.profile_insert === false, 'authenticated must not insert profiles directly')
  assert(row.profile_status_update === false, 'authenticated must not update profiles.status')
  assert(row.profile_name_update === true, 'authenticated should update profiles.full_name')
  assert(row.player_link_update === false, 'authenticated must not link a player to an account directly')
  assert(row.roles_insert === false, 'authenticated must not insert roles')
  assert(row.roles_update === false, 'authenticated must not update roles')
  assert(row.user_roles_update === false, 'authenticated must not update role assignments')
  assert(row.user_roles_delete === false, 'authenticated must not delete role assignments')
  assert(row.audit_update === false, 'authenticated must not update audit logs')
  assert(row.audit_delete === false, 'authenticated must not delete audit logs')
  assert(row.sp_accounts_update === false, 'authenticated must not update SP accounts')
  assert(row.sp_ledger_insert === false, 'authenticated must not insert SP transactions')
  assert(row.sp_ledger_delete === false, 'authenticated must not delete SP transactions')
  assert(row.has_role_execute === true, 'authenticated should execute has_role')
  assert(row.submit_execute === true, 'authenticated should execute submit_registration')
  assert(row.approve_execute === true, 'authenticated should execute approve_registration')
  assert(row.reject_execute === true, 'authenticated should execute reject_registration')
  assert(row.status_execute === true, 'authenticated should execute set_profile_status')
  assert(row.sp_execute === false, 'grant_starting_sp must stay internal')
  assert(row.anon_submit_execute === false, 'anon must not execute submit_registration')
})

// ---------------------------------------------------------------------------
// RLS behaviour
// ---------------------------------------------------------------------------
await test('a player sees only their own profile', async () => {
  const { rows } = await asUser(A, `select id from public.profiles`)
  assert(rows.length === 1 && rows[0].id === A, `expected only ${A}, got ${rows.length} rows`)
})

await test('a pending user sees only their own profile', async () => {
  const { rows } = await asUser(B, `select id from public.profiles`)
  assert(rows.length === 1 && rows[0].id === B, `expected only ${B}, got ${rows.length} rows`)
})

await test('a super admin sees every profile', async () => {
  const { rows } = await asUser(C, `select id from public.profiles`)
  assert(rows.length === 6, `expected 6 profiles, got ${rows.length}`)
})

await test('club members see player records, pending users do not', async () => {
  const member = await asUser(A, `select id from public.players`)
  const pending = await asUser(B, `select id from public.players`)
  assert(member.rows.length === 2, `player should see 2 players, got ${member.rows.length}`)
  assert(pending.rows.length === 0, `pending user should see 0 players, got ${pending.rows.length}`)
})

await test('a player sees only their own role assignments', async () => {
  const own = await asUser(A, `select role_id from public.user_roles`)
  const other = await asUser(B, `select role_id from public.user_roles`)
  assert(own.rows.length === 1, `A should see 1 assignment, got ${own.rows.length}`)
  assert(other.rows.length === 0, `B should see 0 assignments, got ${other.rows.length}`)
})

await test('a player sees only their own registration request', async () => {
  const self = await asUser(B, `select id from public.registration_requests`)
  const none = await asUser(A, `select id from public.registration_requests`)
  assert(self.rows.length === 1 && self.rows[0].id === RR1, 'B should see their request')
  assert(none.rows.length === 0, `A should see 0 requests, got ${none.rows.length}`)
})

await test('audit logs are visible only to a super admin', async () => {
  const player = await asUser(A, `select id from public.audit_logs`)
  const admin = await asUser(C, `select id from public.audit_logs`)
  assert(player.rows.length === 0, `player should see 0 audit rows, got ${player.rows.length}`)
  assert(admin.rows.length === 1, `admin should see 1 audit row, got ${admin.rows.length}`)
})

await test('app settings are readable by active club members only', async () => {
  const member = await asUser(A, `select key, value from public.app_settings`)
  const pending = await asUser(B, `select key from public.app_settings`)
  const admin = await asUser(C, `select key from public.app_settings`)
  assert(member.rows.length === 1 && member.rows[0].key === 'club.name', 'A should read club settings')
  assert(pending.rows.length === 0, `pending user should see 0 settings, got ${pending.rows.length}`)
  assert(admin.rows.length === 1, `admin should see 1 setting, got ${admin.rows.length}`)
})

await test('anon has no access to profiles', async () => {
  await expectError(
    'anon profile read',
    () => asRole('anon', `select id from public.profiles`),
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
// Write behaviour
// ---------------------------------------------------------------------------
await test('a user cannot create a profile directly', async () => {
  await expectErrorAs(
    G,
    `insert into public.profiles (id, full_name) values ('${G}', 'Gina New')`,
    /permission denied/i,
  )
})

await test('submit_registration creates one pending profile and request', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', G)

    const first = await db.query(
      `select public.submit_registration($1) as result`,
      ['Gina New'],
    )
    const second = await db.query(
      `select public.submit_registration($1) as result`,
      ['Gina Renamed'],
    )

    assert(first.rows[0].result.status === 'pending', 'first submission should be pending')
    assert(
      second.rows[0].result.request_id === first.rows[0].result.request_id,
      'resubmitting should reuse the pending request',
    )

    await actAs('postgres')
    const profile = await db.query(
      `select full_name, status from public.profiles where id = $1`,
      [G],
    )
    const requests = await db.query(
      `select status, full_name, count(*) over ()::int as total
         from public.registration_requests
        where profile_id = $1`,
      [G],
    )

    assert(profile.rows[0].status === 'pending', 'profile should stay pending')
    assert(profile.rows[0].full_name === 'Gina Renamed', 'latest full name should be stored')
    assert(requests.rows.length === 1 && requests.rows[0].total === 1, 'exactly one request expected')
    assert(requests.rows[0].status === 'pending', 'request should be pending')
  })
})

await test('submit_registration refuses an anonymous caller', async () => {
  await expectError(
    'anonymous registration',
    () =>
      asRole(
        'authenticated',
        `select public.submit_registration('Anonymous')`,
      ),
    /authentication required/i,
  )
})

await test('a user can change their own display name', async () => {
  const result = await asUser(
    A,
    `update public.profiles set full_name = 'Alex Renamed' where id = $1 returning full_name`,
    [A],
  )
  assert(result.rows[0].full_name === 'Alex Renamed', 'rename should be returned')
})

await test('a user cannot change their own status', async () => {
  await expectErrorAs(
    A,
    `update public.profiles set status = 'active' where id = '${A}'`,
    /permission denied/i,
  )
})

await test('a player cannot create player records', async () => {
  await expectErrorAs(
    A,
    `insert into public.players (full_name) values ('Unauthorised')`,
    /row-level security/i,
  )
})

await test('a tournament manager can create a player record', async () => {
  const result = await asUser(
    D,
    `insert into public.players (full_name, gender) values ('New Player', 'female') returning id`,
  )
  assert(result.rows.length === 1, 'manager insert should return one row')
})

await test('a player cannot update player records', async () => {
  const result = await asUser(
    A,
    `update public.players set full_name = 'Changed' where id = '${P1}' returning id`,
  )
  assert(result.rows.length === 0, 'RLS should filter out the player record for a plain player')
})

await test('a tournament manager can update a player record', async () => {
  const result = await asUser(
    D,
    `update public.players set status = 'inactive' where id = '${P1}' returning status`,
  )
  assert(result.rows[0]?.status === 'inactive', 'manager update should affect the record')
})

await test('clients cannot assign roles', async () => {
  await expectErrorAs(
    A,
    `insert into public.user_roles (profile_id, role_id) select '${A}', id from public.roles where key = 'super_admin'`,
    /permission denied/i,
  )
})

await test('clients cannot create registration requests directly', async () => {
  await expectErrorAs(
    A,
    `insert into public.registration_requests (profile_id, email, full_name) values ('${A}', 'x@example.test', 'X')`,
    /permission denied/i,
  )
})

await test('clients cannot write audit logs', async () => {
  await expectErrorAs(
    A,
    `insert into public.audit_logs (action, target_table) values ('forged', 'profiles')`,
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
// ShuttlePower bootstrap
// ---------------------------------------------------------------------------
await test('club members read SP accounts, pending users do not', async () => {
  const member = await asUser(A, `select player_id, current_sp from public.sp_accounts`)
  const pending = await asUser(B, `select player_id from public.sp_accounts`)
  assert(member.rows.length === 1 && member.rows[0].current_sp === 1000, 'A should see 1000 SP')
  assert(pending.rows.length === 0, `pending user should see 0 accounts, got ${pending.rows.length}`)
})

await test('the SP ledger is visible to its owner and a super admin only', async () => {
  const owner = await asUser(A, `select id from public.sp_transactions`)
  const other = await asUser(B, `select id from public.sp_transactions`)
  const admin = await asUser(C, `select id from public.sp_transactions`)
  assert(owner.rows.length === 1, `owner should see 1 transaction, got ${owner.rows.length}`)
  assert(other.rows.length === 0, `pending user should see 0 transactions, got ${other.rows.length}`)
  assert(admin.rows.length === 1, `admin should see 1 transaction, got ${admin.rows.length}`)
})

await test('players cannot write SP accounts or the ledger', async () => {
  await expectErrorAs(
    A,
    `insert into public.sp_accounts (player_id, current_sp) values ('${P1}', 5000)`,
    /permission denied/i,
  )
  await expectErrorAs(
    A,
    `update public.sp_accounts set current_sp = 5000 where player_id = '${P1}'`,
    /permission denied/i,
  )
  await expectErrorAs(
    A,
    `insert into public.sp_transactions (player_id, transaction_type, sp_before, sp_delta, sp_after, idempotency_key)
       values ('${P1}', 'friendly', 1000, 10, 1010, 'forged')`,
    /permission denied/i,
  )
})

async function expectAppendOnly(sql) {
  await db.exec('begin')
  try {
    await expectError('append-only ledger', () => db.exec(sql), /append-only/i)
  } finally {
    await db.exec('rollback')
  }
}

await test('the SP ledger rejects update, delete, and truncate', async () => {
  await expectAppendOnly(`update public.sp_transactions set sp_delta = 2000, sp_after = 2000`)
  await expectAppendOnly(`delete from public.sp_transactions`)
  await expectAppendOnly(`truncate public.sp_transactions`)
})

await test('SP idempotency keys are unique', async () => {
  await expectError(
    'duplicate SP idempotency key',
    () =>
      db.exec(
        `insert into public.sp_transactions (player_id, transaction_type, sp_before, sp_delta, sp_after, idempotency_key)
         values ('${P1}', 'initial', 0, 1000, 1000, 'player:${P1}:initial')`,
      ),
    /duplicate key|unique/i,
  )
})

await test('SP ledger arithmetic must reconcile', async () => {
  await expectError(
    'unbalanced SP transaction',
    () =>
      db.exec(
        `insert into public.sp_transactions (player_id, transaction_type, sp_before, sp_delta, sp_after, idempotency_key)
         values ('${P1}', 'friendly', 0, 1000, 1200, 'unbalanced')`,
      ),
    /sp_transactions_balance_check/i,
  )
})

// ---------------------------------------------------------------------------
// Group G: registration, approval, roles, status, and starting SP
// ---------------------------------------------------------------------------
await test('a non-admin cannot approve a registration', async () => {
  await expectError(
    'player approval attempt',
    () =>
      asUser(
        A,
        `select public.approve_registration('${RR1}', array['player'], null)`,
      ),
    /not authorized/i,
  )
})

await test('approval is atomic and idempotent (Gate G)', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)

    const first = await db.query(
      `select public.approve_registration('${RR1}', array['player'], null) as result`,
    )
    const second = await db.query(
      `select public.approve_registration('${RR1}', array['player'], null) as result`,
    )

    assert(first.rows[0].result.status === 'approved', 'first approval should succeed')
    assert(first.rows[0].result.already_processed === false, 'first approval is not a replay')
    assert(second.rows[0].result.already_processed === true, 'second approval must be a replay')
    assert(
      first.rows[0].result.player_id === second.rows[0].result.player_id,
      'both calls must return the same player',
    )
    assert(first.rows[0].result.current_sp === 1000, 'approval should return 1,000 SP')

    await actAs('postgres')
    const state = await db.query(`
      select
        (select count(*)::int from public.players where profile_id = '${B}') as player_count,
        (select count(*)::int from public.user_roles where profile_id = '${B}') as role_count,
        (select count(*)::int
           from public.sp_transactions st
           join public.players p on p.id = st.player_id
          where p.profile_id = '${B}'
            and st.transaction_type = 'initial') as initial_sp_rows,
        (select count(*)::int
           from public.audit_logs
          where action = 'registration.approve'
            and target_id = '${RR1}') as approval_audits,
        (select status from public.registration_requests where id = '${RR1}') as request_status,
        (select status from public.profiles where id = '${B}') as profile_status
    `)

    const row = state.rows[0]
    assert(row.player_count === 1, `expected one player, got ${row.player_count}`)
    assert(row.role_count === 1, `expected one role assignment, got ${row.role_count}`)
    assert(row.initial_sp_rows === 1, `expected one initial SP row, got ${row.initial_sp_rows}`)
    assert(row.approval_audits === 1, `expected one approval audit, got ${row.approval_audits}`)
    assert(row.request_status === 'approved', 'request should be approved')
    assert(row.profile_status === 'active', 'profile should be active')

    const balance = await db.query(
      `select current_sp from public.sp_accounts where player_id = $1`,
      [first.rows[0].result.player_id],
    )
    assert(balance.rows[0].current_sp === 1000, 'account balance should be 1,000 SP')
  })
})

await test('approval can assign several roles and audits the set', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    await db.query(
      `select public.approve_registration('${RR1}', array['player','trainer'], null)`,
    )

    await actAs('postgres')
    const roles = await db.query(`
      select r.key
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
       where ur.profile_id = '${B}'
       order by r.key
    `)
    assert(
      roles.rows.map((row) => row.key).join(',') === 'player,trainer',
      `unexpected roles: ${roles.rows.map((row) => row.key).join(',')}`,
    )

    const audit = await db.query(`
      select after_data->'roles' as roles
        from public.audit_logs
       where action = 'registration.approve'
         and target_id = '${RR1}'
    `)
    assert(
      audit.rows[0].roles.includes('trainer') && audit.rows[0].roles.includes('player'),
      'audit should record the assigned roles',
    )
  })
})

await test('approval refuses an unknown role', async () => {
  await expectError(
    'unknown role approval',
    () =>
      asUser(
        C,
        `select public.approve_registration('${RR1}', array['player','wizard'], null)`,
      ),
    /unknown role/i,
  )
})

await test('approval links an existing unlinked player record', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const result = await db.query(
      `select public.approve_registration('${RR2}', array['player'], '${P2}') as result`,
    )

    assert(result.rows[0].result.player_id === P2, 'approval should use the selected player')

    await actAs('postgres')
    const player = await db.query(
      `select profile_id from public.players where id = '${P2}'`,
    )
    const linkedCount = await db.query(
      `select count(*)::int as total from public.players where profile_id = '${E}'`,
    )
    const balance = await db.query(
      `select current_sp from public.sp_accounts where player_id = '${P2}'`,
    )

    assert(player.rows[0].profile_id === E, 'existing player should be linked to the profile')
    assert(linkedCount.rows[0].total === 1, 'linking must not create a duplicate player')
    assert(balance.rows[0].current_sp === 1000, 'linked player should receive 1,000 SP')
  })
})

await test('approval cannot steal a player already linked to another account', async () => {
  await inTransaction(async () => {
    await db.exec(`
      insert into public.registration_requests (id, profile_id, email, full_name)
      values ('${RR3}', '${H}', 'hal@example.test', 'Hal Pending')
    `)

    await actAs('authenticated', C)

    let caught
    try {
      await db.query(
        `select public.approve_registration('${RR3}', array['player'], '${P1}')`,
      )
    } catch (error) {
      caught = error
    }

    assert(caught, 'expected the approval to fail')
    assert(/already linked/i.test(caught.message), `unexpected error: ${caught.message}`)
  })
})

await test('rejection requires a reason, is audited, and is idempotent', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)

    const first = await db.query(
      `select public.reject_registration('${RR1}', 'Please contact the club') as result`,
    )
    const second = await db.query(
      `select public.reject_registration('${RR1}', 'Please contact the club') as result`,
    )

    assert(first.rows[0].result.already_processed === false, 'first rejection is new')
    assert(second.rows[0].result.already_processed === true, 'second rejection is a replay')

    await actAs('postgres')
    const request = await db.query(`
      select status, decision_note,
             (select count(*)::int from public.audit_logs
               where action = 'registration.reject' and target_id = '${RR1}') as audits
        from public.registration_requests
       where id = '${RR1}'
    `)
    assert(request.rows[0].status === 'rejected', 'request should be rejected')
    assert(
      request.rows[0].decision_note === 'Please contact the club',
      'rejection reason should be stored',
    )
    assert(request.rows[0].audits === 1, 'rejection should be audited once')
  })
})

await test('an approved request cannot be rejected', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    await db.query(`select public.approve_registration('${RR1}', array['player'], null)`)

    let caught
    try {
      await db.query(`select public.reject_registration('${RR1}', 'Too late')`)
    } catch (error) {
      caught = error
    }

    assert(caught, 'expected the rejection to fail')
    assert(/approved/i.test(caught.message), `unexpected error: ${caught.message}`)
  })
})

await test('a rejected user can submit a fresh request', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    await db.query(`select public.reject_registration('${RR1}', 'Try again')`)

    await actAs('authenticated', B)
    const submitted = await db.query(
      `select public.submit_registration('Bea Resubmitted') as result`,
    )
    assert(submitted.rows[0].result.status === 'pending', 'resubmission should be pending')

    await actAs('postgres')
    const requests = await db.query(`
      select status, full_name
        from public.registration_requests
       where profile_id = '${B}'
       order by requested_at
    `)
    assert(requests.rows.length === 2, `expected two requests, got ${requests.rows.length}`)
    assert(requests.rows[0].status === 'rejected', 'first request should remain rejected')
    assert(requests.rows[1].status === 'pending', 'second request should be pending')
    assert(requests.rows[1].full_name === 'Bea Resubmitted', 'resubmission should update the name')
  })
})

await test('starting SP is awarded once even when called twice directly', async () => {
  await inTransaction(async () => {
    await db.exec(`select public.grant_starting_sp('${P2}', null)`)
    await db.exec(`select public.grant_starting_sp('${P2}', null)`)

    const state = await db.query(`
      select
        (select count(*)::int from public.sp_transactions
          where player_id = '${P2}' and transaction_type = 'initial') as rows,
        (select current_sp from public.sp_accounts where player_id = '${P2}') as balance
    `)
    assert(state.rows[0].rows === 1, `expected one initial SP row, got ${state.rows[0].rows}`)
    assert(state.rows[0].balance === 1000, 'balance should remain 1,000 SP')
  })
})

await test('suspension revokes access and is audited', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const result = await db.query(
      `select public.set_profile_status('${A}', 'suspended') as result`,
    )
    assert(result.rows[0].result.changed === true, 'status should change')

    const role = await db.query(`select public.has_role('${A}', 'player') as allowed`)
    assert(role.rows[0].allowed === false, 'suspended profile must lose its role')

    await actAs('authenticated', A)
    const players = await db.query(`select id from public.players`)
    assert(players.rows.length === 0, 'suspended profile must not read club players')

    await actAs('postgres')
    const audit = await db.query(`
      select count(*)::int as total
        from public.audit_logs
       where action = 'profile.status'
         and target_id = '${A}'
    `)
    assert(audit.rows[0].total === 1, 'status change should be audited')
  })
})

await test('a Super Admin cannot suspend themselves', async () => {
  await expectError(
    'self suspension',
    () =>
      asUser(
        C,
        `select public.set_profile_status('${C}', 'suspended')`,
      ),
    /cannot change your own access/i,
  )
})

await test('pending profiles cannot be activated outside approval', async () => {
  await expectError(
    'pending profile activation',
    () =>
      asUser(
        C,
        `select public.set_profile_status('${B}', 'active')`,
      ),
    /registration approval/i,
  )
})

await test('submitting from an active profile is a no-op', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', A)
    const result = await db.query(`select public.submit_registration('Ignored') as result`)
    assert(result.rows[0].result.status === 'active', 'active profile should stay active')

    await actAs('postgres')
    const requests = await db.query(`
      select count(*)::int as total
        from public.registration_requests
       where profile_id = '${A}'
    `)
    assert(requests.rows[0].total === 0, 'active profile must not get a request')
  })
})

// ---------------------------------------------------------------------------
// Group H: ownership, privacy, and no-write guarantees
// ---------------------------------------------------------------------------
async function expectAuthorizationError(name, action) {
  let caught
  try {
    await action()
  } catch (error) {
    caught = error
  }

  if (!caught) {
    throw new Error(`${name}: expected an authorization error, but the call succeeded`)
  }

  if (!/not authorized/i.test(caught.message)) {
    throw new Error(`${name}: expected "not authorized", got: ${caught.message}`)
  }

  if (caught.code && caught.code !== '42501') {
    throw new Error(`${name}: expected SQLSTATE 42501, got ${caught.code}`)
  }
}

await test('H1: a player reads only their own profile row', async () => {
  const byId = await asUser(A, `select id from public.profiles where id = '${B}'`)
  const others = await asUser(A, `select id from public.profiles where id <> '${A}'`)
  const admin = await asUser(C, `select id from public.profiles where id = '${B}'`)

  assert(byId.rows.length === 0, 'a player must not read another profile by id')
  assert(others.rows.length === 0, `a player must see 0 other profiles, got ${others.rows.length}`)
  assert(admin.rows.length === 1, 'a super admin may read a pending profile')
})

await test('H1: a player cannot update another profile or its status', async () => {
  const updated = await asUser(
    A,
    `update public.profiles set full_name = 'Hijacked' where id = '${B}' returning id`,
  )
  assert(updated.rows.length === 0, 'RLS must keep another profile out of the update')

  await expectErrorAs(
    A,
    `update public.profiles set status = 'active' where id = '${B}'`,
    /permission denied/i,
  )

  const stored = await db.query(`select full_name, status from public.profiles where id = $1`, [B])
  assert(stored.rows[0].full_name === 'Bea Pending', 'the other profile name must be unchanged')
  assert(stored.rows[0].status === 'pending', 'the other profile status must be unchanged')
})

await test('H2: Phase 1 stores no contact details on profiles or players', async () => {
  const { rows } = await db.query(`
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name in ('profiles', 'players')
       and column_name ~ '(email|phone|mobile|contact|address|birth)'
  `)
  assert(
    rows.length === 0,
    `unexpected contact columns: ${rows
      .map((row) => `${row.table_name}.${row.column_name}`)
      .join(', ')}`,
  )
})

await test('H2: a player cannot read another member\u2019s request or email', async () => {
  const byId = await asUser(A, `select email from public.registration_requests where id = '${RR1}'`)
  const all = await asUser(A, `select email from public.registration_requests`)
  const own = await asUser(B, `select email from public.registration_requests`)
  const admin = await asUser(C, `select email from public.registration_requests`)

  assert(byId.rows.length === 0, 'a player must not read another request by id')
  assert(all.rows.length === 0, `a player must see 0 request emails, got ${all.rows.length}`)
  assert(
    own.rows.length === 1 && own.rows[0].email === 'bea@example.test',
    'a member may read their own request email',
  )
  assert(admin.rows.length === 2, `a super admin should see 2 requests, got ${admin.rows.length}`)
})

await test('H2: the auth email table is unreachable from a client role', async () => {
  await expectErrorAs(A, `select email from auth.users`, /permission denied/i)
  await expectErrorAs(C, `select email from auth.users`, /permission denied/i)
  await expectError('anon auth read', () => asRole('anon', `select email from auth.users`), /permission denied/i)
})

await test('H3: no client can write roles, role assignments, audit logs, or SP', async () => {
  for (const uid of [A, C]) {
    await expectErrorAs(
      uid,
      `insert into public.roles (key, label) values ('wizard', 'Wizard')`,
      /permission denied/i,
    )
    await expectErrorAs(uid, `update public.roles set label = 'Changed'`, /permission denied/i)
    await expectErrorAs(
      uid,
      `insert into public.user_roles (profile_id, role_id) select '${uid}', id from public.roles where key = 'player'`,
      /permission denied/i,
    )
    await expectErrorAs(uid, `update public.user_roles set granted_by = '${uid}'`, /permission denied/i)
    await expectErrorAs(uid, `delete from public.user_roles where profile_id = '${uid}'`, /permission denied/i)
    await expectErrorAs(uid, `update public.audit_logs set action = 'forged'`, /permission denied/i)
    await expectErrorAs(uid, `delete from public.audit_logs`, /permission denied/i)
    await expectErrorAs(uid, `update public.sp_accounts set current_sp = 9999`, /permission denied/i)
    await expectErrorAs(uid, `delete from public.sp_transactions`, /permission denied/i)
  }
})

await test('H4: unapproved callers get an authorization error, not empty data', async () => {
  await expectAuthorizationError('pending approval attempt', () =>
    asUser(B, `select public.approve_registration('${RR1}', array['player'], null)`),
  )
  await expectAuthorizationError('pending rejection attempt', () =>
    asUser(B, `select public.reject_registration('${RR1}', 'self-approval')`),
  )
  await expectAuthorizationError('pending status change', () =>
    asUser(B, `select public.set_profile_status('${B}', 'active')`),
  )
  await expectAuthorizationError('profile-less approval attempt', () =>
    asUser(G, `select public.approve_registration('${RR1}', array['player'], null)`),
  )
  await expectAuthorizationError('tournament manager approval attempt', () =>
    asUser(D, `select public.approve_registration('${RR1}', array['player'], null)`),
  )
})

await test('H4: a suspended Super Admin loses RPC authority immediately', async () => {
  await inTransaction(async () => {
    await db.exec(`update public.profiles set status = 'suspended' where id = '${C}'`)
    await actAs('authenticated', C)

    await expectAuthorizationError('suspended admin approval', () =>
      db.query(`select public.approve_registration('${RR1}', array['player'], null)`),
    )
  })
})

await test('H4: anon cannot execute any auth-lifecycle function', async () => {
  const { rows } = await db.query(`
    select p.proname as name,
           has_function_privilege('anon', p.oid, 'EXECUTE') as allowed
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'submit_registration',
         'approve_registration',
         'reject_registration',
         'set_profile_status',
         'grant_starting_sp',
         'require_super_admin'
       )
  `)

  assert(rows.length === 6, `expected six functions, found ${rows.length}`)
  for (const row of rows) assert(row.allowed === false, `anon must not execute ${row.name}`)
})

await test('§5 matrix: account linking and role grants only cross an RPC', async () => {
  await expectErrorAs(
    C,
    `update public.players set profile_id = '${B}' where id = '${P2}'`,
    /permission denied/i,
  )

  for (const uid of [A, B, D]) {
    await expectErrorAs(
      uid,
      `insert into public.user_roles (profile_id, role_id, granted_by)
       select '${uid}', id, '${uid}' from public.roles where key = 'super_admin'`,
      /permission denied/i,
    )
  }
})

await test('§5 matrix: anon holds no table privilege on any Phase 1 table', async () => {
  const { rows } = await db.query(`
    select t.table_name,
           has_table_privilege('anon', 'public.' || quote_ident(t.table_name), 'SELECT') as can_select
      from information_schema.tables as t
     where t.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
     order by t.table_name
  `)

  assert(rows.length === 9, `expected nine tables, found ${rows.length}`)
  for (const row of rows) assert(row.can_select === false, `anon must not read ${row.table_name}`)
})

// ---------------------------------------------------------------------------
// Group I: fictional development seed
// ---------------------------------------------------------------------------
await test('I2: the seed refuses a project that is not marked development', async () => {
  await db.exec('begin')
  try {
    await expectError('seed without marker', () => db.exec(seed), /refusing to seed/i)
  } finally {
    await db.exec('rollback')
  }
})

await test('I1/I3: the seed creates fictional accounts with every role and mixed statuses', async () => {
  await inTransaction(async () => {
    await db.exec(
      `insert into public.app_settings (key, value)
       values ('club.environment', '"development"'::jsonb)`,
    )
    await db.exec(seed)

    const { rows } = await db.query(`
      select
        (select count(*)::int from auth.users where id::text like '5eed0000-%') as accounts,
        (select count(*)::int from auth.identities where user_id::text like '5eed0000-%') as identities,
        (select count(*)::int from public.profiles where id::text like '5eed0000-%') as profiles,
        (select count(*)::int from public.players where id::text like '5eed1000-%') as players,
        (select count(*)::int from public.registration_requests where id::text like '5eed2000-%') as requests,
        (select count(distinct r.key)::int
           from public.user_roles ur
           join public.roles r on r.id = ur.role_id
          where ur.profile_id::text like '5eed0000-%') as distinct_roles,
        (select count(*)::int
           from public.players p
           join public.sp_accounts a on a.player_id = p.id
          where p.id::text like '5eed1000-%' and a.current_sp = 1000) as funded,
        (select count(*)::int
           from public.sp_transactions st
          where st.player_id::text like '5eed1000-%' and st.transaction_type = 'initial') as initial_rows,
        (select count(*)::int from public.profiles
          where id::text like '5eed0000-%' and status = 'pending') as pending_profiles,
        (select count(*)::int from public.profiles
          where id::text like '5eed0000-%' and status = 'suspended') as suspended_profiles,
        (select count(*)::int
           from public.players p
           join public.profiles pr on pr.id = p.profile_id
          where pr.id::text like '5eed0000-%' and pr.status = 'pending') as pending_with_player,
        (select count(*)::int from auth.users
          where id::text like '5eed0000-%' and email not like '%@example.test') as real_emails,
        (select count(*)::int from auth.users
          where id::text like '5eed0000-%'
            and (confirmation_token is null
              or recovery_token is null
              or email_change is null
              or email_change_token_new is null
              or email_change_token_current is null
              or phone_change is null
              or phone_change_token is null
              or reauthentication_token is null
              or is_sso_user is null
              or is_anonymous is null
              or email_change_confirm_status is null)) as null_tokens,
        (select count(*)::int from public.registration_requests
          where id::text like '5eed2000-%' and status = 'pending') as pending_requests
    `)

    const row = rows[0]
    assert(row.accounts === 6, `expected six demo accounts, got ${row.accounts}`)
    assert(row.identities === 6, `expected six email identities, got ${row.identities}`)
    assert(row.profiles === 6, `expected six profiles, got ${row.profiles}`)
    assert(row.players === 5, `expected five player records, got ${row.players}`)
    assert(row.requests === 2, `expected two registration requests, got ${row.requests}`)
    assert(row.pending_requests === 1, 'one request should await review')
    assert(row.distinct_roles === 4, `expected all four roles, got ${row.distinct_roles}`)
    assert(row.funded === 5, `expected five funded players, got ${row.funded}`)
    assert(row.initial_rows === 5, `expected five initial SP rows, got ${row.initial_rows}`)
    assert(row.pending_profiles === 1, 'one profile should be pending')
    assert(row.suspended_profiles === 1, 'one profile should be suspended')
    assert(row.pending_with_player === 0, 'a pending profile must not own a player record')
    assert(row.real_emails === 0, 'every seeded email must use the example.test domain')
    assert(row.null_tokens === 0, 'seeded auth rows must not leave GoTrue string columns NULL')
  })
})

await test('I2: re-running the seed repairs NULL GoTrue columns', async () => {
  await inTransaction(async () => {
    await db.exec(
      `insert into public.app_settings (key, value)
       values ('club.environment', '"development"'::jsonb)`,
    )
    await db.exec(seed)

    // Break every seeded row, not just one: several rows must be able to share
    // '' under Supabase's partial unique token indexes.
    await db.exec(`
      update auth.users
         set confirmation_token = null,
             recovery_token = null,
             email_change = null,
             email_change_token_new = null,
             email_change_token_current = null,
             phone = null,
             phone_change = null,
             phone_change_token = null,
             reauthentication_token = null,
             is_sso_user = null,
             is_anonymous = null,
             email_change_confirm_status = null
       where id::text like '5eed0000-%'
    `)

    await db.exec(seed)

    const { rows } = await db.query(`
      select
        count(*)::int as total,
        count(*) filter (
          where confirmation_token is null
             or recovery_token is null
             or email_change is null
             or email_change_token_new is null
             or email_change_token_current is null
             or phone_change is null
             or phone_change_token is null
             or reauthentication_token is null
             or is_sso_user is null
             or is_anonymous is null
             or email_change_confirm_status is null
        )::int as broken,
        count(*) filter (where phone is not null)::int as phones,
        count(*) filter (where confirmation_token <> ''
                            or email_change <> '')::int as populated_tokens
        from auth.users
       where id::text like '5eed0000-%'
    `)

    assert(rows[0].total === 6, 'the seed must own six demo auth rows')
    assert(
      rows[0].broken === 0,
      'the second run must reset every GoTrue token column to an empty string, even though the token indexes are unique',
    )

    assert(
      rows[0].phones === 0,
      'phone is unique and NULL-safe for GoTrue, so the repair must leave it NULL',
    )

    assert(
      rows[0].populated_tokens === 0,
      'the repaired token columns must hold the empty string GoTrue itself writes',
    )
  })
})

await test('I2: re-running the seed adds nothing', async () => {
  await inTransaction(async () => {
    await db.exec(
      `insert into public.app_settings (key, value)
       values ('club.environment', '"development"'::jsonb)`,
    )
    await db.exec(seed)
    await db.exec(seed)

    const { rows } = await db.query(`
      select
        (select count(*)::int from auth.users where id::text like '5eed0000-%') as accounts,
        (select count(*)::int from public.profiles where id::text like '5eed0000-%') as profiles,
        (select count(*)::int from public.players where id::text like '5eed1000-%') as players,
        (select count(*)::int from public.user_roles where profile_id::text like '5eed0000-%') as role_assignments,
        (select count(*)::int from public.registration_requests where id::text like '5eed2000-%') as requests,
        (select count(*)::int from public.sp_transactions where player_id::text like '5eed1000-%') as sp_rows,
        (select count(*)::int from public.sp_accounts
          where player_id::text like '5eed1000-%' and current_sp = 1000) as funded
    `)

    const row = rows[0]
    assert(row.accounts === 6, `accounts duplicated: ${row.accounts}`)
    assert(row.profiles === 6, `profiles duplicated: ${row.profiles}`)
    assert(row.players === 5, `players duplicated: ${row.players}`)
    assert(row.role_assignments === 5, `role assignments duplicated: ${row.role_assignments}`)
    assert(row.requests === 2, `requests duplicated: ${row.requests}`)
    assert(row.sp_rows === 5, `initial SP rows duplicated: ${row.sp_rows}`)
    assert(row.funded === 5, `SP balances changed: ${row.funded}`)
  })
})

// ---------------------------------------------------------------------------
// Group J: one-time first Super Admin bootstrap (D8)
// ---------------------------------------------------------------------------
await test('J4: the bootstrap refuses to run without an explicit email', async () => {
  await inTransaction(async () => {
    await expectError('bootstrap without email', () => db.exec(bootstrap), /refusing to bootstrap/i)
  })
})

await test('J4: the bootstrap activates a pending profile and grants super_admin once', async () => {
  await inTransaction(async () => {
    await db.exec(`set local mbc.bootstrap_super_admin_email = 'eve@example.test'`)
    await db.exec(bootstrap)
    await db.exec(bootstrap)

    const { rows } = await db.query(`
      select
        (select status from public.profiles where id = '${E}') as status,
        (select count(*)::int
           from public.user_roles ur
           join public.roles r on r.id = ur.role_id
          where ur.profile_id = '${E}' and r.key = 'super_admin') as super_admin_rows,
        (select count(*)::int
           from public.audit_logs
          where action = 'profile.bootstrap_super_admin'
            and target_id = '${E}') as audits,
        (select public.has_role('${E}', 'super_admin')) as allowed
    `)

    const row = rows[0]
    assert(row.status === 'active', `profile should be active, got ${row.status}`)
    assert(row.super_admin_rows === 1, `expected one super_admin row, got ${row.super_admin_rows}`)
    assert(row.audits === 1, `expected one audit row, got ${row.audits}`)
    assert(row.allowed === true, 'the bootstrapped profile should hold super_admin')
  })
})

await test('J4: the bootstrap rejects an unknown or suspended account', async () => {
  await inTransaction(async () => {
    await db.exec(`set local mbc.bootstrap_super_admin_email = 'nobody@example.test'`)
    await expectError('bootstrap unknown email', () => db.exec(bootstrap), /no profile found/i)
  })

  await inTransaction(async () => {
    await db.exec(`update public.profiles set status = 'suspended' where id = '${A}'`)
    await db.exec(`set local mbc.bootstrap_super_admin_email = 'alex@example.test'`)
    await expectError('bootstrap suspended profile', () => db.exec(bootstrap), /refusing to bootstrap/i)
  })
})

await test('J4: the bootstrap is not exposed as an API function', async () => {
  const { rows } = await db.query(`
    select count(*)::int as bootstrap_functions
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname ilike '%bootstrap%'
  `)

  assert(
    rows[0].bootstrap_functions === 0,
    'the bootstrap must stay a SQL script, never a callable function',
  )
})

// ---------------------------------------------------------------------------
await db.close()

console.log(`\n${passed} passed, ${failures.length} failed`)

if (failures.length > 0) {
  process.exitCode = 1
}
