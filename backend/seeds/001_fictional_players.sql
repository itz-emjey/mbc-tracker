-- MBC Arena — development seed: fictional accounts, players, roles, and SP
--
-- Apply after migrations 001–003 and policies 001–004.
--
-- This file refuses to run unless the project is explicitly marked as a
-- development project. Mark it once, as the project owner, in the SQL Editor:
--
--   insert into public.app_settings (key, value)
--   values ('club.environment', '"development"'::jsonb)
--   on conflict (key) do update set value = excluded.value;
--
-- Then run this file. It is idempotent: fixed ids and ON CONFLICT DO NOTHING
-- mean a second run adds no player, role, request, or SP transaction, and
-- never overwrites a change a developer made through the app. Re-running also
-- repairs seeded auth rows whose GoTrue token columns are NULL, which would
-- otherwise make password sign-in fail with "Database error querying schema".
--
-- Every account, name, email, and password below is fictional. Addresses use
-- the reserved `example.test` domain, and all demo accounts share the
-- development-only password `mbc-demo-2026`.
--
-- Passwords are hashed with pgcrypto, which Supabase installs in the
-- `extensions` schema. If that schema is missing, enable the pgcrypto
-- extension in the dashboard first.

-- ---------------------------------------------------------------------------
-- Guard: only an explicitly-marked development project may be seeded.
-- ---------------------------------------------------------------------------
do $seed_guard$
declare
  v_environment text;
begin
  select s.value #>> '{}'
    into v_environment
    from public.app_settings as s
   where s.key = 'club.environment';

  if v_environment is distinct from 'development' then
    raise exception 'refusing to seed: this project is not marked as development'
      using errcode = '42501',
            hint = 'insert into public.app_settings (key, value) values (''club.environment'', ''"development"''::jsonb) on conflict (key) do update set value = excluded.value;';
  end if;
end
$seed_guard$;

-- ---------------------------------------------------------------------------
-- Demo accounts. Ada is the demo Super Admin; Erin is awaiting approval and
-- has no player record yet; Finn is suspended but keeps his history.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'ada.demo@example.test',
    extensions.crypt('mbc-demo-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ada Demo"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'ben.sample@example.test',
    extensions.crypt('mbc-demo-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Ben Sample"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'cleo.placeholder@example.test',
    extensions.crypt('mbc-demo-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Cleo Placeholder"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'drew.testcase@example.test',
    extensions.crypt('mbc-demo-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Drew Testcase"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'erin.pending@example.test',
    extensions.crypt('mbc-demo-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Erin Pending"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5eed0000-0000-4000-8000-000000000006',
    'authenticated',
    'authenticated',
    'finn.suspended@example.test',
    extensions.crypt('mbc-demo-2026', extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Finn Suspended"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do nothing;

-- GoTrue scans auth.users into non-nullable Go values. Its User model
-- (supabase/auth, internal/models/user.go) declares plain `string` fields for
-- confirmation_token, recovery_token, email_change, email_change_token_current,
-- email_change_token_new, phone_change, phone_change_token and
-- reauthentication_token; plain `bool` fields for is_sso_user and is_anonymous;
-- and a plain `int` for email_change_confirm_status. A NULL in any of them makes
-- password sign-in fail with `500 Database error querying schema`, which names
-- no column (supabase/auth#1940). A demo account can safely hold '', false, and
-- 0, so repair every NULL of those types rather than listing column names: the
-- names come from information_schema, so a column a later GoTrue version adds
-- or renames is covered too. Only columns carrying an *unconditional* unique
-- index are skipped, because several demo rows cannot share one empty value
-- (`auth.users.phone` has users_phone_key); GoTrue reads `phone` into a
-- NULL-safe value, so a NULL there is harmless. Supabase's token indexes
-- (confirmation_token_idx, recovery_token_idx, email_change_token_new_idx,
-- email_change_token_current_idx, reauthentication_token_idx) are partial -
-- `WHERE token !~ '^[0-9 ]*$'` - so '' is not indexed and cannot collide.
-- Those columns must still be repaired: skipping them was why the hosted 500
-- survived an earlier seed run. Re-running the seed is the repair path for rows
-- written by an earlier run.
do $seed_auth_repair$
declare
  v_column text;
  v_zero text;
begin
  -- String columns: '' is GoTrue's own "no pending token" value. Generated
  -- columns cannot be written, and columns under an unconditional unique index
  -- are excluded so the six demo rows cannot collide on the same empty value.
  -- Partial unique indexes (the token columns) accept '' and must be repaired.
  for v_column in
    select c.column_name
      from information_schema.columns as c
     where c.table_schema = 'auth'
       and c.table_name = 'users'
       and c.data_type in ('text', 'character varying')
       and c.is_generated = 'NEVER'
       and not exists (
         select 1
           from pg_index as i
           join pg_attribute as a
             on a.attrelid = i.indrelid
            and a.attnum = any (i.indkey)
          where i.indrelid = 'auth.users'::regclass
            and i.indisunique
            and i.indpred is null
            and a.attname = c.column_name
       )
     order by c.column_name
  loop
    -- A unique index this query could not predict (an expression index, say)
    -- must not abort the repair and leave every later column NULL.
    begin
      execute format(
        $sql$
          update auth.users
             set %1$I = ''
           where %1$I is null
             and id::text like '5eed0000-%%'
        $sql$,
        v_column
      );
    exception
      when unique_violation then
        raise notice
          'seed repair left auth.users.% NULL: a unique index rejects the shared empty value',
          v_column;
    end;
  end loop;

  -- The remaining non-nullable Go fields are booleans and one integer; the
  -- zero value is what GoTrue itself writes when it clears them.
  for v_column in
    select c.column_name
      from information_schema.columns as c
     where c.table_schema = 'auth'
       and c.table_name = 'users'
       and c.column_name in (
         'email_change_confirm_status',
         'is_anonymous',
         'is_sso_user'
       )
     order by c.column_name
  loop
    v_zero := case
                when v_column = 'email_change_confirm_status' then '0'
                else 'false'
              end;

    execute format(
      $sql$
        update auth.users
           set %1$I = %2$s
         where %1$I is null
           and id::text like '5eed0000-%%'
      $sql$,
      v_column,
      v_zero
    );
  end loop;
end
$seed_auth_repair$;

-- Email identities are what make password sign-in work in current GoTrue.
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values
  (
    '5eed0000-0000-4000-8000-000000000001',
    '5eed0000-0000-4000-8000-000000000001',
    jsonb_build_object(
      'sub', '5eed0000-0000-4000-8000-000000000001',
      'email', 'ada.demo@example.test',
      'email_verified', true
    ),
    'email',
    '5eed0000-0000-4000-8000-000000000001',
    now(), now(), now()
  ),
  (
    '5eed0000-0000-4000-8000-000000000002',
    '5eed0000-0000-4000-8000-000000000002',
    jsonb_build_object(
      'sub', '5eed0000-0000-4000-8000-000000000002',
      'email', 'ben.sample@example.test',
      'email_verified', true
    ),
    'email',
    '5eed0000-0000-4000-8000-000000000002',
    now(), now(), now()
  ),
  (
    '5eed0000-0000-4000-8000-000000000003',
    '5eed0000-0000-4000-8000-000000000003',
    jsonb_build_object(
      'sub', '5eed0000-0000-4000-8000-000000000003',
      'email', 'cleo.placeholder@example.test',
      'email_verified', true
    ),
    'email',
    '5eed0000-0000-4000-8000-000000000003',
    now(), now(), now()
  ),
  (
    '5eed0000-0000-4000-8000-000000000004',
    '5eed0000-0000-4000-8000-000000000004',
    jsonb_build_object(
      'sub', '5eed0000-0000-4000-8000-000000000004',
      'email', 'drew.testcase@example.test',
      'email_verified', true
    ),
    'email',
    '5eed0000-0000-4000-8000-000000000004',
    now(), now(), now()
  ),
  (
    '5eed0000-0000-4000-8000-000000000005',
    '5eed0000-0000-4000-8000-000000000005',
    jsonb_build_object(
      'sub', '5eed0000-0000-4000-8000-000000000005',
      'email', 'erin.pending@example.test',
      'email_verified', true
    ),
    'email',
    '5eed0000-0000-4000-8000-000000000005',
    now(), now(), now()
  ),
  (
    '5eed0000-0000-4000-8000-000000000006',
    '5eed0000-0000-4000-8000-000000000006',
    jsonb_build_object(
      'sub', '5eed0000-0000-4000-8000-000000000006',
      'email', 'finn.suspended@example.test',
      'email_verified', true
    ),
    'email',
    '5eed0000-0000-4000-8000-000000000006',
    now(), now(), now()
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Profiles: four approved, one pending, one suspended.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, status)
values
  ('5eed0000-0000-4000-8000-000000000001', 'Ada Demo', 'active'),
  ('5eed0000-0000-4000-8000-000000000002', 'Ben Sample', 'active'),
  ('5eed0000-0000-4000-8000-000000000003', 'Cleo Placeholder', 'active'),
  ('5eed0000-0000-4000-8000-000000000004', 'Drew Testcase', 'active'),
  ('5eed0000-0000-4000-8000-000000000005', 'Erin Pending', 'pending'),
  ('5eed0000-0000-4000-8000-000000000006', 'Finn Suspended', 'suspended')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Player records: every approved account, including the suspended one.
-- Erin has none, because a player record is created at approval.
-- ---------------------------------------------------------------------------
insert into public.players (id, profile_id, full_name, gender, status, joined_on)
values
  (
    '5eed1000-0000-4000-8000-000000000001',
    '5eed0000-0000-4000-8000-000000000001',
    'Ada Demo',
    'female',
    'active',
    date '2026-01-10'
  ),
  (
    '5eed1000-0000-4000-8000-000000000002',
    '5eed0000-0000-4000-8000-000000000002',
    'Ben Sample',
    'male',
    'active',
    date '2026-01-10'
  ),
  (
    '5eed1000-0000-4000-8000-000000000003',
    '5eed0000-0000-4000-8000-000000000003',
    'Cleo Placeholder',
    'female',
    'active',
    date '2026-01-17'
  ),
  (
    '5eed1000-0000-4000-8000-000000000004',
    '5eed0000-0000-4000-8000-000000000004',
    'Drew Testcase',
    'male',
    'active',
    date '2026-02-01'
  ),
  (
    '5eed1000-0000-4000-8000-000000000005',
    '5eed0000-0000-4000-8000-000000000006',
    'Finn Suspended',
    'male',
    'suspended',
    date '2026-02-01'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Role assignments: every role is represented exactly once, and the two
-- demo players keep their Player role.
-- ---------------------------------------------------------------------------
insert into public.user_roles (profile_id, role_id, granted_by)
select
  assignment.profile_id,
  role.id,
  assignment.granted_by
from (
  values
    ('5eed0000-0000-4000-8000-000000000001'::uuid, 'super_admin', null::uuid),
    ('5eed0000-0000-4000-8000-000000000002'::uuid, 'tournament_manager', '5eed0000-0000-4000-8000-000000000001'::uuid),
    ('5eed0000-0000-4000-8000-000000000003'::uuid, 'trainer', '5eed0000-0000-4000-8000-000000000001'::uuid),
    ('5eed0000-0000-4000-8000-000000000004'::uuid, 'player', '5eed0000-0000-4000-8000-000000000001'::uuid),
    ('5eed0000-0000-4000-8000-000000000006'::uuid, 'player', '5eed0000-0000-4000-8000-000000000001'::uuid)
) as assignment(profile_id, role_key, granted_by)
join public.roles as role on role.key = assignment.role_key
on conflict (profile_id, role_id) do nothing;

-- ---------------------------------------------------------------------------
-- Registration history: one request waiting for review, one approved long ago
-- (Finn, since suspended).
-- ---------------------------------------------------------------------------
insert into public.registration_requests (
  id,
  profile_id,
  email,
  full_name,
  status,
  requested_at,
  reviewed_at,
  reviewed_by,
  decision_note,
  linked_player_id
)
values
  (
    '5eed2000-0000-4000-8000-000000000001',
    '5eed0000-0000-4000-8000-000000000005',
    'erin.pending@example.test',
    'Erin Pending',
    'pending',
    now() - interval '2 days',
    null,
    null,
    null,
    null
  ),
  (
    '5eed2000-0000-4000-8000-000000000002',
    '5eed0000-0000-4000-8000-000000000006',
    'finn.suspended@example.test',
    'Finn Suspended',
    'approved',
    now() - interval '40 days',
    now() - interval '39 days',
    '5eed0000-0000-4000-8000-000000000001',
    null,
    '5eed1000-0000-4000-8000-000000000005'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Club settings. `club.environment` is deliberately not created here: the
-- guard above requires the owner to mark the project before seeding.
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description)
values
  ('club.name', '"Matag-ob Badminton Club"'::jsonb, 'Club display name used by the app shell.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Starting SP: the same internal RPC approval uses, so the demo ledger is
-- identical in shape to a real approval. The unique idempotency key makes a
-- second seed run a no-op.
-- ---------------------------------------------------------------------------
do $seed_sp$
declare
  v_player_id uuid;
begin
  for v_player_id in
    select p.id
      from public.players as p
     where p.id in (
       '5eed1000-0000-4000-8000-000000000001',
       '5eed1000-0000-4000-8000-000000000002',
       '5eed1000-0000-4000-8000-000000000003',
       '5eed1000-0000-4000-8000-000000000004',
       '5eed1000-0000-4000-8000-000000000005'
     )
     order by p.id
  loop
    perform public.grant_starting_sp(v_player_id, null);
  end loop;
end
$seed_sp$;
