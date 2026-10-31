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
  playerMigration,
  tournamentMigration,
  spRuleMigration,
  identityPolicies,
  operationPolicies,
  spPolicies,
  authPolicies,
  tournamentPolicies,
  spRulePolicies,
  seed,
  bootstrap,
] = await Promise.all([
  readFile(join(backendDir, 'migrations', '001_identity.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '002_shuttlepower_bootstrap.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '003_auth_lifecycle.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '004_players.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '005_tournaments.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '006_shuttlepower_rules.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '001_identity.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '002_operations.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '003_shuttlepower.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '004_auth_lifecycle.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '005_tournaments.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '006_shuttlepower_rules.sql'), 'utf8'),
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
const P3 = '33333333-1111-4111-8111-333333333333' // male player
const P4 = '44444444-1111-4111-8111-444444444444' // female player
const P5 = '55555555-1111-4111-8111-555555555555' // male player
const P6 = '66666666-1111-4111-8111-666666666666' // no recorded gender
const P7 = '77777777-1111-4111-8111-777777777777' // inactive player
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
  'sp_rule_versions',
  'sp_transactions',
  'tournaments',
  'tournament_events',
  'teams',
  'team_members',
  'tournament_entries',
  'matches',
  'match_games',
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

/** Runs an expected-to-fail query inside the current transaction, preserving it. */
async function expectQueryError(sql, pattern) {
  await db.exec('savepoint expected_error')
  try {
    await expectError('query inside transaction', () => db.query(sql), pattern)
  } finally {
    await db.exec('rollback to savepoint expected_error')
  }
}

async function createTournament(name = 'Club Cup') {
  const { rows } = await db.query(
    `select public.create_tournament('${name}', '2026-11-01', '2026-11-02') as result`,
  )
  return rows[0].result
}

async function createEvent(
  tournamentId,
  discipline = 'singles',
  format = 'single_elimination',
  maxEntries = 8,
) {
  const { rows } = await db.query(
    `select public.create_tournament_event('${tournamentId}', '${discipline}', '${format}', ${maxEntries}) as result`,
  )
  return rows[0].result
}

async function registerEntry(eventId, playerIds, seed = null) {
  const ids = playerIds.map((id) => `'${id}'`).join(', ')
  return db.query(
    `select public.register_tournament_entry('${eventId}', array[${ids}]::uuid[], ${seed ?? 'null'}) as result`,
  )
}

async function saveDraw(eventId, matches, replace = false) {
  const payload = JSON.stringify(matches).replaceAll("'", "''")
  const { rows } = await db.query(
    `select public.save_tournament_draw('${eventId}', '${payload}'::jsonb, ${replace}) as result`,
  )
  return rows[0].result
}

async function matchIdFor(eventId, bracket, round, position = 1) {
  const { rows } = await db.query(
    `select id from public.matches
      where event_id = '${eventId}'
        and bracket = '${bracket}'
        and round = ${round}
        and position = ${position}`,
  )
  assert(rows[0], `missing ${bracket} round ${round} match`)
  return rows[0].id
}

async function recordResult(matchId, games) {
  const payload = JSON.stringify(games).replaceAll("'", "''")
  return db.query(`select public.record_match_result('${matchId}', '${payload}'::jsonb) as result`)
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
await db.exec(playerMigration)
await db.exec(tournamentMigration)
await db.exec(spRuleMigration)
await db.exec(identityPolicies)
await db.exec(operationPolicies)
await db.exec(spPolicies)
await db.exec(authPolicies)
await db.exec(tournamentPolicies)
await db.exec(spRulePolicies)

// ---------------------------------------------------------------------------
// Schema and catalogue
// ---------------------------------------------------------------------------
await test('all expected tables exist', async () => {
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
        and relname = any($1::text[])`,
    [tables],
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

await test('re-running the players migration fails loudly', async () => {
  await expectError(
    're-run players migration',
    async () => {
      try {
        await db.exec(playerMigration)
      } finally {
        await db.exec('rollback')
      }
    },
    /already exists/i,
  )
})

await test('re-running the tournaments migration fails loudly', async () => {
  await expectError(
    're-run tournaments migration',
    async () => {
      try {
        await db.exec(tournamentMigration)
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

  insert into public.players (id, full_name, gender, status) values
    ('${P3}', 'Carlo Male', 'male', 'active'),
    ('${P4}', 'Dana Female', 'female', 'active'),
    ('${P5}', 'Eli Male', 'male', 'active'),
    ('${P6}', 'Fay Unknown', null, 'active'),
    ('${P7}', 'Gina Inactive', 'female', 'inactive');

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

await test('N0: tournament tables are read-only and tournament RPCs are authenticated-only', async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('authenticated', 'public.tournaments', 'SELECT') as tournament_select,
      has_table_privilege('authenticated', 'public.tournaments', 'INSERT') as tournament_insert,
      has_table_privilege('authenticated', 'public.tournament_entries', 'INSERT') as entry_insert,
      has_table_privilege('authenticated', 'public.matches', 'UPDATE') as match_update,
      has_table_privilege('authenticated', 'public.match_games', 'DELETE') as game_delete,
      has_function_privilege('authenticated', 'public.create_tournament(text,date,date,text,text,timestamptz)', 'EXECUTE') as create_execute,
      has_function_privilege('authenticated', 'public.register_tournament_entry(uuid,uuid[],integer)', 'EXECUTE') as entry_execute,
      has_function_privilege('authenticated', 'public.save_tournament_draw(uuid,jsonb,boolean)', 'EXECUTE') as draw_execute,
      has_function_privilege('authenticated', 'public.record_match_result(uuid,jsonb)', 'EXECUTE') as result_execute,
      has_function_privilege('authenticated', 'public.correct_match_result(uuid,jsonb,text)', 'EXECUTE') as correct_execute,
      has_function_privilege('authenticated', 'public.score_match_games(uuid,uuid,jsonb)', 'EXECUTE') as score_execute,
      has_function_privilege('anon', 'public.record_match_result(uuid,jsonb)', 'EXECUTE') as anon_result_execute
  `)
  const row = rows[0]
  assert(row.tournament_select === true, 'authenticated should read tournaments')
  assert(row.tournament_insert === false, 'tournament writes must cross an RPC')
  assert(row.entry_insert === false, 'entries must be inserted by the RPC only')
  assert(row.match_update === false, 'matches must be updated by the result RPC only')
  assert(row.game_delete === false, 'game scores must not be deletable by clients')
  assert(row.create_execute === true, 'authenticated should create tournaments')
  assert(row.entry_execute === true, 'authenticated should register entries')
  assert(row.draw_execute === true, 'authenticated should save a draw')
  assert(row.result_execute === true, 'authenticated should record results')
  assert(row.correct_execute === true, 'authenticated should correct results')
  assert(row.score_execute === false, 'score_match_games must stay internal')
  assert(row.anon_result_execute === false, 'anon must not record results')
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
  assert(member.rows.length === 7, `player should see 7 players, got ${member.rows.length}`)
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

  assert(rows.length === tables.length, `expected ${tables.length} tables, found ${rows.length}`)
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
        (select count(*)::int from public.players
          where id::text like '5eed1000-%' and profile_id is not null) as linked_players,
        (select count(*)::int from public.players
          where id::text like '5eed1000-%' and profile_id is null) as unlinked_players,
        (select count(*)::int from public.players where id::text like '5eed1000-%') as players,
        (select count(*)::int from public.sp_accounts
          where player_id::text like '5eed1000-%') as sp_accounts,
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
    assert(row.players === 6, `expected six player records, got ${row.players}`)
    assert(row.linked_players === 5, `expected five linked players, got ${row.linked_players}`)
    assert(
      row.unlinked_players === 1,
      `expected one unlinked demo player, got ${row.unlinked_players}`,
    )
    assert(row.requests === 2, `expected two registration requests, got ${row.requests}`)
    assert(row.pending_requests === 1, 'one request should await review')
    assert(row.distinct_roles === 4, `expected all four roles, got ${row.distinct_roles}`)
    assert(row.funded === 5, `expected five funded players, got ${row.funded}`)
    assert(row.sp_accounts === 5, `unlinked player must have no SP account, got ${row.sp_accounts}`)
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
        (select count(*)::int from public.players
          where id::text like '5eed1000-%' and profile_id is null) as unlinked,
        (select count(*)::int from public.user_roles where profile_id::text like '5eed0000-%') as role_assignments,
        (select count(*)::int from public.registration_requests where id::text like '5eed2000-%') as requests,
        (select count(*)::int from public.sp_transactions where player_id::text like '5eed1000-%') as sp_rows,
        (select count(*)::int from public.sp_accounts
          where player_id::text like '5eed1000-%' and current_sp = 1000) as funded
    `)

    const row = rows[0]
    assert(row.accounts === 6, `accounts duplicated: ${row.accounts}`)
    assert(row.profiles === 6, `profiles duplicated: ${row.profiles}`)
    assert(row.players === 6, `players duplicated: ${row.players}`)
    assert(row.unlinked === 1, `unlinked demo player duplicated: ${row.unlinked}`)
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
// Group K: player directory lifecycle (Phase 2)
// ---------------------------------------------------------------------------
await test('K1: only a super admin can replace roles', async () => {
  await expectErrorAs(A, `select public.set_profile_roles('${D}', array['player'])`, /not authorized/i)
  await expectErrorAs(D, `select public.set_profile_roles('${A}', array['player'])`, /not authorized/i)
})

await test('K1: role replacement replaces the set and audits once', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)

    const { rows } = await db.query(
      `select public.set_profile_roles('${D}', array['player','trainer']) as result`,
    )

    assert(rows[0].result.changed === true, 'the changed role set must report a change')
    assert(
      rows[0].result.roles.join(',') === 'player,trainer',
      `unexpected roles: ${rows[0].result.roles.join(',')}`,
    )

    const roles = await db.query(`
      select r.key
        from public.user_roles as ur
        join public.roles as r on r.id = ur.role_id
       where ur.profile_id = '${D}'
       order by r.key
    `)

    assert(
      roles.rows.map((row) => row.key).join(',') === 'player,trainer',
      'replacing roles must remove the old role, not append to it',
    )

    const audit = await db.query(`
      select count(*)::int as entries
        from public.audit_logs
       where action = 'profile.roles' and target_id = '${D}'
    `)

    assert(audit.rows[0].entries === 1, 'role replacement must write one audit row')
  })
})

await test('K1: repeating the same role set is a no-op', async () => {
  const { rows } = await asUser(
    C,
    `select public.set_profile_roles('${D}', array['tournament_manager']) as result`,
  )

  assert(rows[0].result.changed === false, 'an unchanged role set must not report a change')
})

await test('K1: unknown roles and empty sets are rejected', async () => {
  await expectError(
    'unknown role',
    () => asUser(C, `select public.set_profile_roles('${D}', array['wizard'])`),
    /unknown role/i,
  )

  await expectError(
    'empty role set',
    () => asUser(C, `select public.set_profile_roles('${D}', array[]::text[])`),
    /at least one role/i,
  )
})

await test('K1: a super admin cannot remove their own super admin role', async () => {
  await expectError(
    'self demotion',
    () => asUser(C, `select public.set_profile_roles('${C}', array['player'])`),
    /cannot remove your own super admin role/i,
  )
})

await test('K1: pending accounts are handled through approval, not role edits', async () => {
  await expectErrorAs(
    C,
    `select public.set_profile_roles('${B}', array['player'])`,
    /pending accounts are handled through registration approval/i,
  )
})

await test('K2: only a super admin can link or unlink accounts', async () => {
  await expectErrorAs(
    A,
    `select public.link_player_account('${A}', '${P2}')`,
    /not authorized/i,
  )
  await expectErrorAs(D, `select public.unlink_player_account('${P1}')`, /not authorized/i)
})

await test('K2: linking an approved account is idempotent and audited', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)

    const first = await db.query(
      `select public.link_player_account('${D}', '${P2}') as result`,
    )
    assert(first.rows[0].result.changed === true, 'the first link must change the record')
    assert(first.rows[0].result.already_linked === false, 'the first link is not a replay')

    const second = await db.query(
      `select public.link_player_account('${D}', '${P2}') as result`,
    )
    assert(second.rows[0].result.changed === false, 'a repeated link must not change anything')
    assert(second.rows[0].result.already_linked === true, 'a repeated link must report the replay')

    const link = await db.query(`select profile_id from public.players where id = '${P2}'`)
    assert(link.rows[0].profile_id === D, 'the player record must point at the approved account')

    const audit = await db.query(`
      select count(*)::int as entries
        from public.audit_logs
       where action = 'player.account_linked' and target_id = '${P2}'
    `)
    assert(audit.rows[0].entries === 1, 'a link must write exactly one audit row, even after a replay')
  })
})

await test('K2: one player record cannot serve two accounts', async () => {
  await expectErrorAs(
    C,
    `select public.link_player_account('${D}', '${P1}')`,
    /already linked to another account/i,
  )
})

await test('K2: one account cannot own two player records', async () => {
  await expectErrorAs(
    C,
    `select public.link_player_account('${A}', '${P2}')`,
    /already has a different player record/i,
  )
})

await test('K2: only an approved account can be linked', async () => {
  await expectErrorAs(
    C,
    `select public.link_player_account('${B}', '${P2}')`,
    /only an approved account/i,
  )
})

await test('K2: unlinking keeps the player record and audits once', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)

    const result = await db.query(`select public.unlink_player_account('${P1}') as result`)
    assert(result.rows[0].result.changed === true, 'the unlink must change the record')

    const player = await db.query(
      `select profile_id, full_name from public.players where id = '${P1}'`,
    )
    assert(player.rows[0].profile_id === null, 'the account link must be cleared')
    assert(player.rows[0].full_name === 'Alex Player', 'the player record must survive the unlink')

    const again = await db.query(`select public.unlink_player_account('${P1}') as result`)
    assert(again.rows[0].result.changed === false, 'a repeated unlink must be a no-op')

    const audit = await db.query(`
      select count(*)::int as entries
        from public.audit_logs
       where action = 'player.account_unlinked' and target_id = '${P1}'
    `)
    assert(audit.rows[0].entries === 1, 'an unlink must write exactly one audit row')
  })
})

await test('K3: clients still cannot write profile_id directly', async () => {
  await expectErrorAs(
    C,
    `update public.players set profile_id = '${D}' where id = '${P2}'`,
    /permission denied/i,
  )
})

await test('K3: anon cannot execute the player lifecycle RPCs', async () => {
  await expectError(
    'anon link',
    () => asRole('anon', `select public.link_player_account('${A}', '${P2}')`),
    /permission denied/i,
  )
  await expectError(
    'anon roles',
    () => asRole('anon', `select public.set_profile_roles('${D}', array['player'])`),
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
// Group N: tournaments, entries, draws, and results
// ---------------------------------------------------------------------------
await test('N1: only tournament staff can create or change tournaments', async () => {
  await expectErrorAs(
    A,
    `select public.create_tournament('Not Mine', '2026-11-01', '2026-11-02')`,
    /not authorized/i,
  )
  await expectErrorAs(
    B,
    `select public.create_tournament('Not Mine', '2026-11-01', '2026-11-02')`,
    /not authorized/i,
  )

  await inTransaction(async () => {
    await actAs('authenticated', C)
    const tournament = await createTournament('Admin Cup')
    assert(tournament.status === 'draft', 'a new tournament must start as a draft')
    assert(tournament.name === 'Admin Cup', 'the name must be stored')
  })
})

await test('N1: the lifecycle is audited and refuses skipped steps', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Autumn Open')

    await expectQueryError(
      `select public.set_tournament_status('${tournament.id}', 'published')`,
      /add at least one event/i,
    )

    await createEvent(tournament.id)

    const published = await db.query(
      `select public.set_tournament_status('${tournament.id}', 'published') as result`,
    )
    assert(published.rows[0].result.changed === true, 'publishing should change the status')

    const again = await db.query(
      `select public.set_tournament_status('${tournament.id}', 'published') as result`,
    )
    assert(again.rows[0].result.changed === false, 'repeating a status must be a no-op')

    await expectQueryError(
      `select public.set_tournament_status('${tournament.id}', 'draft')`,
      /cannot move a tournament/i,
    )

    await actAs('authenticated', C)
    const audit = await db.query(`
      select count(*)::int as entries
        from public.audit_logs
       where action = 'tournament.status' and target_id = '${tournament.id}'
    `)
    assert(audit.rows[0].entries === 1, 'only the real transition should be audited')
  })
})

await test('N1: event discipline, format, cap, and uniqueness are enforced', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Rules Cup')

    await expectQueryError(
      `select public.create_tournament_event('${tournament.id}', 'triples', 'round_robin', 8)`,
      /unknown discipline/i,
    )
    await expectQueryError(
      `select public.create_tournament_event('${tournament.id}', 'singles', 'ladder', 8)`,
      /unknown format/i,
    )
    await expectQueryError(
      `select public.create_tournament_event('${tournament.id}', 'singles', 'round_robin', 1)`,
      /max entries/i,
    )

    const event = await createEvent(tournament.id, 'singles', 'round_robin', 8)
    assert(event.format === 'round_robin', 'the event format must be stored')

    await expectQueryError(
      `select public.create_tournament_event('${tournament.id}', 'singles', 'round_robin', 8)`,
      /duplicate key|unique constraint/i,
    )
  })
})

await test('N2: D10 rejects same-gender and missing-gender doubles pairs', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Mixed Cup')
    const event = await createEvent(tournament.id, 'mixed_doubles', 'single_elimination', 8)

    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P3}', '${P5}']::uuid[])`,
      /mixed doubles needs exactly one male and one female/i,
    )
    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P4}', '${P6}']::uuid[])`,
      /recorded gender/i,
    )
    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P1}', '${P7}']::uuid[])`,
      /missing or inactive/i,
    )

    const entry = await registerEntry(event.id, [P3, P4])
    assert(entry.rows[0].result.team_id, 'a doubles entry must create a team')
    assert(entry.rows[0].result.player_ids.length === 2, 'the pair must be recorded')

    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P3}', '${P4}']::uuid[])`,
      /cannot be registered twice/i,
    )

    const teamCount = await db.query(
      `select count(*)::int as members from public.team_members where team_id = '${entry.rows[0].result.team_id}'`,
    )
    assert(teamCount.rows[0].members === 2, 'the team must have exactly two members')
  })
})

await test('N2: a singles player cannot enter the same event twice', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Singles Cup')
    const event = await createEvent(tournament.id, 'singles')

    await registerEntry(event.id, [P1])
    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P1}']::uuid[])`,
      /cannot be registered twice/i,
    )
  })
})

await test('N2: caps, seeds, and withdrawal behave before a draw', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Seeded Cup')
    const event = await createEvent(tournament.id, 'singles', 'single_elimination', 3)

    await registerEntry(event.id, [P1], 1)
    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P3}']::uuid[], 1)`,
      /seed is already assigned/i,
    )

    await registerEntry(event.id, [P3], 2)
    const fourth = await registerEntry(event.id, [P4], 3)
    const fourthEntry = fourth.rows[0].result.entry_id

    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P5}']::uuid[])`,
      /event is full/i,
    )

    const withdrawn = await db.query(
      `select public.withdraw_tournament_entry('${fourthEntry}') as result`,
    )
    assert(withdrawn.rows[0].result.changed === true, 'withdrawing should change the entry')

    const replacement = await registerEntry(event.id, [P5], 3)
    assert(
      replacement.rows[0].result.seed === 3,
      'withdrawing must free the seed for a replacement',
    )

    const kept = await db.query(
      `select status from public.tournament_entries where id = '${fourthEntry}'`,
    )
    assert(kept.rows[0].status === 'withdrawn', 'a withdrawal must keep the original row')
  })
})

await test('N2: clients cannot write tournament tables directly', async () => {
  await expectErrorAs(
    D,
    `insert into public.tournaments (name, starts_on, ends_on)
     values ('Direct', '2026-11-01', '2026-11-02')`,
    /permission denied/i,
  )
  await expectErrorAs(
    D,
    `update public.tournaments set name = 'Changed'`,
    /permission denied/i,
  )
  await expectErrorAs(A, `delete from public.tournament_entries`, /permission denied/i)
})

await test('N3: a draw must cover every entry and use earlier sources', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Draw Cup')
    const event = await createEvent(tournament.id, 'singles')

    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id
    const third = (await registerEntry(event.id, [P4], 3)).rows[0].result.entry_id

    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '[{"key":"m1","bracket":"winners","round":1,"position":1,"home_entry_id":"${first}","away_entry_id":"${second}"}]'::jsonb)`,
      /place every registered entry/i,
    )

    const brokenSource = JSON.stringify([
      {
        key: 'm1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_source_key: 'm2',
        home_source_outcome: 'winner',
        away_entry_id: second,
      },
    ]).replaceAll("'", "''")

    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '${brokenSource}'::jsonb)`,
      /later or unknown source/i,
    )

    const saved = await saveDraw(event.id, [
      {
        key: 'w-r1-m1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: second,
        away_entry_id: third,
      },
      {
        key: 'w-r2-m1',
        bracket: 'winners',
        round: 2,
        position: 1,
        home_entry_id: first,
        away_source_key: 'w-r1-m1',
        away_source_outcome: 'winner',
      },
    ])
    assert(saved.match_count === 2, 'the draw should store both matches')

    const drawn = await db.query(
      `select draw_generated_at from public.tournament_events where id = '${event.id}'`,
    )
    assert(drawn.rows[0].draw_generated_at, 'saving a draw must lock entries')

    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '[]'::jsonb)`,
      /between 1 and 2048/i,
    )
    await expectQueryError(
      `select public.register_tournament_entry('${event.id}', array['${P5}']::uuid[])`,
      /draw already exists/i,
    )
  })
})

await test('N3: round robin stores every pair exactly once', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('League Cup')
    const event = await createEvent(tournament.id, 'singles', 'round_robin', 8)

    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id
    const third = (await registerEntry(event.id, [P4], 3)).rows[0].result.entry_id

    const missingPair = JSON.stringify([
      { key: 'r1', bracket: 'round_robin', round: 1, position: 1, home_entry_id: first, away_entry_id: second },
      { key: 'r2', bracket: 'round_robin', round: 2, position: 1, home_entry_id: second, away_entry_id: third },
    ]).replaceAll("'", "''")

    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '${missingPair}'::jsonb)`,
      /every pair exactly once/i,
    )

    const duplicatePair = JSON.stringify([
      { key: 'r1', bracket: 'round_robin', round: 1, position: 1, home_entry_id: first, away_entry_id: second },
      { key: 'r2', bracket: 'round_robin', round: 2, position: 1, home_entry_id: second, away_entry_id: first },
      { key: 'r3', bracket: 'round_robin', round: 3, position: 1, home_entry_id: second, away_entry_id: third },
    ]).replaceAll("'", "''")

    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '${duplicatePair}'::jsonb)`,
      /pair appears twice/i,
    )

    const saved = await saveDraw(event.id, [
      { key: 'r1', bracket: 'round_robin', round: 1, position: 1, home_entry_id: first, away_entry_id: second },
      { key: 'r2', bracket: 'round_robin', round: 2, position: 1, home_entry_id: first, away_entry_id: third },
      { key: 'r3', bracket: 'round_robin', round: 3, position: 1, home_entry_id: second, away_entry_id: third },
    ])
    assert(saved.match_count === 3, 'three entries need three round-robin matches')
  })
})

await test('N4: a result decides the winner and advances both final slots', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Bracket Cup')
    const event = await createEvent(tournament.id, 'singles')
    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id
    const third = (await registerEntry(event.id, [P4], 3)).rows[0].result.entry_id
    const fourth = (await registerEntry(event.id, [P5], 4)).rows[0].result.entry_id

    await saveDraw(event.id, [
      {
        key: 's1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: fourth,
      },
      {
        key: 's2',
        bracket: 'winners',
        round: 1,
        position: 2,
        home_entry_id: second,
        away_entry_id: third,
      },
      {
        key: 'f1',
        bracket: 'winners',
        round: 2,
        position: 1,
        home_source_key: 's1',
        home_source_outcome: 'winner',
        away_source_key: 's2',
        away_source_outcome: 'winner',
      },
    ])

    const semiOne = await matchIdFor(event.id, 'winners', 1, 1)
    const semiTwo = await matchIdFor(event.id, 'winners', 1, 2)
    const final = await matchIdFor(event.id, 'winners', 2)

    const firstResult = await recordResult(semiOne, [
      { home_points: 21, away_points: 15 },
      { home_points: 21, away_points: 18 },
    ])
    assert(
      firstResult.rows[0].result.winner_entry_id === first,
      'the home side should win two straight games',
    )

    let finalRow = await db.query(`select home_entry_id from public.matches where id = '${final}'`)
    assert(finalRow.rows[0].home_entry_id === first, 'the first semi winner must reach the final')

    await recordResult(semiTwo, [
      { home_points: 18, away_points: 21 },
      { home_points: 15, away_points: 21 },
    ])

    finalRow = await db.query(
      `select home_entry_id, away_entry_id from public.matches where id = '${final}'`,
    )
    assert(finalRow.rows[0].home_entry_id === first, 'the home finalist must be unchanged')
    assert(finalRow.rows[0].away_entry_id === third, 'the away semi winner must reach the final')

    const finalResult = await recordResult(final, [
      { home_points: 21, away_points: 19 },
      { home_points: 17, away_points: 21 },
      { home_points: 21, away_points: 12 },
    ])
    assert(finalResult.rows[0].result.winner_entry_id === first, 'the match winner must be stored')

    const games = await db.query(
      `select count(*)::int as games from public.match_games where match_id = '${final}'`,
    )
    assert(games.rows[0].games === 3, 'all three games must be stored')

    await actAs('authenticated', C)
    const audit = await db.query(`
      select count(*)::int as entries
        from public.audit_logs
       where action = 'tournament.match_result' and target_id = '${final}'
    `)
    assert(audit.rows[0].entries === 1, 'a first result must be audited once')
  })
})

await test('N4: level games and split matches are refused', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Score Cup')
    const event = await createEvent(tournament.id, 'singles')
    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id

    await saveDraw(event.id, [
      {
        key: 'f1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
    ])

    const final = await matchIdFor(event.id, 'winners', 1)

    await expectQueryError(
      `select public.record_match_result('${final}', '[{"home_points":21,"away_points":21}]'::jsonb)`,
      /cannot end level/i,
    )
    await expectQueryError(
      `select public.record_match_result('${final}', '[{"home_points":21,"away_points":19},{"home_points":19,"away_points":21}]'::jsonb)`,
      /must have a winner/i,
    )
  })
})

await test('N4: the grand-final reset is cancelled when the winners finalist wins', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Double Cup')
    const event = await createEvent(tournament.id, 'singles', 'double_elimination', 8)
    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id

    await saveDraw(event.id, [
      {
        key: 'w1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
      {
        key: 'gf',
        bracket: 'grand_final',
        round: 1,
        position: 1,
        home_source_key: 'w1',
        home_source_outcome: 'winner',
        away_source_key: 'w1',
        away_source_outcome: 'loser',
      },
      {
        key: 'gfr',
        bracket: 'grand_final',
        round: 2,
        position: 1,
        home_source_key: 'gf',
        home_source_outcome: 'winner',
        away_source_key: 'gf',
        away_source_outcome: 'loser',
        conditional: true,
        reset: true,
      },
    ])

    const winnersFinal = await matchIdFor(event.id, 'winners', 1)
    const grandFinal = await matchIdFor(event.id, 'grand_final', 1)
    const reset = await matchIdFor(event.id, 'grand_final', 2)

    await recordResult(winnersFinal, [
      { home_points: 21, away_points: 10 },
      { home_points: 21, away_points: 12 },
    ])

    const finalSides = await db.query(
      `select home_entry_id, away_entry_id from public.matches where id = '${grandFinal}'`,
    )
    assert(finalSides.rows[0].home_entry_id === first, 'the winners finalist must host the final')
    assert(finalSides.rows[0].away_entry_id === second, 'the loser must drop to the final')

    await recordResult(grandFinal, [
      { home_points: 21, away_points: 19 },
      { home_points: 21, away_points: 17 },
    ])

    const resetRow = await db.query(
      `select status, winner_entry_id from public.matches where id = '${reset}'`,
    )
    assert(
      resetRow.rows[0].status === 'cancelled',
      'a reset is not played when the winners finalist wins',
    )
    assert(resetRow.rows[0].winner_entry_id === first, 'the first final winner is champion')
  })
})

await test('N4: the reset is played when the losers finalist wins the first final', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Reset Cup')
    const event = await createEvent(tournament.id, 'singles', 'double_elimination', 8)
    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id

    await saveDraw(event.id, [
      {
        key: 'w1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
      {
        key: 'gf',
        bracket: 'grand_final',
        round: 1,
        position: 1,
        home_source_key: 'w1',
        home_source_outcome: 'winner',
        away_source_key: 'w1',
        away_source_outcome: 'loser',
      },
      {
        key: 'gfr',
        bracket: 'grand_final',
        round: 2,
        position: 1,
        home_source_key: 'gf',
        home_source_outcome: 'winner',
        away_source_key: 'gf',
        away_source_outcome: 'loser',
        conditional: true,
        reset: true,
      },
    ])

    const winnersFinal = await matchIdFor(event.id, 'winners', 1)
    const grandFinal = await matchIdFor(event.id, 'grand_final', 1)
    const reset = await matchIdFor(event.id, 'grand_final', 2)

    // The away side wins the winners final, so it is the winners-bracket
    // finalist and the home side drops into the grand final as the loser.
    await recordResult(winnersFinal, [
      { home_points: 10, away_points: 21 },
      { home_points: 12, away_points: 21 },
    ])

    await recordResult(grandFinal, [
      { home_points: 17, away_points: 21 },
      { home_points: 19, away_points: 21 },
    ])

    const resetRow = await db.query(
      `select status, home_entry_id, away_entry_id
         from public.matches where id = '${reset}'`,
    )
    assert(resetRow.rows[0].status === 'pending', 'the reset must stay ready to play')
    assert(resetRow.rows[0].home_entry_id === first, 'the first-final winner must host the reset')
    assert(resetRow.rows[0].away_entry_id === second, 'the first-final loser must play the reset')

    const decided = await recordResult(reset, [
      { home_points: 21, away_points: 18 },
      { home_points: 21, away_points: 16 },
    ])
    assert(decided.rows[0].result.winner_entry_id === first, 'the reset decides the champion')
  })
})

await test('N4: a correction needs a reason, rewrites scores, and is audited', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Correction Cup')
    const event = await createEvent(tournament.id, 'singles')
    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id

    await saveDraw(event.id, [
      {
        key: 'f1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
    ])
    const final = await matchIdFor(event.id, 'winners', 1)

    await recordResult(final, [
      { home_points: 21, away_points: 19 },
      { home_points: 21, away_points: 17 },
    ])

    await expectQueryError(
      `select public.correct_match_result('${final}', '[{"home_points":19,"away_points":21}]'::jsonb, '')`,
      /reason is required/i,
    )

    const corrected = await db.query(
      `select public.correct_match_result(
         '${final}',
         '[{"home_points":19,"away_points":21},{"home_points":18,"away_points":21}]'::jsonb,
         'Score entered on the wrong side'
       ) as result`,
    )
    assert(
      corrected.rows[0].result.winner_entry_id === second,
      'the corrected result must change the winner',
    )

    const games = await db.query(
      `select home_points, away_points from public.match_games
        where match_id = '${final}' order by game_number`,
    )
    assert(games.rows.length === 2, 'the old game rows must be replaced')
    assert(games.rows[0].home_points === 19, 'the corrected score must be stored')

    await actAs('authenticated', C)
    const audit = await db.query(`
      select before_data, after_data
        from public.audit_logs
       where action = 'tournament.match_result_corrected' and target_id = '${final}'
    `)
    assert(audit.rows.length === 1, 'a correction must be audited once')
    assert(
      audit.rows[0].before_data.winner_entry_id === first,
      'the audit must preserve the old winner',
    )
    assert(
      audit.rows[0].after_data.reason === 'Score entered on the wrong side',
      'the audit must record the reason',
    )
  })
})

await test('N4: a result cannot be corrected after a downstream match is played', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Cascade Cup')
    const event = await createEvent(tournament.id, 'singles')
    const first = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const second = (await registerEntry(event.id, [P3], 2)).rows[0].result.entry_id
    const third = (await registerEntry(event.id, [P4], 3)).rows[0].result.entry_id
    const fourth = (await registerEntry(event.id, [P5], 4)).rows[0].result.entry_id

    await saveDraw(event.id, [
      { key: 's1', bracket: 'winners', round: 1, position: 1, home_entry_id: first, away_entry_id: second },
      { key: 's2', bracket: 'winners', round: 1, position: 2, home_entry_id: third, away_entry_id: fourth },
      {
        key: 'f1',
        bracket: 'winners',
        round: 2,
        position: 1,
        home_source_key: 's1',
        home_source_outcome: 'winner',
        away_source_key: 's2',
        away_source_outcome: 'winner',
      },
    ])

    const semiOne = await matchIdFor(event.id, 'winners', 1, 1)
    const semiTwo = await matchIdFor(event.id, 'winners', 1, 2)
    const final = await matchIdFor(event.id, 'winners', 2)

    await recordResult(semiOne, [{ home_points: 21, away_points: 10 }])
    await recordResult(semiTwo, [{ home_points: 21, away_points: 12 }])
    await recordResult(final, [{ home_points: 21, away_points: 13 }])

    await expectQueryError(
      `select public.correct_match_result('${semiOne}', '[{"home_points":10,"away_points":21}]'::jsonb, 'Late fix')`,
      /downstream match already has a result/i,
    )
  })
})

await test('N5: drafts are staff-only and published tournaments are readable', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', D)
    const tournament = await createTournament('Visibility Cup')
    const event = await createEvent(tournament.id, 'singles')
    await registerEntry(event.id, [P1], 1)

    await actAs('authenticated', A)
    let visible = await db.query(`select id from public.tournaments`)
    assert(visible.rows.length === 0, 'a player must not read a draft tournament')
    visible = await db.query(`select id from public.tournament_entries`)
    assert(visible.rows.length === 0, 'a player must not read draft entries')

    await actAs('authenticated', D)
    await db.query(`select public.set_tournament_status('${tournament.id}', 'published')`)

    await actAs('authenticated', A)
    visible = await db.query(`select id from public.tournaments`)
    assert(visible.rows.length === 1, 'a player should read a published tournament')
    visible = await db.query(`select id from public.tournament_entries`)
    assert(visible.rows.length === 1, 'a player should read published entries')

    await actAs('authenticated', B)
    visible = await db.query(`select id from public.tournaments`)
    assert(visible.rows.length === 0, 'a pending account must not read tournaments')
  })
})

await test('N5: anon cannot execute any tournament RPC', async () => {
  await expectError(
    'anon tournament create',
    () =>
      asRole(
        'anon',
        `select public.create_tournament('Anon', '2026-11-01', '2026-11-02')`,
      ),
    /permission denied/i,
  )
  await expectError(
    'anon draw',
    () =>
      asRole(
        'anon',
        `select public.save_tournament_draw('00000000-0000-4000-8000-000000000000', '[]'::jsonb)`,
      ),
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
// ShuttlePower rules and reconciliation (Phase 4)
// ---------------------------------------------------------------------------
await test('N6: SP ships one provisional rule version and it is disabled', async () => {
  const { rows } = await db.query(
    `select version, status, is_enabled, config from public.sp_rule_versions`,
  )

  assert(rows.length === 1, `expected exactly one rule version, got ${rows.length}`)

  const rule = rows[0]

  assert(rule.status === 'provisional', `expected a provisional rule, got ${rule.status}`)
  assert(rule.is_enabled === false, 'the provisional rule must ship disabled')

  for (const key of [
    'baseChange',
    'strengthSensitivity',
    'minGainPerMatch',
    'maxGainPerMatch',
    'minLossPerMatch',
    'maxLossPerMatch',
    'tournamentMultiplier',
    'rounding',
    'doublesSplit',
  ]) {
    assert(key in rule.config, `the config is missing ${key}`)
  }

  assert(
    rule.config.tournamentMultiplier === 2,
    'the approved tournament multiplier must stay 2',
  )
})

await test('N6: an unapproved rule version cannot be enabled', async () => {
  await inTransaction(async () => {
    await expectQueryError(
      `update public.sp_rule_versions set is_enabled = true`,
      /sp_rule_versions_enabled_check/i,
    )
  })
})

await test('N6: only one rule version can be enabled at a time', async () => {
  await inTransaction(async () => {
    await db.query(
      `update public.sp_rule_versions set status = 'approved', is_enabled = true`,
    )

    await expectQueryError(
      `insert into public.sp_rule_versions (version, status, config, is_enabled)
       values ('second-enabled', 'approved', '{}'::jsonb, true)`,
      /sp_rule_versions_one_enabled_key|duplicate key/i,
    )
  })
})

await test('N6: clients read rule versions but cannot write them', async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('authenticated', 'public.sp_rule_versions', 'SELECT') as can_select,
      has_table_privilege('authenticated', 'public.sp_rule_versions', 'INSERT') as can_insert,
      has_table_privilege('authenticated', 'public.sp_rule_versions', 'UPDATE') as can_update,
      has_table_privilege('authenticated', 'public.sp_rule_versions', 'DELETE') as can_delete,
      has_table_privilege('anon', 'public.sp_rule_versions', 'SELECT') as anon_select
  `)

  const row = rows[0]

  assert(row.can_select === true, 'club members should read rule versions')
  assert(row.can_insert === false, 'clients must not insert rule versions')
  assert(row.can_update === false, 'clients must not update rule versions')
  assert(row.can_delete === false, 'clients must not delete rule versions')
  assert(row.anon_select === false, 'anon must not read rule versions')

  const member = await asUser(A, `select id from public.sp_rule_versions`)
  const pending = await asUser(B, `select id from public.sp_rule_versions`)

  assert(member.rows.length === 1, `a player should read the rule, got ${member.rows.length}`)
  assert(pending.rows.length === 0, `a pending account should read 0 rules, got ${pending.rows.length}`)

  await expectError(
    'anon rule select',
    () => asRole('anon', `select id from public.sp_rule_versions`),
    /permission denied/i,
  )
})

await test('N6: reconciliation confirms the seeded ledger', async () => {
  const { rows } = await asUser(C, `select public.reconcile_sp_balances() as result`)
  const result = rows[0].result

  assert(
    result.consistent === true,
    `expected a consistent ledger, got ${JSON.stringify(result.mismatches)}`,
  )
  assert(result.checked >= 1, `expected at least one account to be checked, got ${result.checked}`)
})

await test('N7: reconciliation reports a drifted balance without repairing it', async () => {
  await inTransaction(async () => {
    const { rows } = await db.query(
      `select player_id, current_sp from public.sp_accounts order by player_id limit 1`,
    )
    const playerId = rows[0].player_id
    const cachedSp = rows[0].current_sp

    await db.query(
      `update public.sp_accounts set current_sp = ${cachedSp} + 25 where player_id = '${playerId}'`,
    )

    await actAs('authenticated', C)
    const report = await db.query(`select public.reconcile_sp_balances() as result`)
    const result = report.rows[0].result

    assert(result.consistent === false, 'drift must be reported')
    assert(
      result.mismatches.length === 1,
      `expected 1 mismatch, got ${result.mismatches.length}`,
    )
    assert(result.mismatches[0].player_id === playerId, 'the mismatch must name the drifted player')
    assert(
      Number(result.mismatches[0].cached_sp) === cachedSp + 25,
      'the report should carry the cached value',
    )
    assert(
      Number(result.mismatches[0].ledger_sp) === cachedSp,
      'the report should carry the ledger sum',
    )

    await db.exec('reset role')
    const after = await db.query(
      `select current_sp from public.sp_accounts where player_id = '${playerId}'`,
    )

    assert(
      after.rows[0].current_sp === cachedSp + 25,
      'reconciliation must never repair a balance',
    )
  })
})

await test('N7: reconciliation is super admin only and anon cannot call it', async () => {
  await expectErrorAs(A, `select public.reconcile_sp_balances()`, /not authorized/i)

  await expectError(
    'anon reconcile',
    () => asRole('anon', `select public.reconcile_sp_balances()`),
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
await db.close()

console.log(`\n${passed} passed, ${failures.length} failed`)

if (failures.length > 0) {
  process.exitCode = 1
}
