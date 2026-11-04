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
  trainingMigration,
  clubMigration,
  jerseyImageMigration,
  friendlyMigration,
  friendlySpMigration,
  seasonMigration,
  playerSocialMigration,
  registrationMigration,
  receiptMigration,
  approvedSpRuleMigration,
  tournamentSpMigration,
  seasonImplementationMigration,
  placementMigration,
  seasonPolicies,
  seasonImplementationPolicies,
  placementPolicies,
  playerSocialPolicies,
  registrationPolicies,
  receiptPolicies,
  identityPolicies,
  operationPolicies,
  spPolicies,
  authPolicies,
  tournamentPolicies,
  spRulePolicies,
  trainingPolicies,
  clubPolicies,
  jerseyImagePolicies,
  friendlyPolicies,
  seed,
  demoTournamentSeed,
  bootstrap,
] = await Promise.all([
  readFile(join(backendDir, 'migrations', '001_identity.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '002_shuttlepower_bootstrap.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '003_auth_lifecycle.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '004_players.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '005_tournaments.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '006_shuttlepower_rules.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '007_training.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '008_club_activities.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '009_jersey_images.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '010_friendly_matches.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '011_friendly_sp_award.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '012_seasons.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '013_players_friends_notifications.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '014_tournament_registration.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '015_payment_receipts.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '016_approved_sp_rule.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '017_tournament_sp_award.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '018_seasonal_implementation.sql'), 'utf8'),
  readFile(join(backendDir, 'migrations', '019_placement_and_unplayed_sp.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '012_seasons.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '018_seasons.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '019_placement.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '013_players_social.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '014_tournament_registration.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '015_payment_receipts.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '001_identity.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '002_operations.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '003_shuttlepower.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '004_auth_lifecycle.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '005_tournaments.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '006_shuttlepower_rules.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '007_training.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '008_club_activities.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '009_jersey_images.sql'), 'utf8'),
  readFile(join(backendDir, 'policies', '010_friendly_matches.sql'), 'utf8'),
  readFile(join(backendDir, 'seeds', '001_fictional_players.sql'), 'utf8'),
  readFile(join(backendDir, 'seeds', '002_tournament_demo.sql'), 'utf8'),
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
  'placement_credits',
  'placement_qualifications',
  'tournaments',
  'training_attendance',
  'training_fee_periods',
  'training_payments',
  'training_sessions',
  'jersey_projects',
  'jersey_designs',
  'jersey_sizes',
  'jersey_orders',
  'polls',
  'poll_options',
  'poll_votes',
  'announcements',
  'friendly_matches',
  'seasons',
  'season_balances',
  'season_player_results',
  'season_deduction_batches',
  'season_deduction_entries',
  'season_transition_steps',
  'season_transitions',
  'tournament_events',
  'teams',
  'team_members',
  'tournament_entries',
  'tournament_entry_payments',
  'tournament_partner_invitations',
  'jersey_order_payments',
  'payment_receipts',
  'player_friendships',
  'notifications',
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
  return expectError(`denied query as ${uid}`, () => asUser(uid, sql), pattern)
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
await db.exec(trainingMigration)
await db.exec(clubMigration)
await db.exec(jerseyImageMigration)
await db.exec(friendlyMigration)
await db.exec(friendlySpMigration)
await db.exec(seasonMigration)
await db.exec(playerSocialMigration)
await db.exec(registrationMigration)
await db.exec(receiptMigration)
await db.exec(approvedSpRuleMigration)
await db.exec(tournamentSpMigration)
await db.exec(seasonImplementationMigration)
await db.exec(placementMigration)
await db.exec(identityPolicies)
await db.exec(operationPolicies)
await db.exec(spPolicies)
await db.exec(authPolicies)
await db.exec(tournamentPolicies)
await db.exec(spRulePolicies)
await db.exec(trainingPolicies)
await db.exec(clubPolicies)
await db.exec(jerseyImagePolicies)
await db.exec(friendlyPolicies)
await db.exec(seasonPolicies)
await db.exec(seasonImplementationPolicies)
await db.exec(placementPolicies)
await db.exec(playerSocialPolicies)
await db.exec(registrationPolicies)
await db.exec(receiptPolicies)

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
    rows.map((row) => row.key).join(',') === 'player,super_admin,tournament_manager,trainer',
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

  insert into public.players (id, profile_id, full_name, gender, rating_status)
    values ('${P1}', '${A}', 'Alex Player', 'male', 'rated');

  insert into public.players (id, full_name, gender, rating_status)
    values ('${P2}', 'Unlinked Player', 'female', 'rated');

  insert into public.players (id, full_name, gender, status, rating_status) values
    ('${P3}', 'Carlo Male', 'male', 'active', 'rated'),
    ('${P4}', 'Dana Female', 'female', 'active', 'rated'),
    ('${P5}', 'Eli Male', 'male', 'active', 'rated'),
    ('${P6}', 'Fay Unknown', null, 'active', 'rated'),
    ('${P7}', 'Gina Inactive', 'female', 'inactive', 'rated');

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
    assert(
      players.rows.length === 0,
      `suspended player must see 0 players, got ${players.rows.length}`,
    )
    assert(
      own.rows.length === 1 && own.rows[0].id === A,
      'suspended player may still read their own profile',
    )
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
      db.exec(`update public.registration_requests set status = 'approved' where id = '${RR1}'`),
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
  assert(
    row.player_link_update === false,
    'authenticated must not link a player to an account directly',
  )
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
      has_function_privilege('authenticated', 'public.create_tournament(text,date,date,text,text,timestamptz,numeric)', 'EXECUTE') as create_execute,
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
  assert(
    member.rows.some((row) => row.key === 'club.name'),
    'A should read club settings',
  )
  assert(
    pending.rows.length === 0,
    `pending user should see 0 settings, got ${pending.rows.length}`,
  )
  assert(admin.rows.length === member.rows.length, 'admin should see every setting')
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

    const first = await db.query(`select public.submit_registration($1) as result`, ['Gina New'])
    const second = await db.query(`select public.submit_registration($1) as result`, [
      'Gina Renamed',
    ])

    assert(first.rows[0].result.status === 'pending', 'first submission should be pending')
    assert(
      second.rows[0].result.request_id === first.rows[0].result.request_id,
      'resubmitting should reuse the pending request',
    )

    await actAs('postgres')
    const profile = await db.query(`select full_name, status from public.profiles where id = $1`, [
      G,
    ])
    const requests = await db.query(
      `select status, full_name, count(*) over ()::int as total
         from public.registration_requests
        where profile_id = $1`,
      [G],
    )

    assert(profile.rows[0].status === 'pending', 'profile should stay pending')
    assert(profile.rows[0].full_name === 'Gina Renamed', 'latest full name should be stored')
    assert(
      requests.rows.length === 1 && requests.rows[0].total === 1,
      'exactly one request expected',
    )
    assert(requests.rows[0].status === 'pending', 'request should be pending')
  })
})

await test('submit_registration refuses an anonymous caller', async () => {
  await expectError(
    'anonymous registration',
    () => asRole('authenticated', `select public.submit_registration('Anonymous')`),
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
await test('club members read published SP balances, pending users do not', async () => {
  const member = await asUser(A, `select player_id, current_sp from public.published_sp_balances`)
  const pending = await asUser(B, `select player_id from public.published_sp_balances`)
  assert(member.rows.length === 1 && member.rows[0].current_sp === 1000, 'A should see 1000 SP')
  assert(
    pending.rows.length === 0,
    `pending user should see 0 balances, got ${pending.rows.length}`,
  )
})

await test('direct SP tables are closed to clients after policy 019', async () => {
  await expectErrorAs(A, `select current_sp from public.sp_accounts`, /permission denied/i)
  await expectErrorAs(A, `select id from public.sp_transactions`, /permission denied/i)
  await expectErrorAs(A, `select * from public.placement_credits`, /permission denied/i)
  await expectErrorAs(A, `select * from public.placement_qualifications`, /permission denied/i)
})

await test('the SP ledger is visible to its owner and a super admin only', async () => {
  const owner = await asUser(A, `select id from public.published_sp_transactions`)
  const other = await asUser(B, `select id from public.published_sp_transactions`)
  const admin = await asUser(C, `select id from public.published_sp_transactions`)
  assert(owner.rows.length === 1, `owner should see 1 transaction, got ${owner.rows.length}`)
  assert(
    other.rows.length === 0,
    `pending user should see 0 transactions, got ${other.rows.length}`,
  )
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
  // CASCADE is what it takes to reach the ledger now that season deductions
  // reference it; the append-only trigger must still refuse.
  await expectAppendOnly(`truncate public.sp_transactions cascade`)
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
    () => asUser(A, `select public.approve_registration('${RR1}', array['player'], null)`),
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
    await db.query(`select public.approve_registration('${RR1}', array['player','trainer'], null)`)

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
    () => asUser(C, `select public.approve_registration('${RR1}', array['player','wizard'], null)`),
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
    const player = await db.query(`select profile_id from public.players where id = '${P2}'`)
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
      await db.query(`select public.approve_registration('${RR3}', array['player'], '${P1}')`)
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
    const result = await db.query(`select public.set_profile_status('${A}', 'suspended') as result`)
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
    () => asUser(C, `select public.set_profile_status('${C}', 'suspended')`),
    /cannot change your own access/i,
  )
})

await test('pending profiles cannot be activated outside approval', async () => {
  await expectError(
    'pending profile activation',
    () => asUser(C, `select public.set_profile_status('${B}', 'active')`),
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
  await expectError(
    'anon auth read',
    () => asRole('anon', `select email from auth.users`),
    /permission denied/i,
  )
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
    await expectErrorAs(
      uid,
      `update public.user_roles set granted_by = '${uid}'`,
      /permission denied/i,
    )
    await expectErrorAs(
      uid,
      `delete from public.user_roles where profile_id = '${uid}'`,
      /permission denied/i,
    )
    await expectErrorAs(uid, `update public.audit_logs set action = 'forged'`, /permission denied/i)
    await expectErrorAs(uid, `delete from public.audit_logs`, /permission denied/i)
    await expectErrorAs(
      uid,
      `update public.sp_accounts set current_sp = 9999`,
      /permission denied/i,
    )
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

await test('I3: the tournament demo seed is idempotent and ready to draw', async () => {
  await inTransaction(async () => {
    await db.exec(
      `insert into public.app_settings (key, value)
       values ('club.environment', '"development"'::jsonb)`,
    )
    await db.exec(seed)
    await db.exec(demoTournamentSeed)
    await db.exec(demoTournamentSeed)

    const { rows } = await db.query(`
      select
        (select count(*)::int from public.players
          where id::text like '5eed3000-%') as players,
        (select count(*)::int from public.tournaments
          where id::text like '5eed4000-%') as tournaments,
        (select count(*)::int from public.tournaments
          where id::text like '5eed4000-%' and status = 'published') as published,
        (select count(*)::int from public.tournament_events
          where id::text like '5eed4100-%') as events,
        (select count(*)::int from public.tournament_events
          where id::text like '5eed4100-%' and draw_generated_at is null) as undrawn,
        (select count(*)::int from public.teams
          where id::text like '5eed4200-%') as teams,
        (select count(*)::int from public.team_members
          where id::text like '5eed4500-%') as members,
        (select count(*)::int from public.tournament_entries
          where id::text like '5eed4300-%') as entries,
        (select count(*)::int from public.tournament_entry_payments
          where id::text like '5eed4400-%') as payments,
        (select count(*)::int from public.tournament_entry_payments
          where id::text like '5eed4400-%' and status = 'paid' and marked_at is not null) as paid,
        (select count(*)::int from public.tournament_entries
          where id::text like '5eed4300-%'
            and public.entry_payment_complete(id)) as eligible
    `)

    const row = rows[0]
    assert(row.players === 8, `sample players duplicated: ${row.players}`)
    assert(row.tournaments === 1, `demo tournament duplicated: ${row.tournaments}`)
    assert(row.published === 1, 'the demo tournament must be published')
    assert(row.events === 2, `demo events duplicated: ${row.events}`)
    assert(row.undrawn === 2, 'both demo events must start without a draw')
    assert(row.teams === 4, `demo teams duplicated: ${row.teams}`)
    assert(row.members === 8, `demo team members duplicated: ${row.members}`)
    assert(row.entries === 12, `demo entries duplicated: ${row.entries}`)
    assert(row.payments === 16, `demo payments duplicated: ${row.payments}`)
    assert(row.paid === 16, 'every demo participant must be marked paid')
    assert(row.eligible === 12, 'every demo entry must be draw-eligible')

    // Draw both demo events as the tournament manager the seed attributes them to.
    await actAs('authenticated', '5eed0000-0000-4000-8000-000000000001')

    const singlesDraw = [
      ['5eed4300-0000-4000-8000-000000000001', '5eed4300-0000-4000-8000-000000000002'],
      ['5eed4300-0000-4000-8000-000000000003', '5eed4300-0000-4000-8000-000000000004'],
      ['5eed4300-0000-4000-8000-000000000005', '5eed4300-0000-4000-8000-000000000006'],
      ['5eed4300-0000-4000-8000-000000000007', '5eed4300-0000-4000-8000-000000000008'],
    ].map(([home, away], index) => ({
      key: `S-R1M${index + 1}`,
      bracket: 'winners',
      round: 1,
      position: index + 1,
      home_entry_id: home,
      away_entry_id: away,
    }))

    const doublesDraw = [
      ['5eed4300-0000-4000-8000-000000000011', '5eed4300-0000-4000-8000-000000000012'],
      ['5eed4300-0000-4000-8000-000000000013', '5eed4300-0000-4000-8000-000000000014'],
    ].map(([home, away], index) => ({
      key: `D-R1M${index + 1}`,
      bracket: 'winners',
      round: 1,
      position: index + 1,
      home_entry_id: home,
      away_entry_id: away,
    }))

    await db.query(
      `select public.save_tournament_draw(
         '5eed4100-0000-4000-8000-000000000001',
         $json$${JSON.stringify(singlesDraw)}$json$::jsonb
       )`,
    )
    await db.query(
      `select public.save_tournament_draw(
         '5eed4100-0000-4000-8000-000000000002',
         $json$${JSON.stringify(doublesDraw)}$json$::jsonb
       )`,
    )

    const drawn = await db.query(`
      select
        (select count(*)::int from public.matches
          where event_id::text like '5eed4100-%') as matches,
        (select count(*)::int from public.tournament_events
          where id::text like '5eed4100-%' and draw_generated_at is not null) as drawn_events
    `)
    assert(
      drawn.rows[0].matches === 6,
      `both demo draws should create 6 matches: ${drawn.rows[0].matches}`,
    )
    assert(drawn.rows[0].drawn_events === 2, 'both demo events should be locked after the draw')
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
    await expectError(
      'bootstrap suspended profile',
      () => db.exec(bootstrap),
      /refusing to bootstrap/i,
    )
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
  await expectErrorAs(
    A,
    `select public.set_profile_roles('${D}', array['player'])`,
    /not authorized/i,
  )
  await expectErrorAs(
    D,
    `select public.set_profile_roles('${A}', array['player'])`,
    /not authorized/i,
  )
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
  await expectErrorAs(A, `select public.link_player_account('${A}', '${P2}')`, /not authorized/i)
  await expectErrorAs(D, `select public.unlink_player_account('${P1}')`, /not authorized/i)
})

await test('K2: linking an approved account is idempotent and audited', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)

    const first = await db.query(`select public.link_player_account('${D}', '${P2}') as result`)
    assert(first.rows[0].result.changed === true, 'the first link must change the record')
    assert(first.rows[0].result.already_linked === false, 'the first link is not a replay')

    const second = await db.query(`select public.link_player_account('${D}', '${P2}') as result`)
    assert(second.rows[0].result.changed === false, 'a repeated link must not change anything')
    assert(second.rows[0].result.already_linked === true, 'a repeated link must report the replay')

    const link = await db.query(`select profile_id from public.players where id = '${P2}'`)
    assert(link.rows[0].profile_id === D, 'the player record must point at the approved account')

    const audit = await db.query(`
      select count(*)::int as entries
        from public.audit_logs
       where action = 'player.account_linked' and target_id = '${P2}'
    `)
    assert(
      audit.rows[0].entries === 1,
      'a link must write exactly one audit row, even after a replay',
    )
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
  await expectErrorAs(D, `update public.tournaments set name = 'Changed'`, /permission denied/i)
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
      /place every paid entry/i,
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
      {
        key: 'r1',
        bracket: 'round_robin',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
      {
        key: 'r2',
        bracket: 'round_robin',
        round: 2,
        position: 1,
        home_entry_id: second,
        away_entry_id: third,
      },
    ]).replaceAll("'", "''")

    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '${missingPair}'::jsonb)`,
      /every paid pair exactly once/i,
    )

    const duplicatePair = JSON.stringify([
      {
        key: 'r1',
        bracket: 'round_robin',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
      {
        key: 'r2',
        bracket: 'round_robin',
        round: 2,
        position: 1,
        home_entry_id: second,
        away_entry_id: first,
      },
      {
        key: 'r3',
        bracket: 'round_robin',
        round: 3,
        position: 1,
        home_entry_id: second,
        away_entry_id: third,
      },
    ]).replaceAll("'", "''")

    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '${duplicatePair}'::jsonb)`,
      /pair appears twice/i,
    )

    const saved = await saveDraw(event.id, [
      {
        key: 'r1',
        bracket: 'round_robin',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
      {
        key: 'r2',
        bracket: 'round_robin',
        round: 2,
        position: 1,
        home_entry_id: first,
        away_entry_id: third,
      },
      {
        key: 'r3',
        bracket: 'round_robin',
        round: 3,
        position: 1,
        home_entry_id: second,
        away_entry_id: third,
      },
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
      {
        key: 's1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: first,
        away_entry_id: second,
      },
      {
        key: 's2',
        bracket: 'winners',
        round: 1,
        position: 2,
        home_entry_id: third,
        away_entry_id: fourth,
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
    () => asRole('anon', `select public.create_tournament('Anon', '2026-11-01', '2026-11-02')`),
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
await test('N6: SP ships the provisional proposal disabled and the approved rule enabled', async () => {
  const { rows } = await db.query(
    `select version, status, is_enabled, config, notes
       from public.sp_rule_versions
      order by version`,
  )

  assert(rows.length === 2, `expected two rule versions, got ${rows.length}`)

  const provisional = rows.find((row) => row.version === 'provisional-2026-11')
  const approved = rows.find((row) => row.version === 'approved-2026-11')

  assert(provisional, 'the provisional proposal must remain for audit')
  assert(approved, 'the approved club rule must exist')

  assert(
    provisional.status === 'provisional',
    `expected the proposal to stay provisional, got ${provisional.status}`,
  )
  assert(provisional.is_enabled === false, 'the provisional proposal must stay disabled')
  assert(approved.status === 'approved', `expected an approved rule, got ${approved.status}`)
  assert(approved.is_enabled === true, 'the approved rule must be enabled')
  assert(
    rows.filter((row) => row.is_enabled).length === 1,
    'exactly one rule version may be enabled',
  )

  for (const key of [
    'baseChange',
    'strengthSensitivity',
    'minGainPerMatch',
    'maxGainPerMatch',
    'minLossPerMatch',
    'maxLossPerMatch',
    'floor',
    'tournamentMultiplier',
    'rounding',
    'doublesSplit',
  ]) {
    assert(key in approved.config, `the approved config is missing ${key}`)
  }

  assert(approved.config.baseChange === 20, 'the approved base change must be 20')
  assert(
    approved.config.strengthSensitivity === 0.02,
    'the approved strength sensitivity must be 0.02',
  )
  assert(approved.config.minGainPerMatch === 5, 'the approved minimum gain must be 5')
  assert(approved.config.maxGainPerMatch === 40, 'the approved maximum gain must be 40')
  assert(approved.config.minLossPerMatch === 5, 'the approved minimum loss must be 5')
  assert(approved.config.maxLossPerMatch === 40, 'the approved maximum loss must be 40')
  assert(approved.config.floor === 0, 'the approved floor must be 0')
  assert(approved.config.tournamentMultiplier === 2, 'the tournament multiplier must stay 2')
  assert(approved.config.rounding === 'round', 'the approved rounding policy must be round')
  assert(approved.config.doublesSplit === 'even', 'the approved doubles split must be even')
  assert(!('ceiling' in approved.config), 'the approved rule has no ceiling key')
  assert(/2026-11-03/.test(approved.notes ?? ''), 'the approval date must be recorded')
  assert(/club owner/i.test(approved.notes ?? ''), 'the approver must be recorded')
})

await test('N6: an unapproved rule version cannot be enabled', async () => {
  await inTransaction(async () => {
    await expectQueryError(
      `update public.sp_rule_versions set is_enabled = true
        where version = 'provisional-2026-11'`,
      /sp_rule_versions_enabled_check/i,
    )
  })
})

await test('N6: only one rule version can be enabled at a time', async () => {
  await inTransaction(async () => {
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

  assert(member.rows.length === 2, `a player should read both rules, got ${member.rows.length}`)
  assert(
    pending.rows.length === 0,
    `a pending account should read 0 rules, got ${pending.rows.length}`,
  )

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
    assert(result.mismatches.length === 1, `expected 1 mismatch, got ${result.mismatches.length}`)
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

    assert(after.rows[0].current_sp === cachedSp + 25, 'reconciliation must never repair a balance')
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
// Training and payments (Phase 6)
// ---------------------------------------------------------------------------
await test('N8: training tables are read-only and RPCs are authenticated-only', async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('authenticated', 'public.training_sessions', 'SELECT') as session_select,
      has_table_privilege('authenticated', 'public.training_sessions', 'INSERT') as session_insert,
      has_table_privilege('authenticated', 'public.training_attendance', 'UPDATE') as attendance_update,
      has_table_privilege('authenticated', 'public.training_payments', 'INSERT') as payment_insert,
      has_table_privilege('authenticated', 'public.training_payments', 'DELETE') as payment_delete,
      has_function_privilege('authenticated', 'public.create_training_session(text,timestamp with time zone,timestamp with time zone,text,text)', 'EXECUTE') as session_execute,
      has_function_privilege('authenticated', 'public.mark_training_attendance(uuid,jsonb)', 'EXECUTE') as mark_execute,
      has_function_privilege('authenticated', 'public.record_training_payment(uuid,uuid,numeric,date,text)', 'EXECUTE') as pay_execute,
      has_function_privilege('authenticated', 'public.void_training_payment(uuid,text)', 'EXECUTE') as void_execute,
      has_function_privilege('anon', 'public.create_training_session(text,timestamp with time zone,timestamp with time zone,text,text)', 'EXECUTE') as anon_session_execute
  `)
  const row = rows[0]
  assert(row.session_select === true, 'members should read sessions')
  assert(row.session_insert === false, 'sessions must be created by the RPC only')
  assert(row.attendance_update === false, 'attendance must be marked by the RPC only')
  assert(row.payment_insert === false, 'payments must be recorded by the RPC only')
  assert(row.payment_delete === false, 'payments are never deleted')
  assert(
    row.session_execute === true && row.mark_execute === true,
    'staff RPCs should be executable',
  )
  assert(row.pay_execute === true && row.void_execute === true, 'payment RPCs should be executable')
  assert(row.anon_session_execute === false, 'anon must not create sessions')
})

await test('N8: a player and a tournament manager cannot write training', async () => {
  await expectErrorAs(
    A,
    `select public.create_training_session('Blocked', now(), now() + interval '1 hour')`,
    /not authorized/i,
  )
  await expectErrorAs(
    D,
    `select public.create_training_fee_period('2026-11', '2026-11-01', '2026-11-30', 500)`,
    /not authorized/i,
  )
})

await test('N8: staff create a session and the change is audited', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_training_session(
        'Evening drills', '2026-11-05T10:00:00Z', '2026-11-05T12:00:00Z', 'Club courts', 'Footwork'
      ) as result`,
    )
    const session = created.rows[0].result

    assert(session.title === 'Evening drills', 'session title should be returned')
    assert(session.status === 'scheduled', 'a new session starts scheduled')

    const audit = await db.query(
      `select count(*)::int as total from public.audit_logs
        where action = 'training.session.create' and target_id = '${session.id}'`,
    )

    assert(audit.rows[0].total === 1, 'session creation should be audited once')
  })
})

await test('N8: session times and status transitions are enforced', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)

    await expectQueryError(
      `select public.create_training_session(
        'Backwards', '2026-11-05T12:00:00Z', '2026-11-05T10:00:00Z'
      )`,
      /training_sessions_times_check/i,
    )

    const created = await db.query(
      `select public.create_training_session('Closable', '2026-11-06T10:00:00Z', '2026-11-06T12:00:00Z') as result`,
    )
    const sessionId = created.rows[0].result.id

    const cancelled = await db.query(
      `select public.set_training_session_status('${sessionId}', 'cancelled') as result`,
    )
    assert(cancelled.rows[0].result.changed === true, 'first cancellation changes the status')

    const replay = await db.query(
      `select public.set_training_session_status('${sessionId}', 'cancelled') as result`,
    )
    assert(replay.rows[0].result.changed === false, 'repeating the same status is a no-op')

    await expectQueryError(
      `select public.set_training_session_status('${sessionId}', 'completed')`,
      /already cancelled/i,
    )
  })
})

await test('N8: attendance upserts and is visible only to staff or its player', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_training_session('Attendance test', '2026-11-07T10:00:00Z', '2026-11-07T12:00:00Z') as result`,
    )
    const sessionId = created.rows[0].result.id

    await db.query(
      `select public.mark_training_attendance('${sessionId}', '[{"player_id":"${P1}","status":"present"},{"player_id":"${P3}","status":"late"}]'::jsonb)`,
    )
    await db.query(
      `select public.mark_training_attendance('${sessionId}', '[{"player_id":"${P1}","status":"absent"}]'::jsonb)`,
    )

    const rows = await db.query(
      `select player_id, status from public.training_attendance where session_id = '${sessionId}' order by player_id`,
    )
    assert(rows.rows.length === 2, `expected 2 attendance rows, got ${rows.rows.length}`)
    assert(
      rows.rows.find((row) => row.player_id === P1).status === 'absent',
      're-marking updates the row instead of adding one',
    )

    await actAs('authenticated', A)
    const own = await db.query(`select player_id from public.training_attendance`)
    assert(
      own.rows.length === 1 && own.rows[0].player_id === P1,
      'a player sees only their own row',
    )

    await actAs('authenticated', D)
    const manager = await db.query(`select player_id from public.training_attendance`)
    assert(manager.rows.length === 0, 'a tournament manager is not training staff')
  })
})

await test('N8: fee periods and partial payments enforce the money rules', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const period = await db.query(
      `select public.create_training_fee_period('2026-11', '2026-11-01', '2026-11-30', 500, '2026-11-10') as result`,
    )
    const periodId = period.rows[0].result.id

    const first = await db.query(
      `select public.record_training_payment('${periodId}', '${P1}', 200, '2026-11-03', 'cash') as result`,
    )
    assert(Number(first.rows[0].result.total_paid) === 200, 'first payment totals 200')
    assert(Number(first.rows[0].result.remaining) === 300, '300 remains after a partial payment')

    const second = await db.query(
      `select public.record_training_payment('${periodId}', '${P1}', 300, '2026-11-04', 'gcash') as result`,
    )
    assert(Number(second.rows[0].result.remaining) === 0, 'the period is then paid in full')

    await expectQueryError(
      `select public.record_training_payment('${periodId}', '${P1}', 1)`,
      /remaining balance/i,
    )

    await expectQueryError(
      `insert into public.training_payments (fee_period_id, player_id, amount) values ('${periodId}', '${P1}', 10)`,
      /permission denied/i,
    )

    await actAs('authenticated', A)
    const own = await db.query(`select player_id from public.training_payments`)
    assert(own.rows.length === 2, `a player should see their 2 payments, got ${own.rows.length}`)
  })
})

await test('N8: payments are voided with a reason and never deleted', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const period = await db.query(
      `select public.create_training_fee_period('2026-12', '2026-12-01', '2026-12-31', 300) as result`,
    )
    const periodId = period.rows[0].result.id
    const recorded = await db.query(
      `select public.record_training_payment('${periodId}', '${P1}', 300) as result`,
    )
    const paymentId = recorded.rows[0].result.id

    await expectQueryError(
      `select public.void_training_payment('${paymentId}', 'x')`,
      /void reason is required/i,
    )

    await db.query(`select public.void_training_payment('${paymentId}', 'Recorded twice')`)

    const row = await db.query(
      `select status, void_reason from public.training_payments where id = '${paymentId}'`,
    )
    assert(row.rows[0].status === 'voided', 'the payment should be voided')
    assert(row.rows[0].void_reason === 'Recorded twice', 'the reason should be stored')

    await expectQueryError(
      `select public.void_training_payment('${paymentId}', 'Again')`,
      /already voided/i,
    )

    await expectQueryError(
      `delete from public.training_payments where id = '${paymentId}'`,
      /permission denied|never deleted/i,
    )

    const totals = await db.query(
      `select coalesce(sum(amount), 0)::numeric as paid
         from public.training_payments
        where fee_period_id = '${periodId}' and status = 'recorded'`,
    )
    assert(Number(totals.rows[0].paid) === 0, 'a voided payment does not count toward the total')
  })
})

await test('N8: anon cannot read training or call its RPCs', async () => {
  await expectError(
    'anon sessions',
    () => asRole('anon', `select id from public.training_sessions`),
    /permission denied/i,
  )
  await expectError(
    'anon payments',
    () => asRole('anon', `select id from public.training_payments`),
    /permission denied/i,
  )
  await expectError(
    'anon record payment',
    () =>
      asRole(
        'anon',
        `select public.record_training_payment('00000000-0000-4000-8000-000000000000', '00000000-0000-4000-8000-000000000000', 1)`,
      ),
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
// Jerseys, polls, and announcements (Phase 7)
// ---------------------------------------------------------------------------
await test('N9: club activity tables are read-only and RPCs are authenticated-only', async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('authenticated', 'public.jersey_projects', 'SELECT') as project_select,
      has_table_privilege('authenticated', 'public.jersey_orders', 'INSERT') as order_insert,
      has_table_privilege('authenticated', 'public.polls', 'UPDATE') as poll_update,
      has_table_privilege('authenticated', 'public.poll_votes', 'DELETE') as vote_delete,
      has_table_privilege('authenticated', 'public.announcements', 'INSERT') as announcement_insert,
      has_function_privilege('authenticated', 'public.create_jersey_project(text,text,numeric,timestamp with time zone)', 'EXECUTE') as project_execute,
      has_function_privilege('authenticated', 'public.submit_jersey_order(uuid,uuid,uuid,integer)', 'EXECUTE') as order_execute,
      has_function_privilege('authenticated', 'public.create_poll(text,jsonb,text,text,boolean,boolean,timestamp with time zone,timestamp with time zone)', 'EXECUTE') as poll_execute,
      has_function_privilege('authenticated', 'public.cast_poll_vote(uuid,uuid[])', 'EXECUTE') as vote_execute,
      has_function_privilege('authenticated', 'public.poll_results(uuid)', 'EXECUTE') as results_execute,
      has_function_privilege('authenticated', 'public.create_announcement(text,text)', 'EXECUTE') as news_execute,
      has_function_privilege('anon', 'public.poll_results(uuid)', 'EXECUTE') as anon_results_execute
  `)
  const row = rows[0]
  assert(row.project_select === true, 'members should read projects')
  assert(row.order_insert === false, 'orders must cross the RPC')
  assert(row.poll_update === false, 'polls must cross the RPC')
  assert(row.vote_delete === false, 'votes must cross the RPC')
  assert(row.announcement_insert === false, 'announcements must cross the RPC')
  assert(
    row.project_execute &&
      row.order_execute &&
      row.poll_execute &&
      row.vote_execute &&
      row.results_execute &&
      row.news_execute,
    'the club activity RPCs should be executable by authenticated members',
  )
  assert(row.anon_results_execute === false, 'anon must not read poll results')
})

await test('N9: staff create a jersey project and must add designs and sizes before opening', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_jersey_project('Test Kit', 'Home and away', 750, null) as result`,
    )
    const projectId = created.rows[0].result.id

    await expectQueryError(
      `select public.set_jersey_project_status('${projectId}', 'open')`,
      /at least one design/i,
    )

    await db.query(`select public.add_jersey_design('${projectId}', 'Home', 'Green')`)

    await expectQueryError(
      `select public.set_jersey_project_status('${projectId}', 'open')`,
      /at least one size/i,
    )

    await db.query(`select public.add_jersey_size('${projectId}', 'M')`)
    const opened = await db.query(
      `select public.set_jersey_project_status('${projectId}', 'open') as result`,
    )

    assert(opened.rows[0].result.status === 'open', 'the project should open')

    const audit = await db.query(
      `select count(*)::int as total from public.audit_logs
        where action in ('jersey.project.create', 'jersey.design.create', 'jersey.size.create', 'jersey.project.status')`,
    )

    assert(audit.rows[0].total >= 4, 'project, design, size, and status should be audited')

    await expectQueryError(
      `select public.set_jersey_project_status('${projectId}', 'draft')`,
      /status cannot move/i,
    )
  })
})

await test('N9: a player orders once, can update, and cannot see another player’s order', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const project = await db.query(
      `select public.create_jersey_project('Order Kit', null, 500, now() + interval '1 day') as result`,
    )
    const projectId = project.rows[0].result.id
    const design = await db.query(
      `select public.add_jersey_design('${projectId}', 'Home', null) as result`,
    )
    const size = await db.query(`select public.add_jersey_size('${projectId}', 'L') as result`)
    const designId = design.rows[0].result.id
    const sizeId = size.rows[0].result.id
    await db.query(`select public.set_jersey_project_status('${projectId}', 'open')`)

    await actAs('authenticated', A)
    await db.query(
      `select public.submit_jersey_order('${projectId}', '${designId}', '${sizeId}', 1)`,
    )
    await db.query(
      `select public.submit_jersey_order('${projectId}', '${designId}', '${sizeId}', 3)`,
    )

    await actAs('postgres')
    const orders = await db.query(
      `select player_id, quantity from public.jersey_orders where project_id = '${projectId}'`,
    )

    assert(orders.rows.length === 1, `expected one active order, got ${orders.rows.length}`)
    assert(orders.rows[0].player_id === P1, 'the order belongs to the signed-in player')
    assert(orders.rows[0].quantity === 3, 'a second submission updates the order')

    await actAs('authenticated', A)
    const own = await db.query(`select id from public.jersey_orders`)
    assert(own.rows.length === 1, 'a player sees their own order')

    await actAs('authenticated', D)
    const other = await db.query(`select id from public.jersey_orders`)
    assert(other.rows.length === 0, 'a non-owner, non-staff member sees no orders')
  })
})

await test('N9: a closed project and a passed deadline refuse orders', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const project = await db.query(
      `select public.create_jersey_project('Late Kit', null, null, now() - interval '1 hour') as result`,
    )
    const projectId = project.rows[0].result.id
    const design = await db.query(
      `select public.add_jersey_design('${projectId}', 'Home', null) as result`,
    )
    const size = await db.query(`select public.add_jersey_size('${projectId}', 'S') as result`)
    await db.query(`select public.set_jersey_project_status('${projectId}', 'open')`)

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.submit_jersey_order('${projectId}', '${design.rows[0].result.id}', '${size.rows[0].result.id}', 1)`,
      /deadline has passed/i,
    )

    await actAs('authenticated', C)
    await db.query(`select public.set_jersey_project_status('${projectId}', 'closed')`)

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.submit_jersey_order('${projectId}', '${design.rows[0].result.id}', '${size.rows[0].result.id}', 1)`,
      /orders are closed/i,
    )
  })
})

await test('N9: design images are staff-only and path-checked', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const project = await db.query(
      `select public.create_jersey_project('Image Kit', null, null, null) as result`,
    )
    const projectId = project.rows[0].result.id
    const design = await db.query(
      `select public.add_jersey_design('${projectId}', 'Home', null) as result`,
    )
    const designId = design.rows[0].result.id
    const path = `designs/${projectId}/bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb.png`

    await expectQueryError(
      `select public.set_jersey_design_image('${designId}', 'https://evil.test/kit.png')`,
      /must be a designs/i,
    )
    await expectQueryError(
      `select public.set_jersey_design_image('${designId}', 'designs/../secret.png')`,
      /must be a designs/i,
    )
    await expectQueryError(
      `select public.set_jersey_design_image('${designId}', 'designs/${projectId}/kit.gif')`,
      /must be a designs/i,
    )

    const attached = await db.query(
      `select public.set_jersey_design_image('${designId}', '${path}') as result`,
    )
    assert(attached.rows[0].result.image_path === path, 'the design keeps the object path')

    const audit = await db.query(
      `select count(*)::int as total from public.audit_logs
        where action = 'jersey.design.image' and target_id = '${designId}'`,
    )
    assert(audit.rows[0].total === 1, 'the image change should be audited')

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.set_jersey_design_image('${designId}', '${path}')`,
      /not authorized|permission denied|club staff/i,
    )

    await actAs('authenticated', C)
    const cleared = await db.query(
      `select public.set_jersey_design_image('${designId}', null) as result`,
    )
    assert(cleared.rows[0].result.image_path === null, 'a null path removes the image')

    const grants = await db.query(`
      select
        has_function_privilege('anon', 'public.set_jersey_design_image(uuid,text)', 'EXECUTE') as anon_execute,
        has_function_privilege('authenticated', 'public.set_jersey_design_image(uuid,text)', 'EXECUTE') as member_execute
    `)
    assert(grants.rows[0].anon_execute === false, 'anon must not set a design image')
    assert(grants.rows[0].member_execute === true, 'staff call the RPC as authenticated')
  })
})

await test('N9: a single-choice poll takes one option and replaces a previous vote', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_poll('Which design?', '["Home","Away"]'::jsonb, null, 'single', true, false, null, null) as result`,
    )
    const pollId = created.rows[0].result.id
    await db.query(`select public.set_poll_status('${pollId}', 'open')`)

    const options = await db.query(
      `select id from public.poll_options where poll_id = '${pollId}' order by position`,
    )
    const first = options.rows[0].id
    const second = options.rows[1].id

    await actAs('authenticated', A)
    await db.query(`select public.cast_poll_vote('${pollId}', array['${first}']::uuid[])`)
    await expectQueryError(
      `select public.cast_poll_vote('${pollId}', array['${first}','${second}']::uuid[])`,
      /exactly one option/i,
    )
    await db.query(`select public.cast_poll_vote('${pollId}', array['${second}']::uuid[])`)

    await actAs('postgres')
    const votes = await db.query(
      `select option_id from public.poll_votes where poll_id = '${pollId}' and player_id = '${P1}'`,
    )
    assert(votes.rows.length === 1, `expected one stored vote, got ${votes.rows.length}`)
    assert(votes.rows[0].option_id === second, 'the newer choice replaces the older one')

    await actAs('authenticated', A)
    const hidden = await db.query(`select public.poll_results('${pollId}') as result`)
    assert(hidden.rows[0].result.results_visible === false, 'results stay hidden while open')
    assert(
      hidden.rows[0].result.options.every((option) => option.count === null),
      'hidden results must not carry counts',
    )
    assert(
      hidden.rows[0].result.my_option_ids.length === 1 &&
        hidden.rows[0].result.my_option_ids[0] === second,
      'the caller sees their own choice',
    )

    await actAs('authenticated', C)
    await db.query(`select public.set_poll_status('${pollId}', 'closed')`)

    await actAs('authenticated', A)
    const shown = await db.query(`select public.poll_results('${pollId}') as result`)
    assert(shown.rows[0].result.results_visible === true, 'closing reveals results')
    assert(
      shown.rows[0].result.options.find((option) => option.id === second).count === 1,
      'the tally counts the cast vote',
    )

    await actAs('authenticated', D)
    const noVotes = await db.query(`select option_id from public.poll_votes`)
    assert(noVotes.rows.length === 0, 'votes are not exposed to other members')
  })
})

await test('N9: a multiple-choice poll accepts several options without duplicates', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_poll('Pick sizes', '["S","M","L"]'::jsonb, null, 'multiple', false, true, null, null) as result`,
    )
    const pollId = created.rows[0].result.id
    await db.query(`select public.set_poll_status('${pollId}', 'open')`)

    const options = await db.query(
      `select id from public.poll_options where poll_id = '${pollId}' order by position`,
    )

    await actAs('authenticated', A)
    await db.query(
      `select public.cast_poll_vote('${pollId}', array['${options.rows[0].id}','${options.rows[1].id}']::uuid[])`,
    )
    await db.query(
      `select public.cast_poll_vote('${pollId}', array['${options.rows[0].id}','${options.rows[1].id}']::uuid[])`,
    )

    await actAs('postgres')
    const votes = await db.query(
      `select option_id from public.poll_votes where poll_id = '${pollId}' and player_id = '${P1}'`,
    )
    assert(votes.rows.length === 2, `expected two selected options, got ${votes.rows.length}`)
  })
})

await test('N9: a closed poll or a passed window refuses votes', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_poll('Expired?', '["Yes","No"]'::jsonb, null, 'single', false, false, null, now() - interval '1 minute') as result`,
    )
    const pollId = created.rows[0].result.id
    await db.query(`select public.set_poll_status('${pollId}', 'open')`)

    const options = await db.query(
      `select id from public.poll_options where poll_id = '${pollId}' order by position`,
    )

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.cast_poll_vote('${pollId}', array['${options.rows[0].id}']::uuid[])`,
      /has closed/i,
    )

    await actAs('authenticated', C)
    await db.query(`select public.set_poll_status('${pollId}', 'closed')`)

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.cast_poll_vote('${pollId}', array['${options.rows[0].id}']::uuid[])`,
      /not open/i,
    )
  })
})

await test('N9: drafts stay staff-only and announcements publish once', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_announcement('Court night', 'Training moves to Friday.') as result`,
    )
    const announcementId = created.rows[0].result.id

    await actAs('authenticated', A)
    const hidden = await db.query(`select id from public.announcements`)
    assert(hidden.rows.length === 0, 'a draft is hidden from members')

    await actAs('authenticated', C)
    await db.query(`select public.set_announcement_status('${announcementId}', 'published')`)

    await actAs('authenticated', A)
    const published = await db.query(
      `select status, published_at from public.announcements where id = '${announcementId}'`,
    )
    assert(
      published.rows.length === 1 && published.rows[0].status === 'published',
      'members see it',
    )
    assert(published.rows[0].published_at !== null, 'publishing stamps a date')

    await actAs('authenticated', C)
    await db.query(`select public.set_announcement_status('${announcementId}', 'archived')`)

    await actAs('authenticated', A)
    const archived = await db.query(`select id from public.announcements`)
    assert(archived.rows.length === 0, 'archived news leaves the member view')

    await actAs('authenticated', A)
    await expectQueryError(`select public.create_announcement('Nope', 'Nope')`, /not authorized/i)

    await expectErrorAs(D, `select public.create_announcement('Nope', 'Nope')`, /not authorized/i)
  })
})

await test('N9: anon cannot read club activity tables or call their RPCs', async () => {
  await expectError(
    'anon projects',
    () => asRole('anon', `select id from public.jersey_projects`),
    /permission denied/i,
  )
  await expectError(
    'anon polls',
    () => asRole('anon', `select id from public.polls`),
    /permission denied/i,
  )
  await expectError(
    'anon announcements',
    () => asRole('anon', `select id from public.announcements`),
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
// Phase 5: friendly matches
// ---------------------------------------------------------------------------
await test('N10: friendly matches are read-only and the RPCs are authenticated-only', async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('authenticated', 'public.friendly_matches', 'INSERT') as member_insert,
      has_table_privilege('authenticated', 'public.friendly_matches', 'UPDATE') as member_update,
      has_table_privilege('authenticated', 'public.friendly_matches', 'DELETE') as member_delete,
      has_table_privilege('authenticated', 'public.friendly_matches', 'SELECT') as member_select,
      has_function_privilege('anon', 'public.create_friendly_challenge(uuid,text)', 'EXECUTE') as anon_create,
      has_function_privilege('authenticated', 'public.create_friendly_challenge(uuid,text)', 'EXECUTE') as member_create,
      has_function_privilege('anon', 'public.approve_friendly_result(uuid)', 'EXECUTE') as anon_approve,
      has_function_privilege('authenticated', 'public.auto_approve_friendly_matches()', 'EXECUTE') as member_auto
  `)
  const row = rows[0]

  assert(row.member_select === true, 'members should read their own matches')
  assert(row.member_insert === false, 'creates must cross the RPC')
  assert(row.member_update === false, 'transitions must cross the RPC')
  assert(row.member_delete === false, 'matches must never be deleted directly')
  assert(row.anon_create === false, 'anon must not challenge')
  assert(row.anon_approve === false, 'anon must not approve')
  assert(row.member_create === true, 'an authenticated member can call the RPC')
  assert(row.member_auto === true, 'the auto-approval job is callable by authenticated members')
})

await test('N10: challenges need two active linked players and one open match per pair', async () => {
  await inTransaction(async () => {
    await actAs('postgres')
    // The fixtures link only P1; give P4 the manager's account so a second
    // player can accept challenges. Rolled back with the test.
    await db.query(`update public.players set profile_id = '${D}' where id = '${P4}'`)
    const rivalId = P4

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.create_friendly_challenge('${P1}', null)`,
      /cannot challenge yourself/i,
    )
    await expectQueryError(
      `select public.create_friendly_challenge('${P2}', null)`,
      /no linked account/i,
    )
    await expectQueryError(
      `select public.create_friendly_challenge('${P7}', null)`,
      /not available/i,
    )

    const created = await db.query(
      `select public.create_friendly_challenge('${rivalId}', 'Saturday court 2') as result`,
    )
    assert(created.rows[0].result.status === 'pending', 'a new challenge starts pending')

    await expectQueryError(
      `select public.create_friendly_challenge('${rivalId}', null)`,
      /already have an open friendly/i,
    )

    await actAs('authenticated', D)
    await expectQueryError(
      `select public.create_friendly_challenge('${P1}', null)`,
      /already have an open friendly/i,
    )

    await actAs('postgres')
    const audit = await db.query(
      `select count(*)::int as total from public.audit_logs
        where action = 'friendly.challenge.created'`,
    )
    assert(audit.rows[0].total === 1, 'challenge creation is audited')
  })
})

await test('N10: only the challenged player responds and only the challenger cancels', async () => {
  await inTransaction(async () => {
    await actAs('postgres')
    await db.query(`update public.players set profile_id = '${D}' where id = '${P4}'`)
    const rivalId = P4
    const rivalProfile = D

    await actAs('authenticated', A)
    const created = await db.query(
      `select public.create_friendly_challenge('${rivalId}', null) as result`,
    )
    const matchId = created.rows[0].result.id

    await expectQueryError(
      `select public.respond_friendly_challenge('${matchId}', true)`,
      /only the challenged player/i,
    )

    await actAs('authenticated', B)
    await expectQueryError(
      `select public.respond_friendly_challenge('${matchId}', true)`,
      /only the challenged player|active player record/i,
    )

    await actAs('authenticated', rivalProfile)
    const accepted = await db.query(
      `select public.respond_friendly_challenge('${matchId}', true) as result`,
    )
    assert(accepted.rows[0].result.status === 'accepted', 'the challenged player accepts')
    await expectQueryError(
      `select public.respond_friendly_challenge('${matchId}', false)`,
      /no longer pending/i,
    )
    await expectQueryError(
      `select public.cancel_friendly_challenge('${matchId}')`,
      /only the challenger/i,
    )

    await actAs('authenticated', A)
    const cancelled = await db.query(
      `select public.cancel_friendly_challenge('${matchId}') as result`,
    )
    assert(cancelled.rows[0].result.status === 'cancelled', 'the challenger withdraws')

    // A declined invitation also frees the pair.
    const second = await db.query(
      `select public.create_friendly_challenge('${rivalId}', null) as result`,
    )
    const secondId = second.rows[0].result.id
    await actAs('authenticated', rivalProfile)
    const declined = await db.query(
      `select public.respond_friendly_challenge('${secondId}', false) as result`,
    )
    assert(declined.rows[0].result.status === 'declined', 'the challenged player declines')
    assert(
      (await db.query(`select id from public.friendly_matches where status = 'declined'`)).rows
        .length === 1,
      'a declined challenge keeps its row',
    )
  })
})

await test('N10: only the winner submits and only the loser approves, without moving SP', async () => {
  await inTransaction(async () => {
    await disableEnabledRules()
    const baseline = await db.query(`
      select
        (select count(*)::int from public.sp_transactions) as transactions,
        (select count(*)::int from public.sp_accounts) as accounts
    `)
    await db.query(`update public.players set profile_id = '${D}' where id = '${P4}'`)
    const rivalId = P4
    const rivalProfile = D

    await actAs('authenticated', A)
    const created = await db.query(
      `select public.create_friendly_challenge('${rivalId}', null) as result`,
    )
    const matchId = created.rows[0].result.id
    await actAs('authenticated', rivalProfile)
    await db.query(`select public.respond_friendly_challenge('${matchId}', true)`)

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.submit_friendly_result('${matchId}', '${rivalId}')`,
      /only the winner/i,
    )
    const submitted = await db.query(
      `select public.submit_friendly_result('${matchId}', '${P1}') as result`,
    )
    assert(submitted.rows[0].result.status === 'awaiting_approval', 'the winner submits')

    await expectQueryError(
      `select public.approve_friendly_result('${matchId}')`,
      /winner cannot approve/i,
    )
    await expectQueryError(
      `select public.submit_friendly_result('${matchId}', '${P1}')`,
      /only an accepted challenge/i,
    )

    await actAs('authenticated', rivalProfile)
    const confirmed = await db.query(
      `select public.approve_friendly_result('${matchId}') as result`,
    )
    assert(confirmed.rows[0].result.status === 'confirmed', 'the loser confirms')
    await expectQueryError(
      `select public.approve_friendly_result('${matchId}')`,
      /no longer awaiting approval/i,
    )

    await actAs('postgres')
    const stored = await db.query(
      `select status, confirmed_at from public.friendly_matches where id = '${matchId}'`,
    )
    assert(stored.rows[0].status === 'confirmed', 'the confirmation is stored')
    assert(stored.rows[0].confirmed_at !== null, 'confirmation records a server time')

    const after = await db.query(`
      select
        (select count(*)::int from public.sp_transactions) as transactions,
        (select count(*)::int from public.sp_accounts) as accounts
    `)
    assert(
      after.rows[0].transactions === baseline.rows[0].transactions,
      'a confirmed friendly must not write an SP transaction',
    )
    assert(
      after.rows[0].accounts === baseline.rows[0].accounts,
      'a confirmed friendly must not create an SP account',
    )
  })
})

await test('N10: the loser disputes with a reason and the result is not confirmed', async () => {
  await inTransaction(async () => {
    await actAs('postgres')
    await db.query(`update public.players set profile_id = '${D}' where id = '${P4}'`)
    const rivalId = P4
    const rivalProfile = D

    await actAs('authenticated', A)
    const created = await db.query(
      `select public.create_friendly_challenge('${rivalId}', null) as result`,
    )
    const matchId = created.rows[0].result.id
    await actAs('authenticated', rivalProfile)
    await db.query(`select public.respond_friendly_challenge('${matchId}', true)`)
    await actAs('authenticated', A)
    await db.query(`select public.submit_friendly_result('${matchId}', '${P1}')`)

    await actAs('authenticated', rivalProfile)
    await expectQueryError(
      `select public.dispute_friendly_result('${matchId}', 'no')`,
      /between 5 and 500/i,
    )

    const disputed = await db.query(
      `select public.dispute_friendly_result('${matchId}', 'The score was recorded wrong') as result`,
    )
    assert(disputed.rows[0].result.status === 'disputed', 'the loser disputes')

    const state = await db.query(
      `select status, dispute_reason, confirmed_at from public.friendly_matches where id = '${matchId}'`,
    )
    assert(state.rows[0].confirmed_at === null, 'a disputed result is never confirmed')
    assert(
      state.rows[0].dispute_reason === 'The score was recorded wrong',
      'the reason is kept for review',
    )

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.approve_friendly_result('${matchId}')`,
      /no longer awaiting approval/i,
    )
  })
})

/**
 * Gives P1 and P4 what a real approved player has: a linked account and a
 * starting SP account. The fixtures create player records without balances, so
 * an award would otherwise — correctly — refuse to run.
 */
async function ensureFriendlyAccounts() {
  await actAs('postgres')
  await db.query(`update public.players set profile_id = '${D}' where id = '${P4}'`)
  // Create any missing account the way registration approval would: 1,000 SP
  // with a matching initial ledger row, so reconciliation stays exact.
  const created = await db.query(`
    insert into public.sp_accounts (player_id, current_sp)
    values ('${P1}', 0), ('${P4}', 0)
    on conflict (player_id) do nothing
    returning player_id
  `)

  for (const row of created.rows) {
    await db.query(
      `insert into public.sp_transactions (
         player_id, transaction_type, sp_before, sp_delta, sp_after,
         reference_type, idempotency_key, metadata
       ) values (
         '${row.player_id}', 'initial', 0, 1000, 1000,
         'registration', 'player:${row.player_id}:initial',
         '{"source":"test fixture"}'::jsonb
       )`,
    )
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id = '${row.player_id}'`,
    )
  }
}

/**
 * Plays one friendly between P1 (winner) and P4 and returns the match id.
 * Leaves P4 linked to the tournament manager's account, as the other friendly
 * tests do, so either side can act.
 */
async function playFriendly({ approve = true } = {}) {
  await ensureFriendlyAccounts()

  await actAs('authenticated', A)
  const created = await db.query(`select public.create_friendly_challenge('${P4}', null) as result`)
  const matchId = created.rows[0].result.id

  await actAs('authenticated', D)
  await db.query(`select public.respond_friendly_challenge('${matchId}', true)`)

  await actAs('authenticated', A)
  await db.query(`select public.submit_friendly_result('${matchId}', '${P1}')`)

  if (approve) {
    await actAs('authenticated', D)
    await db.query(`select public.approve_friendly_result('${matchId}')`)
  }

  await actAs('postgres')
  return matchId
}

/**
 * Turns the club rule off for one rolled-back transaction. Workflow tests that
 * are not about awards use this so an enabled club rule cannot change the
 * scenario under test.
 */
async function disableEnabledRules() {
  await actAs('postgres')
  await db.query(`update public.sp_rule_versions set is_enabled = false where is_enabled`)
}

/**
 * Turns on a synthetic approved rule version for one test transaction. The
 * numbers are test inputs, not club values.
 */
async function enableTestRule(version = 'test-award', overrides = {}) {
  const config = {
    baseChange: 10,
    strengthSensitivity: 0.01,
    minGainPerMatch: 2,
    maxGainPerMatch: 16,
    minLossPerMatch: 2,
    maxLossPerMatch: 16,
    floor: 0,
    tournamentMultiplier: 2,
    rounding: 'round',
    doublesSplit: 'even',
    ...overrides,
  }

  await disableEnabledRules()
  await db.query(
    `insert into public.sp_rule_versions (version, status, config, is_enabled, notes)
     values ('${version}', 'approved', '${JSON.stringify(config)}'::jsonb, true, 'test harness rule')`,
  )
}

await test('P4: a confirmed friendly awards nothing while no rule version is enabled', async () => {
  await inTransaction(async () => {
    await disableEnabledRules()
    await ensureFriendlyAccounts()
    const snapshot = `
      select (select count(*)::int from public.sp_transactions) as tx,
             (select current_sp from public.sp_accounts where player_id = '${P1}') as p1,
             (select current_sp from public.sp_accounts where player_id = '${P4}') as p4
    `
    const before = await db.query(snapshot)

    const matchId = await playFriendly()

    const after = await db.query(snapshot)
    assert(after.rows[0].tx === before.rows[0].tx, 'no ledger row without an enabled rule')
    assert(after.rows[0].p1 === before.rows[0].p1, 'the winner balance is unchanged')
    assert(after.rows[0].p4 === before.rows[0].p4, 'the loser balance is unchanged')

    const award = await db.query(`select public.award_friendly_sp('${matchId}') as result`)
    assert(award.rows[0].result.status === 'disabled', 'the award reports disabled')
    assert(award.rows[0].result.awarded === 0, 'nothing is awarded')
  })
})

await test('P4: an approved, enabled rule awards both players exactly once', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )
    const matchId = await playFriendly()

    const rows = await db.query(
      `select player_id, sp_before, sp_delta, sp_after, idempotency_key, rule_version
         from public.sp_transactions
        where reference_id = '${matchId}'
        order by player_id`,
    )
    assert(rows.rows.length === 2, 'one ledger row per player')

    const deltas = rows.rows.map((row) => row.sp_delta).sort((a, b) => a - b)
    assert(JSON.stringify(deltas) === JSON.stringify([-10, 10]), 'equal ratings move ±10')

    for (const row of rows.rows) {
      assert(row.sp_before + row.sp_delta === row.sp_after, 'each row balances')
      assert(row.rule_version === 'test-award', 'the row records the rule version')
      assert(row.idempotency_key.startsWith('friendly:'), 'the key names the source')
    }

    const replay = await db.query(`select public.award_friendly_sp('${matchId}') as result`)
    assert(replay.rows[0].result.awarded === 0, 'a replay awards nothing')
    assert(replay.rows[0].result.skipped === 2, 'both players are already processed')

    const total = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(total.rows[0].n === 2, 'no duplicate rows')

    await actAs('authenticated', C)
    const recon = await db.query(`select public.reconcile_sp_balances() as result`)
    assert(recon.rows[0].result.consistent === true, 'the ledger still reconciles')
  })
})

await test('P4: the approved club rule awards 20 points at equal ratings', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )
    const matchId = await playFriendly()

    const rows = await db.query(
      `select player_id, sp_delta, rule_version
         from public.sp_transactions
        where reference_id = '${matchId}'
        order by player_id`,
    )
    assert(rows.rows.length === 2, 'one ledger row per player')

    const deltas = rows.rows.map((row) => row.sp_delta).sort((a, b) => a - b)
    assert(JSON.stringify(deltas) === JSON.stringify([-20, 20]), 'the approved base moves ±20')
    assert(
      rows.rows.every((row) => row.rule_version === 'approved-2026-11'),
      'the ledger records the approved rule version',
    )
  })
})

await test('P4: the award rounds half-up on the size of the change', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await db.query(`update public.sp_accounts set current_sp = 1000 where player_id = '${P1}'`)
    // P4 starts 25 points above P1, so the raw change is 20.5 -> 21.
    await db.query(`update public.sp_accounts set current_sp = 1025 where player_id = '${P4}'`)
    await enableTestRule('test-rounding', {
      baseChange: 20,
      strengthSensitivity: 0.02,
      minGainPerMatch: 5,
      maxGainPerMatch: 40,
      minLossPerMatch: 5,
      maxLossPerMatch: 40,
    })

    const matchId = await playFriendly()

    const winner = await db.query(
      `select sp_delta from public.sp_transactions
        where reference_id = '${matchId}' and player_id = '${P1}'`,
    )
    const loser = await db.query(
      `select sp_delta from public.sp_transactions
        where reference_id = '${matchId}' and player_id = '${P4}'`,
    )

    assert(winner.rows[0].sp_delta === 21, `expected +21, got ${winner.rows[0].sp_delta}`)
    assert(loser.rows[0].sp_delta === -21, `expected -21, got ${loser.rows[0].sp_delta}`)
  })
})

await test('P4: auto-approval awards SP once, and the helper is internal', async () => {
  await inTransaction(async () => {
    await enableTestRule()
    const matchId = await playFriendly({ approve: false })

    await actAs('postgres')
    await db.query(
      `update public.friendly_matches
          set auto_approval_due_at = now() - interval '1 minute'
        where id = '${matchId}'`,
    )
    // The scheduler has no JWT.
    await db.exec(`set local request.jwt.claim.sub = ''`)

    const first = await db.query(`select public.auto_approve_friendly_matches() as result`)
    const second = await db.query(`select public.auto_approve_friendly_matches() as result`)

    assert(first.rows[0].result === 1, 'the overdue match is approved')
    assert(second.rows[0].result === 0, 'a replay approves nothing')

    const total = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(total.rows[0].n === 2, 'the job awards exactly once per player')
  })

  const { rows } = await db.query(`
    select
      has_function_privilege('authenticated', 'public.award_friendly_sp(uuid)', 'EXECUTE') as member,
      has_function_privilege('anon', 'public.award_friendly_sp(uuid)', 'EXECUTE') as anon
  `)
  assert(rows[0].member === false, 'members cannot award SP directly')
  assert(rows[0].anon === false, 'anon cannot award SP')
})

/**
 * Gives the players a starting balance so a tournament award can run. Mirrors
 * registration approval: 1,000 SP with a matching initial ledger row.
 */
async function ensureTournamentAccounts(playerIds) {
  await actAs('postgres')

  for (const playerId of playerIds) {
    const existing = await db.query(
      `select current_sp from public.sp_accounts where player_id = '${playerId}'`,
    )

    if (existing.rows.length > 0) continue

    await db.query(
      `insert into public.sp_transactions (
         player_id, transaction_type, sp_before, sp_delta, sp_after,
         reference_type, idempotency_key, metadata
       ) values (
         '${playerId}', 'initial', 0, 1000, 1000,
         'registration', 'player:${playerId}:initial',
         '{"source":"test fixture"}'::jsonb
       )`,
    )
    await db.query(
      `insert into public.sp_accounts (player_id, current_sp) values ('${playerId}', 1000)`,
    )
  }
}

/** Creates a one-match event, records the result, and returns the award. */
async function playTournamentMatch({
  discipline = 'singles',
  homePlayers,
  awayPlayers,
  homeWins = true,
}) {
  await actAs('authenticated', D)
  const tournament = await createTournament('SP Cup')
  const event = await createEvent(tournament.id, discipline)
  const home = (await registerEntry(event.id, homePlayers, 1)).rows[0].result.entry_id
  const away = (await registerEntry(event.id, awayPlayers, 2)).rows[0].result.entry_id

  await saveDraw(event.id, [
    {
      key: 'm1',
      bracket: 'winners',
      round: 1,
      position: 1,
      home_entry_id: home,
      away_entry_id: away,
    },
  ])

  const matchId = await matchIdFor(event.id, 'winners', 1)
  const games = homeWins
    ? [
        { home_points: 21, away_points: 10 },
        { home_points: 21, away_points: 12 },
      ]
    : [
        { home_points: 10, away_points: 21 },
        { home_points: 12, away_points: 21 },
      ]

  const recorded = await recordResult(matchId, games)

  return { tournament, event, matchId, home, away, result: recorded.rows[0].result }
}

await test('P5: a completed tournament match awards the 2x adjustment to both players', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    const { matchId, result } = await playTournamentMatch({
      homePlayers: [P1],
      awayPlayers: [P4],
      homeWins: true,
    })

    assert(result.sp_award.status === 'awarded', 'the award runs')
    assert(
      result.sp_award.team_total === 40,
      `expected a 40-point team total, got ${result.sp_award.team_total}`,
    )

    await actAs('postgres')
    const rows = await db.query(`
      select player_id, transaction_type, sp_delta, sp_after, rule_version, idempotency_key
        from public.sp_transactions
       where reference_type = 'match' and reference_id = '${matchId}'
       order by player_id
    `)
    assert(rows.rows.length === 2, 'one row per player')

    const byPlayer = Object.fromEntries(rows.rows.map((row) => [row.player_id, row]))
    assert(byPlayer[P1].transaction_type === 'tournament', 'the row is a tournament row')
    assert(byPlayer[P1].sp_delta === 40, 'the winner gains 40')
    assert(byPlayer[P4].sp_delta === -40, 'the loser drops 40')
    assert(byPlayer[P1].sp_after === 1040, 'the winner balance is cached')
    assert(byPlayer[P4].sp_after === 960, 'the loser balance is cached')
    assert(byPlayer[P1].rule_version === 'approved-2026-11', 'the approved version is recorded')
    assert(
      byPlayer[P1].idempotency_key === `tournament:${matchId}:${P1}`,
      'the idempotency key is deterministic',
    )
  })
})

await test('P5: replaying the tournament award writes nothing', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    const { matchId } = await playTournamentMatch({ homePlayers: [P1], awayPlayers: [P4] })

    await actAs('postgres')
    const replay = await db.query(`select public.award_tournament_sp('${matchId}') as result`)
    assert(replay.rows[0].result.awarded === 0, 'a replay awards nothing')

    const count = await db.query(
      `select count(*)::int as n
         from public.sp_transactions
        where reference_id = '${matchId}' and transaction_type = 'tournament'`,
    )
    assert(count.rows[0].n === 2, 'still exactly two rows')
  })
})

await test('P5: doubles splits the team adjustment between rated partners', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P2, P3, P4])
    const { matchId, result } = await playTournamentMatch({
      discipline: 'mixed_doubles',
      homePlayers: [P1, P4],
      awayPlayers: [P3, P2],
      homeWins: true,
    })

    assert(result.sp_award.team_total === 40, 'the team adjustment is 40')

    await actAs('postgres')
    const rows = await db.query(`
      select player_id, sp_delta
        from public.sp_transactions
       where reference_type = 'match' and reference_id = '${matchId}'
       order by player_id
    `)
    const byPlayer = Object.fromEntries(rows.rows.map((row) => [row.player_id, row.sp_delta]))

    assert(rows.rows.length === 4, 'one row per rated player')
    assert(byPlayer[P1] === 20 && byPlayer[P4] === 20, 'each winner partner gains half')
    assert(byPlayer[P2] === -20 && byPlayer[P3] === -20, 'each loser partner drops half')
  })
})

await test('P5: a correction reverses the award and re-awards under the original version', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    const { matchId, result } = await playTournamentMatch({
      homePlayers: [P1],
      awayPlayers: [P4],
      homeWins: true,
    })
    assert(result.sp_award.awarded === 2, 'the first result awards both players')

    await actAs('authenticated', D)
    const corrected = await db.query(
      `select public.correct_match_result(
         '${matchId}',
         '[{"home_points":10,"away_points":21},{"home_points":12,"away_points":21}]'::jsonb,
         'Winner corrected'
       ) as result`,
    )
    const correctedResult = corrected.rows[0].result

    assert(correctedResult.sp_reversal.reversed === 2, 'the original awards are reversed')
    assert(correctedResult.sp_award.awarded === 2, 'the corrected result is re-awarded')

    await actAs('postgres')
    const reversals = await db.query(`
      select transaction_type, sp_delta, reference_type, rule_version
        from public.sp_transactions
       where reference_type = 'correction' and metadata ->> 'match_id' = '${matchId}'
       order by player_id
    `)
    assert(reversals.rows.length === 2, 'two compensating rows')
    assert(
      reversals.rows.every((row) => row.transaction_type === 'reversal'),
      'the compensating rows are reversals',
    )
    assert(
      reversals.rows.every((row) => row.rule_version === 'approved-2026-11'),
      'the reversal keeps the original rule version',
    )

    const balances = await db.query(`
      select player_id, current_sp
        from public.sp_accounts
       where player_id in ('${P1}', '${P4}')
    `)
    const balanceByPlayer = Object.fromEntries(
      balances.rows.map((row) => [row.player_id, row.current_sp]),
    )
    assert(balanceByPlayer[P1] === 960, 'the former winner now loses')
    assert(balanceByPlayer[P4] === 1040, 'the corrected winner now gains')

    const awards = await db.query(`
      select idempotency_key, rule_version
        from public.sp_transactions
       where reference_type = 'match' and reference_id = '${matchId}'
         and transaction_type = 'tournament'
       order by created_at, id
    `)
    assert(awards.rows.length === 4, 'two original plus two re-award rows')
    assert(
      awards.rows.every((row) => row.rule_version === 'approved-2026-11'),
      'the re-award uses the original rule version',
    )
    assert(
      awards.rows.some((row) => row.idempotency_key === `tournament:${matchId}:${P1}:2`),
      'the re-award gets a new key',
    )
  })
})

await test('P5: a score-only correction that keeps the winner writes no SP rows', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    const { matchId } = await playTournamentMatch({
      homePlayers: [P1],
      awayPlayers: [P4],
      homeWins: true,
    })

    await actAs('authenticated', D)
    const corrected = await db.query(
      `select public.correct_match_result(
         '${matchId}',
         '[{"home_points":21,"away_points":15},{"home_points":21,"away_points":18}]'::jsonb,
         'Scores corrected, same winner'
       ) as result`,
    )
    const correctedResult = corrected.rows[0].result

    assert(
      correctedResult.sp_reversal.status === 'unchanged',
      'no reversal runs when the winner is unchanged',
    )
    assert(
      correctedResult.sp_award.status === 'unchanged',
      'no re-award runs when the winner is unchanged',
    )

    await actAs('postgres')
    const ledger = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(ledger.rows[0].n === 2, 'the original two awards are untouched')

    const balances = await db.query(`
      select player_id, current_sp
        from public.sp_accounts
       where player_id in ('${P1}', '${P4}')
    `)
    const balanceByPlayer = Object.fromEntries(
      balances.rows.map((row) => [row.player_id, row.current_sp]),
    )
    assert(balanceByPlayer[P1] === 1040, 'the winner keeps the original gain')
    assert(balanceByPlayer[P4] === 960, 'the loser keeps the original loss')
  })
})

await test('P5: no tournament award runs while no rule version is enabled', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    await disableEnabledRules()

    const { matchId, result } = await playTournamentMatch({
      homePlayers: [P1],
      awayPlayers: [P4],
    })

    assert(result.sp_award.status === 'disabled', 'the award reports disabled')

    await actAs('postgres')
    const count = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(count.rows[0].n === 0, 'no ledger row without an enabled rule')
  })
})

await test('P5: the tournament award helpers are internal', async () => {
  const { rows } = await db.query(`
    select
      has_function_privilege('authenticated', 'public.award_tournament_sp(uuid,text)', 'EXECUTE') as member_award,
      has_function_privilege('anon', 'public.award_tournament_sp(uuid,text)', 'EXECUTE') as anon_award,
      has_function_privilege('authenticated', 'public.reverse_tournament_sp(uuid,text)', 'EXECUTE') as member_reverse,
      has_function_privilege('anon', 'public.reverse_tournament_sp(uuid,text)', 'EXECUTE') as anon_reverse
  `)
  assert(rows[0].member_award === false, 'members cannot award tournament SP directly')
  assert(rows[0].anon_award === false, 'anon cannot award tournament SP')
  assert(rows[0].member_reverse === false, 'members cannot reverse tournament SP')
  assert(rows[0].anon_reverse === false, 'anon cannot reverse tournament SP')
})

/** Creates and starts a season as the Super Admin, then returns its id. */
async function openSeason(label = 'Season 2026', starts = '2026-01-01', ends = '2026-12-31') {
  await actAs('authenticated', C)
  const created = await db.query(
    `select public.create_season('${label}', '${starts}', '${ends}') as result`,
  )
  const seasonId = created.rows[0].result.id
  await db.query(`select public.start_season('${seasonId}')`)
  await actAs('postgres')
  return seasonId
}

// ---------------------------------------------------------------------------
// Placement and unplayed matches (D15-D19, S21)
// ---------------------------------------------------------------------------
await test('D15/D17: a friendly placement moves only the Unrated player and hides the value', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )
    await db.query(`update public.players set rating_status = 'unrated' where id = '${P4}'`)

    const matchId = await playFriendly()

    await actAs('postgres')
    const rows = await db.query(`
      select player_id, sp_delta, metadata
        from public.sp_transactions
       where reference_id = '${matchId}'
       order by player_id
    `)
    assert(rows.rows.length === 1, `only the Unrated player gets a row, got ${rows.rows.length}`)
    assert(rows.rows[0].player_id === P4, 'the Unrated loser owns the row')
    assert(rows.rows[0].sp_delta === -10, 'the Unrated player keeps their normal change')
    assert(rows.rows[0].metadata.placement === true, 'the row is marked as placement')
    assert(rows.rows[0].metadata.rating_status === 'unrated', 'the row records the rating status')

    const credits = await db.query(`
      select count(*)::int as n
        from public.placement_credits
       where player_id = '${P4}' and source = 'friendly' and voided_at is null
    `)
    assert(credits.rows[0].n === 1, 'one placement credit is recorded')

    const balance = await db.query(
      `select current_sp from public.sp_accounts where player_id = '${P4}'`,
    )
    assert(balance.rows[0].current_sp === 990, 'the hidden provisional balance moves to 990')

    await actAs('authenticated', A)
    const publicRows = await db.query(
      `select player_id from public.published_sp_leaderboard where player_id = '${P4}'`,
    )
    assert(publicRows.rows.length === 0, 'the public leaderboard excludes an Unrated player')

    await actAs('authenticated', D)
    const hidden = await db.query(
      `select id from public.published_sp_transactions where player_id = '${P4}'`,
    )
    assert(hidden.rows.length === 0, 'the Unrated player cannot read their own ledger')

    const progress = await db.query(
      `select credits, required, rating_status
         from public.placement_progress where player_id = '${P4}'`,
    )
    assert(
      progress.rows[0].credits === 1 && progress.rows[0].required === 10,
      `expected progress 1/10, got ${progress.rows[0].credits}/${progress.rows[0].required}`,
    )
    assert(progress.rows[0].rating_status === 'unrated', 'the player is still Unrated')

    await actAs('authenticated', C)
    const audit = await db.query(
      `select current_sp, credits from public.placement_audit where player_id = '${P4}'`,
    )
    assert(audit.rows[0].current_sp === 990, 'a Super Admin sees the provisional value')
    assert(audit.rows[0].credits === 1, 'a Super Admin sees the credit count')

    await actAs('authenticated', A)
    const notAudit = await db.query(
      `select player_id from public.placement_audit where player_id = '${P4}'`,
    )
    assert(notAudit.rows.length === 0, 'a non-admin sees no placement audit')
    await actAs('postgres')
  })
})

await test('D15: the 10th credit publishes the provisional balance unchanged', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )
    await db.query(`update public.players set rating_status = 'unrated' where id = '${P4}'`)

    const matchId = await playFriendly()
    // P4 lost 10 (990) and already owns one credit. Add eight more directly,
    // then let the ninth call go through the RPC so qualification is exercised.
    await actAs('postgres')
    await db.query(`
      insert into public.placement_credits (player_id, source, match_id, rule_version)
      select '${P4}', 'friendly', gen_random_uuid(), 'test-award'
        from generate_series(1, 8)
    `)
    const tenth = await db.query(
      `select public.record_placement_credit('${P4}', 'friendly', gen_random_uuid(), 'test-award') as result`,
    )
    assert(tenth.rows[0].result.status === 'qualified', 'the 10th credit qualifies the player')

    const player = await db.query(`select rating_status from public.players where id = '${P4}'`)
    assert(player.rows[0].rating_status === 'rated', 'the player is permanently Rated')

    const qualification = await db.query(
      `select credit_count, published_sp
         from public.placement_qualifications where player_id = '${P4}'`,
    )
    assert(qualification.rows[0].credit_count === 10, 'the qualification records 10 credits')
    assert(
      qualification.rows[0].published_sp === 990,
      `expected the unchanged provisional value 990, got ${qualification.rows[0].published_sp}`,
    )

    const balance = await db.query(
      `select current_sp from public.sp_accounts where player_id = '${P4}'`,
    )
    assert(balance.rows[0].current_sp === 990, 'qualification does not reset or bonus the balance')

    await actAs('authenticated', A)
    const published = await db.query(
      `select current_sp from public.published_sp_balances where player_id = '${P4}'`,
    )
    assert(
      published.rows.length === 1 && published.rows[0].current_sp === 990,
      'the balance is now public',
    )

    await actAs('authenticated', D)
    const ledger = await db.query(
      `select id from public.published_sp_transactions
        where player_id = '${P4}' and reference_id = '${matchId}'`,
    )
    assert(ledger.rows.length === 1, 'the placement row becomes ordinary history')

    await actAs('postgres')
    const again = await db.query(
      `select public.record_placement_credit('${P4}', 'friendly', gen_random_uuid(), 'test-award') as result`,
    )
    assert(again.rows[0].result.status === 'already_rated', 'a Rated player earns no further credit')
  })
})

await test('D19: an Unrated doubles partner keeps only their own share', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P2, P3, P4])
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000
        where player_id in ('${P1}', '${P2}', '${P3}', '${P4}')`,
    )
    await db.query(`update public.players set rating_status = 'unrated' where id = '${P4}'`)

    const { matchId, result } = await playTournamentMatch({
      discipline: 'mixed_doubles',
      homePlayers: [P1, P4],
      awayPlayers: [P2, P3],
      homeWins: true,
    })
    assert(result.sp_award.placement === true, 'the match is a placement match')
    assert(result.sp_award.team_total === 20, 'the test rule makes a 20-point team total')
    assert(result.sp_award.awarded === 1, 'only the Unrated participant moves')

    await actAs('postgres')
    const rows = await db.query(`
      select player_id, sp_delta
        from public.sp_transactions
       where reference_type = 'match' and reference_id = '${matchId}'
       order by player_id
    `)
    const byPlayer = Object.fromEntries(rows.rows.map((row) => [row.player_id, row.sp_delta]))
    assert(rows.rows.length === 1, `only the Unrated partner gets a row, got ${rows.rows.length}`)
    assert(byPlayer[P1] === undefined, 'the Rated partner receives no SP change')
    assert(byPlayer[P4] === 10, 'the Unrated partner keeps their own half share')
    assert(
      byPlayer[P2] === undefined && byPlayer[P3] === undefined,
      'Rated opponents receive no SP change in a placement match',
    )

    const credits = await db.query(`
      select count(*)::int as n
        from public.placement_credits
       where player_id = '${P4}' and source = 'tournament' and voided_at is null
    `)
    assert(credits.rows[0].n === 1, 'the Unrated partner earns one credit')

    const ratedCredits = await db.query(
      `select count(*)::int as n from public.placement_credits where player_id = '${P1}'`,
    )
    assert(ratedCredits.rows[0].n === 0, 'a Rated participant earns no placement credit')
  })
})

await test('S21: a placement match accrues no Seasonal SP for anyone', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    const seasonId = await openSeason()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )
    await db.query(`update public.players set rating_status = 'unrated' where id = '${P4}'`)

    const { matchId } = await playTournamentMatch({
      homePlayers: [P1],
      awayPlayers: [P4],
    })

    await actAs('postgres')
    const seasonal = await db.query(
      `select count(*)::int as n from public.season_balances where season_id = '${seasonId}'`,
    )
    assert(seasonal.rows[0].n === 0, 'no participant accrues Seasonal SP in a placement match')

    const rows = await db.query(
      `select metadata from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(rows.rows.length === 1, 'only the Unrated participant moves')
    assert(rows.rows[0].metadata.season_id === null, 'the placement row records no season')
  })
})

await test('D15: qualification is permanent and later matches are ordinary', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )
    await db.query(`update public.players set rating_status = 'unrated' where id = '${P4}'`)

    for (let index = 0; index < 10; index += 1) {
      await db.query(
        `select public.record_placement_credit('${P4}', 'friendly', gen_random_uuid(), 'test-award')`,
      )
    }

    const qualified = await db.query(`select rating_status from public.players where id = '${P4}'`)
    assert(qualified.rows[0].rating_status === 'rated', 'ten credits qualify the player')

    const matchId = await playFriendly()

    await actAs('postgres')
    const rows = await db.query(`
      select player_id, sp_delta
        from public.sp_transactions
       where reference_id = '${matchId}'
       order by player_id
    `)
    assert(rows.rows.length === 2, 'an ordinary match moves both players')
    const deltas = rows.rows.map((row) => row.sp_delta).sort((a, b) => a - b)
    assert(JSON.stringify(deltas) === JSON.stringify([-10, 10]), 'the normal rule applies')

    const credits = await db.query(
      `select count(*)::int as n from public.placement_credits where player_id = '${P4}'`,
    )
    assert(credits.rows[0].n === 10, 'a Rated player earns no further credits')
  })
})

await test('D15: a zero-delta placement result still earns a credit', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await enableTestRule('test-floor', { baseChange: 10, floor: 0 })
    await db.query(
      `update public.sp_accounts set current_sp = 0 where player_id in ('${P1}', '${P4}')`,
    )
    await db.query(`update public.players set rating_status = 'unrated' where id = '${P4}'`)

    const matchId = await playFriendly()

    await actAs('postgres')
    const rows = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(rows.rows[0].n === 0, 'a zero change writes no ledger row')

    const credits = await db.query(`
      select count(*)::int as n
        from public.placement_credits
       where player_id = '${P4}' and voided_at is null
    `)
    assert(credits.rows[0].n === 1, 'the match still counts toward placement')
  })
})

await test('D18: an unplayed tournament result reverses SP and voids placement credits', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )
    await db.query(`update public.players set rating_status = 'unrated' where id = '${P4}'`)

    const { matchId, home } = await playTournamentMatch({
      homePlayers: [P1],
      awayPlayers: [P4],
      homeWins: true,
    })
    // P1 is Rated and gets no row; P4 lost 20 and owns one credit.
    await actAs('authenticated', D)
    const marked = await db.query(
      `select public.mark_match_unplayed(
         '${matchId}', '${home}', 'walkover', 'Opponent withdrew'
       ) as result`,
    )
    const outcome = marked.rows[0].result
    assert(outcome.status === 'recorded', 'the unplayed outcome is recorded')
    assert(outcome.result_kind === 'walkover', 'the result kind is walkover')
    assert(outcome.sp_reversal.reversed === 1, 'the Unrated award is reversed')

    await actAs('postgres')
    const balance = await db.query(
      `select current_sp from public.sp_accounts where player_id = '${P4}'`,
    )
    assert(balance.rows[0].current_sp === 1000, 'the provisional balance returns to 1000')

    const credit = await db.query(`
      select voided_at, void_reason
        from public.placement_credits
       where player_id = '${P4}' and source = 'tournament'
    `)
    assert(credit.rows[0].voided_at !== null, 'the placement credit is voided, not deleted')
    assert(credit.rows[0].void_reason === 'Opponent withdrew', 'the void reason is kept')

    const progress = await db.query(
      `select credits from public.placement_progress where player_id = '${P4}'`,
    )
    assert(progress.rows[0].credits === 0, 'voided credits do not count toward placement')

    const award = await db.query(`select public.award_tournament_sp('${matchId}') as result`)
    assert(award.rows[0].result.status === 'skipped', 'an unplayed result awards nothing')
  })
})

await test('D18: a pending match can record a walkover without moving SP', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )

    await actAs('authenticated', D)
    const tournament = await createTournament('Walkover Cup')
    const event = await createEvent(tournament.id, 'singles')
    const home = (await registerEntry(event.id, [P1], 1)).rows[0].result.entry_id
    const away = (await registerEntry(event.id, [P4], 2)).rows[0].result.entry_id
    await saveDraw(event.id, [
      {
        key: 'm1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: home,
        away_entry_id: away,
      },
    ])
    const matchId = await matchIdFor(event.id, 'winners', 1)

    const marked = await db.query(
      `select public.mark_match_unplayed(
         '${matchId}', '${home}', 'no_show', 'Away did not appear'
       ) as result`,
    )
    assert(marked.rows[0].result.result_kind === 'no_show', 'the walkover is recorded')

    await actAs('postgres')
    const rows = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(rows.rows[0].n === 0, 'no SP row is written for an unplayed match')
  })
})

await test('D18: a friendly recorded as a walkover awards nothing', async () => {
  await inTransaction(async () => {
    await disableEnabledRules()
    const matchId = await playFriendly()

    await actAs('postgres')
    await db.query(
      `update public.friendly_matches set result_kind = 'walkover' where id = '${matchId}'`,
    )
    await enableTestRule()

    const award = await db.query(`select public.award_friendly_sp('${matchId}') as result`)
    assert(award.rows[0].result.status === 'skipped', 'the unplayed friendly is skipped')

    const rows = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(rows.rows[0].n === 0, 'no SP row is written')
  })
})

/** Links a player to a fresh active profile for the seasonal eligibility rules. */
async function linkActivePlayer(playerId, profileId, fullName) {
  await actAs('postgres')
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data)
     values ('${profileId}', '${profileId}@example.test', '{"full_name":"${fullName}"}'::jsonb)
     on conflict (id) do nothing`,
  )
  await db.query(
    `insert into public.profiles (id, full_name, status)
     values ('${profileId}', '${fullName}', 'active')
     on conflict (id) do update set status = 'active'`,
  )
  await db.query(`update public.players set profile_id = '${profileId}' where id = '${playerId}'`)
}

/**
 * Inserts one already-confirmed friendly so a player has an eligible match.
 * It writes no SP: the seasonal tests set Seasonal SP directly and only need the
 * S10/S18 eligibility evidence.
 */
async function confirmFriendly(challenger, opponent, winner, at = '2026-06-01T00:00:00Z') {
  await actAs('postgres')
  await db.query(`
    insert into public.friendly_matches (
      challenger_id, opponent_id, status, winner_id,
      submitted_by, submitted_at, auto_approval_due_at, confirmed_at
    ) values (
      '${challenger}', '${opponent}', 'confirmed', '${winner}',
      '${A}', '${at}', '${at}', '${at}'
    )
  `)
}

await test('S1: seasonal tables are read-only to clients and callable through audited RPCs', async () => {
  const { rows } = await db.query(`
    select
      has_table_privilege('authenticated', 'public.seasons', 'INSERT') as seasons_insert,
      has_table_privilege('authenticated', 'public.season_balances', 'UPDATE') as balances_update,
      has_table_privilege('authenticated', 'public.season_player_results', 'DELETE') as results_delete,
      has_table_privilege('authenticated', 'public.season_deduction_entries', 'INSERT') as entries_insert,
      has_table_privilege('anon', 'public.seasons', 'SELECT') as anon_seasons,
      has_table_privilege('authenticated', 'public.season_balances', 'SELECT') as member_balances,
      has_function_privilege('authenticated', 'public.close_season(uuid)', 'EXECUTE') as member_close
  `)
  const row = rows[0]

  assert(row.member_balances === true, 'members read the seasonal leaderboard')
  assert(row.member_close === true, 'members may call the guarded RPC')
  assert(row.seasons_insert === false, 'seasons are created through the RPC')
  assert(row.balances_update === false, 'seasonal balances are RPC-only')
  assert(row.results_delete === false, 'a snapshot is never deleted by a client')
  assert(row.entries_insert === false, 'deduction entries are never inserted by a client')
  assert(row.anon_seasons === false, 'anon cannot read seasons')
})

await test('S2/S3: only a Super Admin creates a season and only one may be active', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', A)
    await expectQueryError(
      `select public.create_season('Season 2026', '2026-01-01', '2026-12-31')`,
      /not authorized/i,
    )

    await actAs('authenticated', C)
    const created = await db.query(
      `select public.create_season('Season 2026', '2026-01-01', '2026-12-31') as result`,
    )
    const seasonId = created.rows[0].result.id
    assert(created.rows[0].result.status === 'scheduled', 'a new season starts scheduled')

    await expectQueryError(
      `select public.create_season('Overlapping', '2026-06-01', '2027-06-01')`,
      /overlaps/i,
    )

    const next = await db.query(
      `select public.create_season('Season 2027', '2027-01-01', '2027-12-31') as result`,
    )
    const nextId = next.rows[0].result.id

    const started = await db.query(`select public.start_season('${seasonId}') as result`)
    assert(started.rows[0].result.status === 'active', 'the season becomes active')

    const again = await db.query(`select public.start_season('${seasonId}') as result`)
    assert(
      again.rows[0].result.already_processed === true,
      'replaying the activation is a no-op',
    )
    await expectQueryError(`select public.start_season('${nextId}')`, /another season/i)

    await actAs('postgres')
    const steps = await db.query(
      `select step from public.season_transition_steps where season_id = '${seasonId}'`,
    )
    assert(
      steps.rows.length === 1 && steps.rows[0].step === 'activated',
      'activation is checkpointed',
    )
  })
})

await test('S1/S13: an awarded friendly accrues Seasonal SP in the active season', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await enableTestRule()
    await db.query(
      `update public.sp_accounts set current_sp = 1000 where player_id in ('${P1}', '${P4}')`,
    )

    const seasonId = await openSeason()
    const matchId = await playFriendly()

    await actAs('postgres')
    const balances = await db.query(
      `select seasonal_sp from public.season_balances where season_id = '${seasonId}' order by seasonal_sp`,
    )
    assert(balances.rows.length === 2, 'both players get a seasonal balance')
    const values = balances.rows.map((row) => row.seasonal_sp)
    assert(JSON.stringify(values) === JSON.stringify([-10, 10]), 'seasonal SP mirrors the award')

    const matchRows = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${matchId}'`,
    )
    assert(matchRows.rows[0].n === 2, 'the award still writes two ledger rows')
  })
})

await test('S1/S13: a tournament award accrues Seasonal SP in the active season', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    const seasonId = await openSeason()
    await playTournamentMatch({ homePlayers: [P1], awayPlayers: [P4] })

    await actAs('postgres')
    const balances = await db.query(
      `select seasonal_sp from public.season_balances where season_id = '${seasonId}' order by seasonal_sp`,
    )
    assert(balances.rows.length === 2, 'both players get a seasonal balance')

    const values = balances.rows.map((row) => row.seasonal_sp)
    assert(
      JSON.stringify(values) === JSON.stringify([-40, 40]),
      'seasonal SP mirrors the 2x tournament award',
    )
  })
})

await test('S8/S12/S19: closing a season snapshots shared ranks and generates a pending batch', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await ensureTournamentAccounts([P5, P6])
    await linkActivePlayer(P5, '88888888-8888-4888-8888-888888888888', 'Eli Male')
    await linkActivePlayer(P6, '99999999-9999-4999-8999-999999999999', 'Fay Unknown')

    const seasonId = await openSeason()

    await actAs('postgres')
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values
        ('${seasonId}', '${P1}', 1200),
        ('${seasonId}', '${P4}', 1200),
        ('${seasonId}', '${P5}', 900),
        ('${seasonId}', '${P6}', -20)
    `)

    // S10/S18: every ranked player needs at least one eligible finalized match.
    await confirmFriendly(P1, P4, P1)
    await confirmFriendly(P5, P6, P5)

    await actAs('authenticated', C)
    const closed = await db.query(`select public.close_season('${seasonId}') as result`)
    const result = closed.rows[0].result
    assert(result.status === 'closed', 'the season closes')
    assert(result.snapshots >= 4, `expected at least 4 snapshots, got ${result.snapshots}`)

    const replay = await db.query(`select public.close_season('${seasonId}') as result`)
    assert(replay.rows[0].result.already_processed === true, 'replaying the close is a no-op')

    await actAs('postgres')
    const rows = await db.query(`
      select player_id, position, excluded_reason, deduction_position
        from public.season_player_results
       where season_id = '${seasonId}'
       order by position nulls last, player_id
    `)
    const byPlayer = Object.fromEntries(rows.rows.map((row) => [row.player_id, row]))
    assert(byPlayer[P1].position === 1, 'the first tied player is 1st')
    assert(byPlayer[P4].position === 1, 'the second tied player shares 1st')
    assert(byPlayer[P5].position === 3, 'competition ranking skips to 3rd')
    assert(byPlayer[P6].position === null, 'a negative balance has no position')
    assert(
      byPlayer[P6].excluded_reason === 'negative_seasonal_sp',
      'the exclusion reason is recorded',
    )
    assert(
      byPlayer[P6].deduction_position === null,
      'a negative balance with no previous rank is not deducted',
    )

    const entries = await db.query(
      `select player_id, position, tier, proposed_amount from public.season_deduction_entries
        where batch_id = '${result.batch_id}' order by position, player_id`,
    )
    assert(entries.rows.length === 3, 'one entry per ranked player')
    assert(
      entries.rows.every((row) => row.tier === 1 && row.proposed_amount === 40),
      'tier 1 is 40 SP',
    )
  })
})

await test('S8/S9: approving a batch caps at the balance, waives the rest, and runs once', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await db.query(`update public.sp_accounts set current_sp = 25 where player_id = '${P1}'`)
    await db.query(`update public.sp_accounts set current_sp = 1000 where player_id = '${P4}'`)

    const seasonId = await openSeason()
    await actAs('postgres')
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values ('${seasonId}', '${P1}', 1200), ('${seasonId}', '${P4}', 1000)
    `)
    await confirmFriendly(P1, P4, P1)

    await actAs('authenticated', C)
    const closed = await db.query(`select public.close_season('${seasonId}') as result`)
    const batchId = closed.rows[0].result.batch_id

    await expectQueryError(
      `select public.decide_season_deduction_batch('${batchId}', false, 'no')`,
      /between 5 and 500/i,
    )

    const approved = await db.query(
      `select public.decide_season_deduction_batch('${batchId}', true) as result`,
    )
    assert(approved.rows[0].result.status === 'approved', 'the batch is approved')
    assert(approved.rows[0].result.applied === 2, 'both players are charged')

    await expectQueryError(
      `select public.decide_season_deduction_batch('${batchId}', true)`,
      /already approved/i,
    )

    await actAs('postgres')
    const entries = await db.query(
      `select player_id, applied_amount, waived_amount from public.season_deduction_entries
        where batch_id = '${batchId}' order by player_id`,
    )
    const byPlayer = Object.fromEntries(entries.rows.map((row) => [row.player_id, row]))
    assert(byPlayer[P1].applied_amount === 25, 'the deduction is capped at the balance')
    assert(byPlayer[P1].waived_amount === 15, 'the remainder is permanently waived')
    assert(byPlayer[P4].applied_amount === 40, 'a sufficient balance pays the tier')
    assert(byPlayer[P4].waived_amount === 0, 'nothing is waived when the balance covers it')

    const balances = await db.query(`
      select player_id, current_sp from public.sp_accounts
       where player_id in ('${P1}', '${P4}')
    `)
    const balanceByPlayer = Object.fromEntries(balances.rows.map((row) => [row.player_id, row]))
    assert(balanceByPlayer[P1].current_sp === 0, 'the capped player drops to zero, not below')
    assert(balanceByPlayer[P4].current_sp === 960, 'the full tier is deducted')

    const ledger = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_type = 'season'`,
    )
    assert(ledger.rows[0].n === 2, 'one ledger row per charged player')

    const seasonal = await db.query(
      `select player_id, seasonal_sp from public.season_balances where season_id = '${seasonId}'`,
    )
    const seasonalByPlayer = Object.fromEntries(seasonal.rows.map((row) => [row.player_id, row]))
    assert(seasonalByPlayer[P1].seasonal_sp === 1200, 'a deduction never touches Seasonal SP')
  })
})

await test('S9/S3: a rejected batch is kept, applies nothing, and blocks no season', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    const seasonId = await openSeason()

    await actAs('postgres')
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values ('${seasonId}', '${P1}', 1200)
    `)
    await confirmFriendly(P1, P4, P1)

    await actAs('authenticated', C)
    const closed = await db.query(`select public.close_season('${seasonId}') as result`)
    const batchId = closed.rows[0].result.batch_id

    const rejected = await db.query(
      `select public.decide_season_deduction_batch('${batchId}', false, 'Tiers were miscalculated') as result`,
    )
    assert(rejected.rows[0].result.status === 'rejected', 'the batch is rejected')

    await actAs('postgres')
    const kept = await db.query(
      `select status, rejection_reason from public.season_deduction_batches where id = '${batchId}'`,
    )
    assert(kept.rows[0].status === 'rejected', 'the rejected batch is preserved')
    assert(kept.rows[0].rejection_reason === 'Tiers were miscalculated', 'the reason is kept')

    const ledger = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_type = 'season'`,
    )
    assert(ledger.rows[0].n === 0, 'a rejected batch applies nothing')

    const nextId = await openSeason('Season 2027', '2027-01-01', '2027-12-31')
    const active = await db.query(
      `select count(*)::int as n from public.seasons where status = 'active' and id = '${nextId}'`,
    )
    assert(active.rows[0].n === 1, 'a pending or rejected batch never blocks the next season')
  })
})

/** Inserts a closed previous season with one earned ranking, for S10/S23. */
async function seedPreviousRanking(label, starts, ends, playerId, position) {
  await actAs('postgres')
  const created = await db.query(`
    insert into public.seasons (label, starts_on, ends_on, status, started_at, closed_at)
    values ('${label}', '${starts}', '${ends}', 'closed', '${starts}T00:00:00Z', '${ends}T23:59:59Z')
    returning id
  `)
  const seasonId = created.rows[0].id
  await db.query(`
    insert into public.season_player_results
      (season_id, player_id, position, seasonal_sp, current_sp)
    values ('${seasonId}', '${playerId}', ${position}, 500, 1000)
  `)
  return seasonId
}

await test('S18: tournament wins and score difference break a Seasonal SP tie', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await ensureTournamentAccounts([P1, P4])
    const seasonId = await openSeason()
    await playTournamentMatch({ homePlayers: [P1], awayPlayers: [P4], homeWins: true })

    await actAs('postgres')
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values ('${seasonId}', '${P1}', 100), ('${seasonId}', '${P4}', 100)
      on conflict (season_id, player_id) do update set seasonal_sp = excluded.seasonal_sp
    `)

    const standings = await db.query(
      `select * from public.seasonal_standings('${seasonId}') order by position`,
    )
    const byPlayer = Object.fromEntries(standings.rows.map((row) => [row.player_id, row]))

    assert(byPlayer[P1].position === 1, 'the winner ranks first on tournament wins')
    assert(byPlayer[P4].position === 2, 'the loser ranks second')
    assert(byPlayer[P1].tournament_matches === 1, 'the tournament match is counted')
    assert(byPlayer[P1].tournament_wins === 1, 'the winner gets the tournament win')
    assert(byPlayer[P4].tournament_wins === 0, 'the loser gets no tournament win')
    assert(byPlayer[P1].game_difference === 2, 'two games won and none lost')
    assert(byPlayer[P4].game_difference === -2, 'two games lost and none won')
    assert(byPlayer[P1].point_difference === 20, 'the winner has the point difference')
    assert(byPlayer[P4].point_difference === -20, 'the loser has the opposite difference')
  })
})

await test('S18: friendlies feed Seasonal SP but never the tie-break', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    const seasonId = await openSeason()

    await actAs('postgres')
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values ('${seasonId}', '${P1}', 50), ('${seasonId}', '${P4}', 50)
    `)
    await confirmFriendly(P1, P4, P1)

    const standings = await db.query(`select * from public.seasonal_standings('${seasonId}')`)
    const byPlayer = Object.fromEntries(standings.rows.map((row) => [row.player_id, row]))

    assert(byPlayer[P1].position === 1 && byPlayer[P4].position === 1, 'the tie is shared')
    assert(byPlayer[P1].matches_played === 1, 'the friendly counts for eligibility')
    assert(byPlayer[P1].tournament_matches === 0, 'the friendly is not tournament evidence')
    assert(byPlayer[P1].tournament_wins === 0, 'the friendly win is not a tie-break win')
    assert(byPlayer[P1].game_difference === 0, 'a friendly has no game difference')
    assert(byPlayer[P1].point_difference === 0, 'a friendly has no point difference')
  })
})

await test('S10/S16/S23: zero matches keeps the last earned ranking; a first-timer is unranked', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await ensureTournamentAccounts([P5, P6])
    await linkActivePlayer(P5, '88888888-8888-4888-8888-888888888888', 'Eli Male')
    await linkActivePlayer(P6, '99999999-9999-4999-8999-999999999999', 'Fay Unknown')
    await seedPreviousRanking('Season 2025', '2025-01-01', '2025-12-31', P1, 2)

    const seasonId = await openSeason()

    await actAs('postgres')
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values ('${seasonId}', '${P4}', 100)
    `)
    await confirmFriendly(P4, P5, P4)

    const standings = await db.query(`select * from public.seasonal_standings('${seasonId}')`)
    const byPlayer = Object.fromEntries(standings.rows.map((row) => [row.player_id, row]))

    const rankings = await db.query(
      `select player_id, deduction_position, previous_position
         from public.season_rankings('${seasonId}')`,
    )
    const rankByPlayer = Object.fromEntries(rankings.rows.map((row) => [row.player_id, row]))

    assert(byPlayer[P1].position === 2, 'the zero-match player keeps the previous rank')
    assert(byPlayer[P1].excluded_reason === null, 'the previous rank is not an exclusion')
    assert(byPlayer[P1].matches_played === 0, 'the player has no eligible match')
    assert(byPlayer[P4].position === 1, 'the player with a match ranks on Seasonal SP')
    assert(byPlayer[P5].position === 2, 'zero SP with a match is ranked')
    assert(
      rankByPlayer[P5].deduction_position === null,
      'zero SP with no previous rank is not deducted (S11)',
    )
    assert(
      rankByPlayer[P1].deduction_position === 2,
      'the previous ranking is the deduction position (S10)',
    )
    assert(byPlayer[P6].position === null, 'zero matches and no previous rank is unranked')
    assert(
      byPlayer[P6].excluded_reason === 'no_eligible_matches',
      'the unranked reason is recorded (S16)',
    )
  })
})

await test('S11/S17: a negative balance is deducted at its previous tier; status excludes the rest', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    await ensureTournamentAccounts([P5, P6])
    await linkActivePlayer(P5, '88888888-8888-4888-8888-888888888888', 'Eli Male')
    await linkActivePlayer(P6, '99999999-9999-4999-8999-999999999999', 'Fay Unknown')
    await seedPreviousRanking('Season 2025', '2025-01-01', '2025-12-31', P1, 3)

    const seasonId = await openSeason()

    await actAs('postgres')
    await db.query(`update public.players set status = 'inactive' where id = '${P4}'`)
    await db.query(`update public.players set profile_id = null where id = '${P6}'`)
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values
        ('${seasonId}', '${P1}', -10),
        ('${seasonId}', '${P4}', 100),
        ('${seasonId}', '${P6}', 200)
    `)
    await confirmFriendly(P1, P5, P5)

    const standings = await db.query(`select * from public.seasonal_standings('${seasonId}')`)
    const byPlayer = Object.fromEntries(standings.rows.map((row) => [row.player_id, row]))

    const rankings = await db.query(
      `select player_id, deduction_position from public.season_rankings('${seasonId}')`,
    )
    const rankByPlayer = Object.fromEntries(rankings.rows.map((row) => [row.player_id, row]))

    assert(byPlayer[P1].position === null, 'a negative balance has no displayed position')
    assert(
      byPlayer[P1].excluded_reason === 'negative_seasonal_sp',
      'the negative balance is the exclusion reason',
    )
    assert(
      rankByPlayer[P1].deduction_position === 3,
      'the previous ranking decides the deduction tier (S11)',
    )
    assert(
      byPlayer[P4].excluded_reason === 'inactive_or_unlinked',
      'an inactive player is excluded (S17)',
    )
    assert(
      rankByPlayer[P4].deduction_position === null,
      'an inactive player is not deducted',
    )
    assert(
      byPlayer[P6].excluded_reason === 'inactive_or_unlinked',
      'an unlinked player is excluded (S17)',
    )
    assert(
      rankByPlayer[P6].deduction_position === null,
      'an unlinked player is not deducted',
    )

    await actAs('authenticated', C)
    const closed = await db.query(`select public.close_season('${seasonId}') as result`)
    await actAs('postgres')
    const entries = await db.query(
      `select player_id, position, tier, proposed_amount
         from public.season_deduction_entries
        where batch_id = '${closed.rows[0].result.batch_id}'`,
    )
    assert(entries.rows.length === 1, 'only the previously ranked negative player is charged')
    assert(entries.rows[0].player_id === P1, 'the charged player is the negative one')
    assert(entries.rows[0].position === 3, 'the tier comes from the previous position')
    assert(entries.rows[0].tier === 1 && entries.rows[0].proposed_amount === 40, 'tier 1 is 40 SP')
  })
})

await test('S6: a result finalized after the cutoff accrues no Seasonal SP', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    const seasonId = await openSeason()

    await confirmFriendly(P1, P4, P1, '2027-01-01T00:30:00+08:00')
    await actAs('postgres')
    const match = await db.query(
      `select id from public.friendly_matches order by created_at desc limit 1`,
    )
    const award = await db.query(
      `select public.award_friendly_sp('${match.rows[0].id}') as result`,
    )

    assert(award.rows[0].result.status === 'awarded', 'Current SP is still processed')
    assert(award.rows[0].result.season_id === null, 'no season contains the late finalization')

    const balances = await db.query(
      `select count(*)::int as n from public.season_balances where season_id = '${seasonId}'`,
    )
    assert(balances.rows[0].n === 0, 'the closed season gains no Seasonal SP')

    const ledger = await db.query(
      `select count(*)::int as n from public.sp_transactions where reference_id = '${match.rows[0].id}'`,
    )
    assert(ledger.rows[0].n === 2, 'both Current SP rows are still written')
  })
})

await test('S7: correcting a closed-season result never moves Seasonal SP', async () => {
  await inTransaction(async () => {
    await ensureTournamentAccounts([P1, P4])
    const seasonId = await openSeason()
    const { matchId } = await playTournamentMatch({
      homePlayers: [P1],
      awayPlayers: [P4],
      homeWins: true,
    })

    await actAs('postgres')
    const before = await db.query(
      `select player_id, seasonal_sp from public.season_balances
        where season_id = '${seasonId}' order by player_id`,
    )
    const finalized = await db.query(
      `select finalized_at from public.matches where id = '${matchId}'`,
    )

    await actAs('authenticated', C)
    await db.query(`select public.close_season('${seasonId}')`)

    await actAs('authenticated', D)
    const games = [
      { game_number: 1, home_points: 10, away_points: 21 },
      { game_number: 2, home_points: 12, away_points: 21 },
    ]
    const corrected = await db.query(`
      select public.correct_match_result(
        '${matchId}',
        '${JSON.stringify(games)}'::jsonb,
        'the winner was recorded backwards'
      ) as result
    `)

    assert(corrected.rows[0].result.sp_reversal.status === 'reversed', 'the award is reversed')
    assert(corrected.rows[0].result.sp_award.status === 'awarded', 'the result is re-awarded')
    assert(corrected.rows[0].result.sp_award.season_id === null, 'the closed season is not reopened')

    await actAs('postgres')
    const after = await db.query(
      `select player_id, seasonal_sp from public.season_balances
        where season_id = '${seasonId}' order by player_id`,
    )
    assert(
      JSON.stringify(after.rows) === JSON.stringify(before.rows),
      'the closed season Seasonal SP is unchanged',
    )

    const otherSeasons = await db.query(
      `select count(*)::int as n from public.season_balances where season_id <> '${seasonId}'`,
    )
    assert(otherSeasons.rows[0].n === 0, 'nothing is transferred to another season')

    const stillFinalized = await db.query(
      `select finalized_at from public.matches where id = '${matchId}'`,
    )
    assert(
      new Date(stillFinalized.rows[0].finalized_at).getTime() ===
        new Date(finalized.rows[0].finalized_at).getTime(),
      'a correction preserves the original finalization time',
    )
  })
})

await test('S15/S19: the seasonal leaderboard is provisional live and final after close', async () => {
  await inTransaction(async () => {
    await ensureFriendlyAccounts()
    const seasonId = await openSeason()

    await actAs('postgres')
    await db.query(`
      insert into public.season_balances (season_id, player_id, seasonal_sp)
      values ('${seasonId}', '${P1}', 100)
    `)
    await confirmFriendly(P1, P4, P1)

    const live = await db.query(`select * from public.seasonal_standings('${seasonId}')`)
    assert(live.rows.length >= 2, 'the live table lists the eligible players')
    assert(live.rows.every((row) => row.provisional === true), 'the live table is provisional')
    assert(
      live.rows.find((row) => row.player_id === P1).position === 1,
      'the live leader is ranked first',
    )

    await actAs('authenticated', C)
    await db.query(`select public.close_season('${seasonId}')`)

    const final = await db.query(`select * from public.seasonal_standings('${seasonId}')`)
    assert(final.rows.every((row) => row.provisional === false), 'the final table is frozen')
    assert(
      final.rows.find((row) => row.player_id === P1).position === 1,
      'the snapshot keeps the final position',
    )
  })
})

await test('S20: the transition closes the old season and starts the new one idempotently', async () => {
  await inTransaction(async () => {
    const oldId = await openSeason('Season 2025', '2025-01-01', '2025-12-31')

    await actAs('postgres')
    await db.exec(`set local request.jwt.claim.sub = ''`)
    const first = await db.query(`select public.run_season_transition() as result`)
    const result = first.rows[0].result

    assert(result.status === 'completed', `expected completed, got ${JSON.stringify(result)}`)
    assert(result.season_id === oldId, 'the ended season closes')
    assert(result.new_season_id, 'the next season starts')

    const seasons = await db.query(`select id, status from public.seasons`)
    const byId = Object.fromEntries(seasons.rows.map((row) => [row.id, row]))
    assert(byId[oldId].status === 'closed', 'the old season is closed')
    assert(byId[result.new_season_id].status === 'active', 'the new season is active')

    const transition = await db.query(
      `select status, attempts, completed_at from public.season_transitions
        where season_id = '${oldId}'`,
    )
    assert(transition.rows[0].status === 'completed', 'the transition is completed')
    assert(transition.rows[0].completed_at !== null, 'the completion time is recorded')

    const steps = await db.query(
      `select step from public.season_transition_steps where season_id = '${oldId}'`,
    )
    const found = new Set(steps.rows.map((row) => row.step))
    for (const step of ['snapshot', 'deduction_batch', 'closed']) {
      assert(found.has(step), `the ${step} checkpoint is recorded`)
    }

    const replay = await db.query(`select public.run_season_transition() as result`)
    assert(replay.rows[0].result.status === 'idle', 'a replay is idle')
  })
})

await test('S20: repeated failure notifies Super Admins and a forced re-run recovers', async () => {
  await inTransaction(async () => {
    const oldId = await openSeason('Season 2025', '2025-01-01', '2025-12-31')

    await actAs('authenticated', C)
    // A conflicting label that does not cover today blocks the calendar season.
    await db.query(`select public.create_season('Season 2026', '2027-01-01', '2027-12-31')`)

    await actAs('postgres')
    await db.exec(`set local request.jwt.claim.sub = ''`)
    await db.query(`
      insert into public.season_transitions (season_id, status, attempts)
      values ('${oldId}', 'running', 4)
    `)

    const failed = await db.query(`select public.run_season_transition() as result`)
    assert(failed.rows[0].result.status === 'failed', 'the fifth attempt fails')
    assert(failed.rows[0].result.attempts === 5, 'the attempt is recorded')

    const transition = await db.query(
      `select status, attempts, last_error from public.season_transitions
        where season_id = '${oldId}'`,
    )
    assert(transition.rows[0].status === 'failed', 'the transition is marked failed')
    assert(transition.rows[0].last_error !== null, 'the error is preserved')

    const notification = await db.query(
      `select count(*)::int as n from public.notifications
        where profile_id = '${C}' and type = 'season_transition_failed'`,
    )
    assert(notification.rows[0].n === 1, 'the Super Admin is notified once')

    const blocked = await db.query(`select public.run_season_transition() as result`)
    assert(blocked.rows[0].result.status === 'failed', 'the retry limit blocks a plain re-run')
    assert(/retry limit/i.test(blocked.rows[0].result.reason), 'the retry limit is explained')

    await db.query(`delete from public.seasons where label = 'Season 2026'`)
    const recovered = await db.query(`select public.run_season_transition(true) as result`)
    assert(recovered.rows[0].result.status === 'completed', 'a forced re-run recovers')

    const completed = await db.query(
      `select status, attempts from public.season_transitions where season_id = '${oldId}'`,
    )
    assert(completed.rows[0].status === 'completed', 'the transition is completed')
    assert(completed.rows[0].attempts > 5, 'the recovery attempt is recorded')
  })
})

await test('N10: auto-approval waits for the 24-hour deadline and is idempotent', async () => {
  await inTransaction(async () => {
    await disableEnabledRules()
    await db.query(`update public.players set profile_id = '${D}' where id = '${P4}'`)
    const rivalId = P4
    const rivalProfile = D

    await actAs('authenticated', A)
    const created = await db.query(
      `select public.create_friendly_challenge('${rivalId}', null) as result`,
    )
    const matchId = created.rows[0].result.id
    await actAs('authenticated', rivalProfile)
    await db.query(`select public.respond_friendly_challenge('${matchId}', true)`)
    await actAs('authenticated', A)
    await db.query(`select public.submit_friendly_result('${matchId}', '${P1}')`)

    await actAs('postgres')
    // Clear the JWT claim: the cron session has no user, so the job runs.
    await db.exec(`set local request.jwt.claim.sub = ''`)
    const early = await db.query(`select public.auto_approve_friendly_matches() as result`)
    assert(early.rows[0].result === 0, 'nothing is approved before the 24-hour deadline')

    const due = await db.query(
      `select auto_approval_due_at > now() + interval '23 hours' as not_due
         from public.friendly_matches where id = '${matchId}'`,
    )
    assert(due.rows[0].not_due === true, 'the deadline is roughly 24 hours away')

    await db.query(
      `update public.friendly_matches
          set auto_approval_due_at = now() - interval '1 minute'
        where id = '${matchId}'`,
    )

    const approved = await db.query(`select public.auto_approve_friendly_matches() as result`)
    assert(approved.rows[0].result === 1, 'the overdue result is approved once')

    const replay = await db.query(`select public.auto_approve_friendly_matches() as result`)
    assert(replay.rows[0].result === 0, 'replaying the job approves nothing twice')

    const stored = await db.query(
      `select status, confirmed_at from public.friendly_matches where id = '${matchId}'`,
    )
    assert(stored.rows[0].status === 'auto_approved', 'the match is auto-approved')
    assert(stored.rows[0].confirmed_at !== null, 'auto-approval stamps a server time')

    const audit = await db.query(
      `select count(*)::int as total from public.audit_logs
        where action = 'friendly.result.auto_approved' and target_id = '${matchId}'`,
    )
    assert(audit.rows[0].total === 1, 'the automatic approval is audited')

    await actAs('authenticated', A)
    await expectQueryError(`select public.auto_approve_friendly_matches()`, /not authorized/i)
  })
})

await test('N10: only participants and Super Admins read a friendly match', async () => {
  await inTransaction(async () => {
    await actAs('postgres')
    await db.query(`update public.players set profile_id = '${D}' where id = '${P4}'`)
    const rivalId = P4
    const rivalProfile = D

    await actAs('authenticated', A)
    await db.query(`select public.create_friendly_challenge('${rivalId}', null)`)

    await actAs('authenticated', A)
    assert(
      (await db.query(`select id from public.friendly_matches`)).rows.length === 1,
      'challenger sees it',
    )

    await actAs('authenticated', rivalProfile)
    assert(
      (await db.query(`select id from public.friendly_matches`)).rows.length === 1,
      'opponent sees it',
    )

    await actAs('authenticated', B)
    const outsider = await db.query(`select id from public.friendly_matches`)
    assert(
      outsider.rows.length === 0,
      `an unrelated member sees no friendly matches (saw ${outsider.rows.length})`,
    )

    await actAs('authenticated', C)
    const admin = await db.query(`select id from public.friendly_matches`)
    assert(admin.rows.length === 1, 'a Super Admin can review club matches')
  })
})

await test('N10: anon cannot read friendly matches or call their RPCs', async () => {
  await expectError(
    'anon friendly matches',
    () => asRole('anon', `select id from public.friendly_matches`),
    /permission denied/i,
  )
  await expectError(
    'anon challenge',
    () => asRole('anon', `select public.create_friendly_challenge('${P1}', null)`),
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
// Player IDs, friends, notifications, and tournament registration
// ---------------------------------------------------------------------------

/** Links an existing player record to an account, as approval would. */
async function linkPlayerToProfile(playerId, profileId) {
  await actAs('postgres')
  await db.query(`update public.players set profile_id = '${profileId}' where id = '${playerId}'`)
}

async function createFeeTournament(name, fee) {
  await actAs('authenticated', D)
  const { rows } = await db.query(
    `select public.create_tournament('${name}', '2026-11-01', '2026-11-02', null, null, null, ${fee}) as result`,
  )
  return rows[0].result
}

async function publishTournament(tournamentId) {
  await actAs('authenticated', D)
  return db.query(`select public.set_tournament_status('${tournamentId}', 'published') as result`)
}

await test('R1: every player gets a stable, unique, readable player ID', async () => {
  const { rows } = await db.query(`select id, player_code from public.players order by id`)
  assert(rows.length >= 7, 'the fixture players all get a code')

  const codes = new Set()
  for (const row of rows) {
    assert(/^MBC-[0-9A-F]{8}$/.test(row.player_code), `unexpected code ${row.player_code}`)
    codes.add(row.player_code)
  }

  assert(codes.size === rows.length, 'player codes are unique')

  const again = await db.query(`select player_code from public.players where id = '${P1}'`)
  assert(
    again.rows[0].player_code === rows.find((row) => row.id === P1).player_code,
    'the code is stable across reads',
  )
})

await test('R2: a friend request needs an active linked player and can be accepted', async () => {
  await inTransaction(async () => {
    await linkPlayerToProfile(P4, D)
    const { rows } = await db.query(`select player_code from public.players where id = '${P4}'`)
    const code = rows[0].player_code

    await actAs('authenticated', A)
    const sent = await db.query(`select public.send_player_friend_request('${code}') as result`)
    assert(sent.rows[0].result.status === 'pending', 'the request starts pending')
    assert(sent.rows[0].result.changed === true, 'the first request changes state')

    const repeat = await db.query(`select public.send_player_friend_request('${code}') as result`)
    assert(repeat.rows[0].result.changed === false, 'a repeat request is a no-op')
    assert(
      repeat.rows[0].result.friendship_id === sent.rows[0].result.friendship_id,
      'the same friendship row is returned',
    )

    await actAs('postgres')
    const notifications = await db.query(
      `select type, link_path from public.notifications
        where profile_id = '${D}' and type = 'friend_request'`,
    )
    assert(notifications.rows.length === 1, 'the recipient is notified once')

    await actAs('authenticated', B)
    assert(
      (await db.query(`select id from public.player_friendships`)).rows.length === 0,
      'an unrelated profile sees no friendships',
    )

    await actAs('authenticated', D)
    const visible = await db.query(`select id from public.player_friendships`)
    assert(visible.rows.length === 1, 'the addressee sees the request')

    const accepted = await db.query(
      `select public.respond_player_friend_request('${sent.rows[0].result.friendship_id}', true) as result`,
    )
    assert(accepted.rows[0].result.status === 'accepted', 'the request is accepted')

    await actAs('authenticated', A)
    const again = await db.query(`select public.send_player_friend_request('${code}') as result`)
    assert(again.rows[0].result.already_friends === true, 're-sending recognises the friendship')

    await actAs('postgres')
    const acceptedNotice = await db.query(
      `select type from public.notifications
        where profile_id = '${A}' and type = 'friend_request_accepted'`,
    )
    assert(acceptedNotice.rows.length === 1, 'the requester learns the request was accepted')
    assert(
      (await db.query(`select public.is_friend('${P1}', '${P4}') as friends`)).rows[0].friends ===
        true,
      'the pair is a friend pair',
    )
  })
})

await test('R3: a declined request creates no friendship and can be retried', async () => {
  await inTransaction(async () => {
    await linkPlayerToProfile(P4, D)
    const { rows } = await db.query(`select player_code from public.players where id = '${P4}'`)

    await actAs('authenticated', A)
    const sent = await db.query(
      `select public.send_player_friend_request('${rows[0].player_code}') as result`,
    )

    await actAs('authenticated', D)
    const declined = await db.query(
      `select public.respond_player_friend_request('${sent.rows[0].result.friendship_id}', false) as result`,
    )
    assert(declined.rows[0].result.status === 'declined', 'the request is declined')

    await actAs('postgres')
    assert(
      (await db.query(`select public.is_friend('${P1}', '${P4}') as friends`)).rows[0].friends ===
        false,
      'a decline does not create a friendship',
    )

    await actAs('authenticated', A)
    const retried = await db.query(
      `select public.send_player_friend_request('${rows[0].player_code}') as result`,
    )
    assert(retried.rows[0].result.status === 'pending', 'a declined request can be sent again')
    assert(retried.rows[0].result.changed === true, 'the retry changes state')
  })
})

await test('R4: a member reads and clears only their own notifications', async () => {
  await inTransaction(async () => {
    await linkPlayerToProfile(P4, D)
    const { rows } = await db.query(`select player_code from public.players where id = '${P4}'`)

    await actAs('authenticated', A)
    const sent = await db.query(
      `select public.send_player_friend_request('${rows[0].player_code}') as result`,
    )

    await actAs('postgres')
    const target = await db.query(
      `select id from public.notifications
        where profile_id = '${D}' and type = 'friend_request'`,
    )
    const targetId = target.rows[0].id

    await actAs('authenticated', A)
    const cross = await db.query(`select public.mark_notification_read('${targetId}') as result`)
    assert(cross.rows[0].result.changed === false, 'another member cannot mark it read')

    await actAs('authenticated', D)
    const own = await db.query(`select id from public.notifications where read_at is null limit 1`)
    assert(own.rows.length === 1, 'the recipient sees the unread row')
    const marked = await db.query(
      `select public.mark_notification_read('${own.rows[0].id}') as result`,
    )
    assert(marked.rows[0].result.changed === true, 'the recipient marks it read')

    await actAs('postgres')
    await db.query(
      `insert into public.notifications (profile_id, type, title)
       values ('${D}', 'friend_request', 'Another notice')`,
    )

    await actAs('authenticated', D)
    const cleared = await db.query(`select public.mark_all_notifications_read() as result`)
    assert(cleared.rows[0].result.marked === 1, 'mark-all clears the remaining unread row')
    assert(
      (await db.query(`select id from public.notifications where read_at is null`)).rows.length ===
        0,
      'nothing is left unread for the recipient',
    )

    await actAs('authenticated', A)
    assert(
      (await db.query(`select id from public.notifications`)).rows.length === 0,
      'another member sees none of those notifications',
    )
  })
})

await test('T1: an unpaid entry blocks the draw until staff mark every player paid', async () => {
  await inTransaction(async () => {
    const tournament = await createFeeTournament('Paid Cup', 100)
    const event = await createEvent(tournament.id, 'singles', 'single_elimination', 8)
    await publishTournament(tournament.id)

    await actAs('authenticated', A)
    const joined = await db.query(`select public.join_tournament_event('${event.id}') as result`)
    assert(joined.rows[0].result.payment_status === 'unpaid', 'a paid tournament starts unpaid')
    const playerEntry = joined.rows[0].result.entry_id

    await actAs('authenticated', D)
    const p3Entry = (await registerEntry(event.id, [P3])).rows[0].result.entry_id
    await registerEntry(event.id, [P5])

    await actAs('postgres')
    const payments = await db.query(
      `select id, player_id, status from public.tournament_entry_payments
        where entry_id = '${playerEntry}'`,
    )
    assert(
      payments.rows.length === 1 && payments.rows[0].status === 'unpaid',
      'self-entry creates one unpaid row',
    )

    await actAs('authenticated', D)
    await expectQueryError(
      `select public.save_tournament_draw('${event.id}', '[{"key":"m1","bracket":"winners","round":1,"position":1,"home_entry_id":"${playerEntry}","away_entry_id":"${p3Entry}"}]'::jsonb, false)`,
      /at least two fully paid/i,
    )

    await actAs('postgres')
    const p3Payment = await db.query(
      `select id from public.tournament_entry_payments
        where entry_id = '${p3Entry}' and player_id = '${P3}'`,
    )

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.set_entry_payment('${payments.rows[0].id}', 'paid')`,
      /not authorized/i,
    )

    await actAs('authenticated', D)
    await db.query(`select public.set_entry_payment('${payments.rows[0].id}', 'paid')`)
    await db.query(`select public.set_entry_payment('${p3Payment.rows[0].id}', 'paid')`)

    const draw = await saveDraw(event.id, [
      {
        key: 'm1',
        bracket: 'winners',
        round: 1,
        position: 1,
        home_entry_id: playerEntry,
        away_entry_id: p3Entry,
      },
    ])
    assert(draw.entry_count === 2, 'only the two paid entries enter the draw')
    assert(draw.registered_count === 3, 'the unpaid entry stays registered but excluded')

    await actAs('postgres')
    const eligible = await db.query(
      `select public.entry_payment_complete('${playerEntry}') as complete`,
    )
    assert(eligible.rows[0].complete === true, 'a fully paid entry is draw-eligible')

    await actAs('authenticated', A)
    const ownPayments = await db.query(`select id from public.tournament_entry_payments`)
    assert(ownPayments.rows.length === 1, 'a player sees only their own payment row')

    await actAs('authenticated', B)
    assert(
      (await db.query(`select id from public.tournament_entry_payments`)).rows.length === 0,
      'an unrelated member sees no payment rows',
    )

    await actAs('authenticated', D)
    assert(
      (await db.query(`select id from public.tournament_entry_payments`)).rows.length === 3,
      'staff see every payment row',
    )

    await actAs('postgres')
    const notice = await db.query(
      `select type from public.notifications
        where profile_id = '${A}' and type = 'entry_payment_paid'`,
    )
    assert(notice.rows.length === 1, 'a confirmed payment notifies the player')
  })
})

await test('T2: a guest doubles partner is recorded without creating a player', async () => {
  await inTransaction(async () => {
    const tournament = await createFeeTournament('Guest Cup', 50)
    const event = await createEvent(tournament.id, 'mixed_doubles', 'single_elimination', 8)
    await publishTournament(tournament.id)

    await actAs('postgres')
    const before = await db.query(`select count(*)::int as n from public.players`)

    await actAs('authenticated', A)
    const joined = await db.query(
      `select public.join_tournament_event('${event.id}', null, 'Guest Partner') as result`,
    )
    assert(joined.rows[0].result.guest_name === 'Guest Partner', 'the guest is named on the entry')
    const entryId = joined.rows[0].result.entry_id

    await actAs('postgres')
    const after = await db.query(`select count(*)::int as n from public.players`)
    assert(after.rows[0].n === before.rows[0].n, 'no player record is created for a guest')

    const members = await db.query(
      `select tm.player_id, tm.guest_name, tm.guest_gender
         from public.team_members as tm
         join public.tournament_entries as en on en.team_id = tm.team_id
        where en.id = '${entryId}'
        order by tm.guest_name nulls first`,
    )
    assert(members.rows.length === 2, 'the doubles team has two members')
    assert(members.rows[0].player_id === P1, 'the signed-in player is the first member')
    assert(members.rows[1].guest_name === 'Guest Partner', 'the guest is the second member')
    assert(members.rows[1].guest_gender === 'female', 'mixed doubles infers the guest gender')

    const payments = await db.query(
      `select player_id, guest_name, amount, status
         from public.tournament_entry_payments
        where entry_id = '${entryId}'
        order by guest_name nulls first`,
    )
    assert(payments.rows.length === 2, 'both participants get a payment row')
    assert(
      Number(payments.rows[0].amount) === 50 && payments.rows[0].status === 'unpaid',
      'the player owes the fee',
    )
    assert(payments.rows[1].guest_name === 'Guest Partner', 'the guest also owes the fee')
  })
})

await test('T3: a partner invitation creates the entry only after acceptance', async () => {
  await inTransaction(async () => {
    await linkPlayerToProfile(P4, D)

    await actAs('postgres')
    await db.query(
      `insert into public.player_friendships (
         requester_player_id, addressee_player_id, status, responded_at
       ) values ('${P1}', '${P4}', 'accepted', now())`,
    )

    const tournament = await createFeeTournament('Partners Cup', 75)
    const event = await createEvent(tournament.id, 'mixed_doubles', 'single_elimination', 8)
    await publishTournament(tournament.id)

    await actAs('authenticated', A)
    const invited = await db.query(
      `select public.join_tournament_event('${event.id}', '${P4}') as result`,
    )
    assert(invited.rows[0].result.status === 'pending_partner', 'the invite is pending')
    const invitationId = invited.rows[0].result.invitation_id

    await actAs('postgres')
    const entriesBefore = await db.query(
      `select count(*)::int as n from public.tournament_entries where event_id = '${event.id}'`,
    )
    assert(entriesBefore.rows[0].n === 0, 'no entry exists before the partner accepts')

    const invitedNotice = await db.query(
      `select type from public.notifications
        where profile_id = '${D}' and type = 'partner_invitation'`,
    )
    assert(invitedNotice.rows.length === 1, 'the partner is notified')

    await actAs('authenticated', D)
    const accepted = await db.query(
      `select public.respond_tournament_partner_invitation('${invitationId}', true) as result`,
    )
    assert(accepted.rows[0].result.status === 'accepted', 'the partner accepts')
    const entryId = accepted.rows[0].result.entry_id
    assert(entryId, 'an entry is created on acceptance')

    await actAs('postgres')
    const payments = await db.query(
      `select player_id, amount, status from public.tournament_entry_payments
        where entry_id = '${entryId}'
        order by player_id`,
    )
    assert(payments.rows.length === 2, 'both partners owe the entrance fee')
    assert(
      payments.rows.every((row) => row.status === 'unpaid' && Number(row.amount) === 75),
      'the fee is snapshotted onto both payment rows',
    )

    const acceptedNotice = await db.query(
      `select type from public.notifications
        where profile_id = '${A}' and type = 'partner_invitation_accepted'`,
    )
    assert(acceptedNotice.rows.length === 1, 'the inviter is notified')

    await actAs('authenticated', D)
    const replay = await db.query(
      `select public.respond_tournament_partner_invitation('${invitationId}', true) as result`,
    )
    assert(replay.rows[0].result.changed === false, 'answering twice is a no-op')
    assert(
      (
        await db.query(
          `select count(*)::int as n from public.tournament_entries where event_id = '${event.id}'`,
        )
      ).rows[0].n === 1,
      'no duplicate entry is created',
    )
  })
})

await test('T4: cancelling or declining an invitation creates no entry', async () => {
  await inTransaction(async () => {
    await linkPlayerToProfile(P4, D)

    await actAs('postgres')
    await db.query(
      `insert into public.player_friendships (
         requester_player_id, addressee_player_id, status, responded_at
       ) values ('${P1}', '${P4}', 'accepted', now())`,
    )

    const cancelledTournament = await createFeeTournament('Invitation Cup', 0)
    const cancelledEvent = await createEvent(
      cancelledTournament.id,
      'mixed_doubles',
      'single_elimination',
      8,
    )
    await publishTournament(cancelledTournament.id)

    const declinedTournament = await createFeeTournament('Second Invitation Cup', 0)
    const declinedEvent = await createEvent(
      declinedTournament.id,
      'mixed_doubles',
      'round_robin',
      8,
    )
    await publishTournament(declinedTournament.id)

    await actAs('authenticated', A)
    const first = await db.query(
      `select public.join_tournament_event('${cancelledEvent.id}', '${P4}') as result`,
    )
    const cancelled = await db.query(
      `select public.cancel_tournament_partner_invitation('${first.rows[0].result.invitation_id}') as result`,
    )
    assert(cancelled.rows[0].result.status === 'cancelled', 'the inviter can cancel')

    const second = await db.query(
      `select public.join_tournament_event('${declinedEvent.id}', '${P4}') as result`,
    )

    await actAs('authenticated', D)
    const declined = await db.query(
      `select public.respond_tournament_partner_invitation('${second.rows[0].result.invitation_id}', false) as result`,
    )
    assert(declined.rows[0].result.status === 'declined', 'the partner can decline')

    await actAs('postgres')
    const entries = await db.query(
      `select count(*)::int as n from public.tournament_entries
        where event_id in ('${cancelledEvent.id}', '${declinedEvent.id}')`,
    )
    assert(entries.rows[0].n === 0, 'neither outcome creates an entry')
  })
})

await test('T5: publishing notifies active club members once, drafts notify nobody', async () => {
  await inTransaction(async () => {
    const tournament = await createFeeTournament('Notice Cup', 0)
    await createEvent(tournament.id, 'singles', 'single_elimination', 8)

    await actAs('postgres')
    const before = await db.query(
      `select count(*)::int as n from public.notifications
        where type = 'tournament_published'`,
    )

    await publishTournament(tournament.id)

    await actAs('postgres')
    const published = await db.query(
      `select profile_id, title, link_path from public.notifications
        where type = 'tournament_published' and tournament_id = '${tournament.id}'
        order by profile_id`,
    )
    const newRows = published.rows.length
    assert(before.rows[0].n === 0, 'the fixture starts with no publish notices')
    assert(newRows === 2, `expected two active members to be notified, got ${newRows}`)
    assert(
      published.rows.every((row) => row.profile_id !== D),
      'the actor is not notified',
    )
    assert(
      published.rows.every((row) => row.link_path === `/tournaments/${tournament.id}`),
      'the notification links to the tournament',
    )
    assert(
      published.rows.every((row) => row.title.includes('Notice Cup')),
      'the title names the tournament',
    )

    await actAs('authenticated', D)
    await db.query(`select public.set_tournament_status('${tournament.id}', 'archived')`)

    await actAs('postgres')
    const afterArchive = await db.query(
      `select count(*)::int as n from public.notifications
        where type = 'tournament_published' and tournament_id = '${tournament.id}'`,
    )
    assert(afterArchive.rows[0].n === newRows, 'later status changes send no duplicate notice')
  })
})

// ---------------------------------------------------------------------------
// Payment receipts (migration 015)
// ---------------------------------------------------------------------------
const RECEIPT_A_PNG = `receipts/training/${A}/00000000-0000-4000-8000-000000000001.png`
const RECEIPT_A_PDF = `receipts/tournament/${A}/00000000-0000-4000-8000-000000000002.pdf`
const RECEIPT_A_JPG = `receipts/jersey/${A}/00000000-0000-4000-8000-000000000003.jpg`

await test('W1: a training receipt stays pending until staff approve it', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const period = await db.query(
      `select public.create_training_fee_period('Receipt Test', '2026-11-01', '2026-11-30', 500, null) as result`,
    )
    const periodId = period.rows[0].result.id

    await actAs('authenticated', A)
    const submitted = await db.query(
      `select public.submit_payment_receipt(
        'training', '${periodId}', 500, 'gcash', 'GCASH-REF-1', '2026-11-02', '${RECEIPT_A_PNG}'
      ) as result`,
    )
    const receiptId = submitted.rows[0].result.receipt_id
    assert(submitted.rows[0].result.status === 'pending', 'a new receipt starts pending')

    await actAs('postgres')
    assert(
      (await db.query(`select count(*)::int as n from public.training_payments`)).rows[0].n === 0,
      'a pending receipt records no money',
    )

    await actAs('authenticated', A)
    assert(
      (await db.query(`select id from public.payment_receipts`)).rows.length === 1,
      'the submitter sees their receipt',
    )

    await actAs('authenticated', D)
    assert(
      (await db.query(`select id from public.payment_receipts`)).rows.length === 0,
      'a tournament manager cannot read training receipts',
    )

    await actAs('authenticated', C)
    const reviewed = await db.query(
      `select public.review_payment_receipt('${receiptId}', true, 'GCash reference verified') as result`,
    )
    assert(reviewed.rows[0].result.status === 'approved', 'staff approve the receipt')

    await actAs('postgres')
    const payments = await db.query(
      `select amount, method, status, recorded_by from public.training_payments
        where fee_period_id = '${periodId}' and player_id = '${P1}'`,
    )
    assert(payments.rows.length === 1, 'approval records exactly one payment')
    assert(Number(payments.rows[0].amount) === 500, 'the approved amount is recorded')
    assert(payments.rows[0].method === 'gcash', 'the submitted method is kept')
    assert(payments.rows[0].status === 'recorded', 'the payment counts immediately')
    assert(payments.rows[0].recorded_by === C, 'the reviewer is the recorded_by')

    const notice = await db.query(
      `select type from public.notifications
        where profile_id = '${A}' and type = 'payment_receipt_approved'`,
    )
    assert(notice.rows.length === 1, 'the submitter is notified')

    await actAs('authenticated', C)
    await expectQueryError(
      `select public.review_payment_receipt('${receiptId}', true, null)`,
      /already been reviewed/i,
    )
  })
})

await test('W2: a rejection needs a reason and never records money', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const period = await db.query(
      `select public.create_training_fee_period('Reject Test', '2026-11-01', '2026-11-30', 300, null) as result`,
    )
    const periodId = period.rows[0].result.id

    await actAs('authenticated', A)
    const submitted = await db.query(
      `select public.submit_payment_receipt(
        'training', '${periodId}', 100, 'gcash', null, '2026-11-02', '${RECEIPT_A_PNG}'
      ) as result`,
    )
    const receiptId = submitted.rows[0].result.receipt_id

    await actAs('authenticated', C)
    await expectQueryError(
      `select public.review_payment_receipt('${receiptId}', false, '')`,
      /reason/i,
    )
    const rejected = await db.query(
      `select public.review_payment_receipt('${receiptId}', false, 'The screenshot is unreadable') as result`,
    )
    assert(rejected.rows[0].result.status === 'rejected', 'staff can reject with a reason')

    await actAs('postgres')
    assert(
      (
        await db.query(
          `select count(*)::int as n from public.training_payments where fee_period_id = '${periodId}'`,
        )
      ).rows[0].n === 0,
      'a rejected receipt records no payment',
    )

    const notice = await db.query(
      `select type from public.notifications
        where profile_id = '${A}' and type = 'payment_receipt_rejected'`,
    )
    assert(notice.rows.length === 1, 'the submitter learns why it was rejected')
  })
})

await test('W3: an entrance-fee receipt must match and settles the participant', async () => {
  await inTransaction(async () => {
    const tournament = await createFeeTournament('Receipt Cup', 200)
    const event = await createEvent(tournament.id, 'singles', 'single_elimination', 8)
    await publishTournament(tournament.id)

    await actAs('authenticated', A)
    const joined = await db.query(`select public.join_tournament_event('${event.id}') as result`)
    const entryId = joined.rows[0].result.entry_id

    await actAs('postgres')
    const payment = await db.query(
      `select id, amount from public.tournament_entry_payments where entry_id = '${entryId}'`,
    )
    const paymentId = payment.rows[0].id

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.submit_payment_receipt(
        'tournament', '${paymentId}', 50, 'gcash', null, '2026-11-02', '${RECEIPT_A_PDF}'
      )`,
      /match the entrance fee/i,
    )

    const submitted = await db.query(
      `select public.submit_payment_receipt(
        'tournament', '${paymentId}', 200, 'gcash', 'GCASH-T-1', '2026-11-02', '${RECEIPT_A_PDF}'
      ) as result`,
    )
    const receiptId = submitted.rows[0].result.receipt_id

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.review_payment_receipt('${receiptId}', true, null)`,
      /not authorized/i,
    )

    await actAs('authenticated', D)
    const reviewed = await db.query(
      `select public.review_payment_receipt('${receiptId}', true, 'GCash confirmed') as result`,
    )
    assert(reviewed.rows[0].result.status === 'approved', 'tournament staff approve the fee')

    await actAs('postgres')
    const settled = await db.query(
      `select status from public.tournament_entry_payments where id = '${paymentId}'`,
    )
    assert(settled.rows[0].status === 'paid', 'approval marks the participant paid')
    assert(
      (await db.query(`select public.entry_payment_complete('${entryId}') as complete`)).rows[0]
        .complete === true,
      'the entry becomes draw-eligible',
    )

    const notice = await db.query(
      `select type from public.notifications
        where profile_id = '${A}' and type = 'entry_payment_paid'`,
    )
    assert(notice.rows.length >= 1, 'the participant is notified')
  })
})

await test('W4: a jersey receipt uses the order snapshot and settles the order', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const project = await db.query(
      `select public.create_jersey_project('Receipt Kit', null, 500, null) as result`,
    )
    const projectId = project.rows[0].result.id
    const design = await db.query(
      `select public.add_jersey_design('${projectId}', 'Home', null) as result`,
    )
    const size = await db.query(`select public.add_jersey_size('${projectId}', 'M') as result`)
    await db.query(`select public.set_jersey_project_status('${projectId}', 'open')`)

    await actAs('authenticated', A)
    await db.query(
      `select public.submit_jersey_order(
        '${projectId}', '${design.rows[0].result.id}', '${size.rows[0].result.id}', 2
      )`,
    )

    await actAs('postgres')
    const jerseyPayment = await db.query(
      `select p.id, p.amount, p.status
         from public.jersey_order_payments as p
         join public.jersey_orders as o on o.id = p.order_id
        where o.project_id = '${projectId}'`,
    )
    assert(jerseyPayment.rows.length === 1, 'an order creates one payment row')
    assert(Number(jerseyPayment.rows[0].amount) === 1000, 'the price and quantity are snapshotted')
    assert(jerseyPayment.rows[0].status === 'unpaid', 'the order starts unpaid')
    const paymentId = jerseyPayment.rows[0].id

    await actAs('authenticated', A)
    assert(
      (await db.query(`select id from public.jersey_order_payments`)).rows.length === 1,
      'the player sees their own jersey fee',
    )
    await expectQueryError(
      `select public.submit_payment_receipt(
        'jersey', '${paymentId}', 500, 'gcash', null, '2026-11-02', '${RECEIPT_A_JPG}'
      )`,
      /match the jersey total/i,
    )
    const submitted = await db.query(
      `select public.submit_payment_receipt(
        'jersey', '${paymentId}', 1000, 'gcash', 'GCASH-J-1', '2026-11-02', '${RECEIPT_A_JPG}'
      ) as result`,
    )

    await actAs('authenticated', D)
    assert(
      (await db.query(`select id from public.jersey_order_payments`)).rows.length === 0,
      'a tournament manager is not jersey staff',
    )

    await actAs('authenticated', C)
    await db.query(
      `select public.review_payment_receipt('${submitted.rows[0].result.receipt_id}', true, null)`,
    )

    await actAs('postgres')
    const paid = await db.query(
      `select status, marked_by from public.jersey_order_payments where id = '${paymentId}'`,
    )
    assert(paid.rows[0].status === 'paid', 'approval settles the jersey payment')
    assert(paid.rows[0].marked_by === C, 'the reviewer is recorded')
  })
})

await test('W5: only jersey staff can mark an order paid, and anon sees nothing', async () => {
  await inTransaction(async () => {
    await actAs('authenticated', C)
    const project = await db.query(
      `select public.create_jersey_project('Manual Kit', null, 250, null) as result`,
    )
    const projectId = project.rows[0].result.id
    const design = await db.query(
      `select public.add_jersey_design('${projectId}', 'Away', null) as result`,
    )
    const size = await db.query(`select public.add_jersey_size('${projectId}', 'S') as result`)
    await db.query(`select public.set_jersey_project_status('${projectId}', 'open')`)

    await actAs('authenticated', A)
    await db.query(
      `select public.submit_jersey_order(
        '${projectId}', '${design.rows[0].result.id}', '${size.rows[0].result.id}', 1
      )`,
    )

    await actAs('postgres')
    const payment = await db.query(
      `select p.id from public.jersey_order_payments as p
         join public.jersey_orders as o on o.id = p.order_id
        where o.project_id = '${projectId}'`,
    )
    const paymentId = payment.rows[0].id

    await actAs('authenticated', A)
    await expectQueryError(
      `select public.set_jersey_order_payment('${paymentId}', 'paid')`,
      /not authorized/i,
    )

    await actAs('authenticated', C)
    const marked = await db.query(
      `select public.set_jersey_order_payment('${paymentId}', 'paid', 'Cash at training') as result`,
    )
    assert(marked.rows[0].result.status === 'paid', 'training staff can settle it manually')
  })

  await expectError(
    'anon payment receipts',
    () => asRole('anon', `select id from public.payment_receipts`),
    /permission denied/i,
  )
  await expectError(
    'anon jersey payments',
    () => asRole('anon', `select id from public.jersey_order_payments`),
    /permission denied/i,
  )
  await expectErrorAs(
    A,
    `insert into public.payment_receipts (purpose) values ('training')`,
    /permission denied/i,
  )
})

// ---------------------------------------------------------------------------
await db.close()

console.log(`\n${passed} passed, ${failures.length} failed`)

if (failures.length > 0) {
  process.exitCode = 1
}
