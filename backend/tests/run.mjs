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

const [migration, spMigration, identityPolicies, operationPolicies, spPolicies] =
  await Promise.all([
    readFile(join(backendDir, 'migrations', '001_identity.sql'), 'utf8'),
    readFile(join(backendDir, 'migrations', '002_shuttlepower_bootstrap.sql'), 'utf8'),
    readFile(join(backendDir, 'policies', '001_identity.sql'), 'utf8'),
    readFile(join(backendDir, 'policies', '002_operations.sql'), 'utf8'),
    readFile(join(backendDir, 'policies', '003_shuttlepower.sql'), 'utf8'),
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
const RR1 = 'bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb'
const RR2 = 'cccccccc-1111-4111-8111-cccccccccccc'

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
    id uuid primary key,
    email text not null unique
  );

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
await db.exec(identityPolicies)
await db.exec(operationPolicies)
await db.exec(spPolicies)

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
  insert into auth.users (id, email) values
    ('${A}', 'alex@example.test'),
    ('${B}', 'bea@example.test'),
    ('${C}', 'cara@example.test'),
    ('${D}', 'dino@example.test'),
    ('${E}', 'eve@example.test'),
    ('${G}', 'gina@example.test'),
    ('${H}', 'hal@example.test');

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
      has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE') as profile_status_update,
      has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE') as profile_name_update,
      has_function_privilege('authenticated', 'public.has_role(uuid,text)', 'EXECUTE') as has_role_execute
  `)
  const row = rows[0]
  assert(row.user_roles_insert === false, 'authenticated must not insert user_roles')
  assert(row.audit_insert === false, 'authenticated must not insert audit_logs')
  assert(row.players_select === true, 'authenticated should read players')
  assert(row.profile_status_update === false, 'authenticated must not update profiles.status')
  assert(row.profile_name_update === true, 'authenticated should update profiles.full_name')
  assert(row.has_role_execute === true, 'authenticated should execute has_role')
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
  assert(member.rows.length === 1, `player should see 1 player, got ${member.rows.length}`)
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
await test('a user can create their own pending profile', async () => {
  const result = await asUser(
    G,
    `insert into public.profiles (id, full_name) values ($1, 'Gina New') returning status`,
    [G],
  )
  assert(result.rows[0].status === 'pending', 'new profile should default to pending')
})

await test('a user cannot create a profile for someone else', async () => {
  await expectErrorAs(
    G,
    `insert into public.profiles (id, full_name) values ('${B}', 'Impostor')`,
    /row-level security/i,
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
await db.close()

console.log(`\n${passed} passed, ${failures.length} failed`)

if (failures.length > 0) {
  process.exitCode = 1
}
