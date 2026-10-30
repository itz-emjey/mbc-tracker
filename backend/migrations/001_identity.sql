-- MBC Arena — Migration 001: identity, roles, registration, audit, settings
--
-- Apply order:
--   1. backend/migrations/001_identity.sql   (this file)
--   2. backend/policies/001_identity.sql
--   3. backend/policies/002_operations.sql
--
-- This file is intentionally not idempotent: every CREATE fails on a second
-- run, which is the required "fail loudly" behaviour for a schema migration.
-- Do not add IF NOT EXISTS or DROP statements here.
--
-- Postgres does not support "CREATE POLICY IF NOT EXISTS"; policies live in
-- backend/policies/ and are applied after this migration.

begin;

-- ---------------------------------------------------------------------------
-- profiles: one row per Supabase Auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_full_name_check
    check (full_name = btrim(full_name) and char_length(full_name) between 1 and 120),
  constraint profiles_status_check
    check (status in ('pending', 'active', 'suspended', 'deactivated'))
);

comment on table public.profiles is
  'Account profile linked 1:1 to auth.users. Approval moves status pending -> active.';
comment on column public.profiles.status is
  'pending: awaiting registration approval; active: normal access; suspended/deactivated: access blocked without deleting records.';

-- ---------------------------------------------------------------------------
-- players: club records, optionally linked to one account
-- ---------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  full_name text not null,
  gender text,
  status text not null default 'active',
  joined_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint players_full_name_check
    check (full_name = btrim(full_name) and char_length(full_name) between 1 and 120),
  constraint players_gender_check
    check (gender is null or gender in ('male', 'female')),
  constraint players_status_check
    check (status in ('active', 'inactive', 'suspended'))
);

comment on table public.players is
  'Club player record. May exist without an account; profile_id is unique when linked.';
comment on column public.players.gender is
  'Nullable; only Mixed Doubles eligibility reads it (D10). Not exposed in public views by default.';

-- ---------------------------------------------------------------------------
-- roles: fixed role catalogue
-- ---------------------------------------------------------------------------
create table public.roles (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_key_unique unique (key),
  constraint roles_key_check
    check (key in ('super_admin', 'tournament_manager', 'trainer', 'player')),
  constraint roles_label_check
    check (label = btrim(label) and char_length(label) between 1 and 60)
);

comment on table public.roles is
  'Fixed role catalogue. Assignments live in user_roles; one account may hold several roles.';

insert into public.roles (key, label, description) values
  ('super_admin', 'Super Admin', 'Full system configuration, registration approval, and role assignment.'),
  ('tournament_manager', 'Tournament Manager', 'Tournaments, entries, draws, brackets, and official results.'),
  ('trainer', 'Trainer', 'Training, attendance, payments, jerseys, polls, and announcements.'),
  ('player', 'Player', 'Own profile, club data, tournament entry, challenges, votes, and jersey orders.')
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- user_roles: many-to-many account/role assignments
-- ---------------------------------------------------------------------------
create table public.user_roles (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete restrict,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (profile_id, role_id)
);

comment on table public.user_roles is
  'Role assignments. One row per (profile, role); no role hierarchy.';

create index user_roles_role_id_idx on public.user_roles (role_id);
create index user_roles_granted_by_idx on public.user_roles (granted_by);

-- ---------------------------------------------------------------------------
-- registration_requests: pending account approvals
-- ---------------------------------------------------------------------------
create table public.registration_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  email text not null,
  full_name text not null,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  decision_note text,
  linked_player_id uuid references public.players (id) on delete set null,
  constraint registration_requests_email_check
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 254
      and email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    ),
  constraint registration_requests_full_name_check
    check (full_name = btrim(full_name) and char_length(full_name) between 1 and 120),
  constraint registration_requests_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint registration_requests_decision_note_check
    check (decision_note is null or char_length(decision_note) <= 1000),
  constraint registration_requests_review_state_check
    check (
      (status = 'pending'
        and reviewed_at is null
        and reviewed_by is null
        and linked_player_id is null)
      or
      (status = 'rejected'
        and reviewed_at is not null
        and reviewed_by is not null
        and linked_player_id is null)
      or
      (status = 'approved'
        and reviewed_at is not null
        and reviewed_by is not null
        and linked_player_id is not null)
    )
);

comment on table public.registration_requests is
  'One pending request per email/profile. Approval links a player and is recorded by an RPC.';

create unique index registration_requests_pending_email_key
  on public.registration_requests (email)
  where status = 'pending';

create unique index registration_requests_pending_profile_key
  on public.registration_requests (profile_id)
  where status = 'pending';

create index registration_requests_status_idx
  on public.registration_requests (status, requested_at);

create index registration_requests_linked_player_idx
  on public.registration_requests (linked_player_id);

-- ---------------------------------------------------------------------------
-- audit_logs: append-only administrative history
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_table text not null,
  target_id uuid,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_check
    check (action = btrim(action) and char_length(action) between 1 and 100),
  constraint audit_logs_target_table_check
    check (target_table = btrim(target_table) and char_length(target_table) between 1 and 63),
  constraint audit_logs_before_data_check
    check (before_data is null or jsonb_typeof(before_data) = 'object'),
  constraint audit_logs_after_data_check
    check (after_data is null or jsonb_typeof(after_data) = 'object'),
  constraint audit_logs_metadata_check
    check (jsonb_typeof(metadata) = 'object')
);

comment on table public.audit_logs is
  'Append-only audit trail. Clients have no INSERT/UPDATE/DELETE; privileged RPCs write it.';

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_target_idx on public.audit_logs (target_table, target_id);

-- ---------------------------------------------------------------------------
-- app_settings: club-controlled configuration
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_key_check
    check (key = btrim(key) and char_length(key) between 1 and 100)
);

comment on table public.app_settings is
  'Club configuration key/value pairs. Clients read only; privileged RPCs update and audit.';

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

revoke all on function public.set_updated_at() from public;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create trigger roles_set_updated_at
  before update on public.roles
  for each row execute function public.set_updated_at();

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- has_role(): the single role predicate used by RLS and RPC guards
-- ---------------------------------------------------------------------------
create function public.has_role(p_profile_id uuid, p_role_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
    join public.profiles as p on p.id = ur.profile_id
    where ur.profile_id = p_profile_id
      and r.key = p_role_key
      and p.status = 'active'
  );
$function$;

comment on function public.has_role(uuid, text) is
  'True when the profile is active and holds the role. Security definer so RLS policies can use it without exposing user_roles; suspension and deactivation revoke access immediately.';

revoke all on function public.has_role(uuid, text) from public;
grant execute on function public.has_role(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS is enabled in the migration; policies are applied separately
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.registration_requests enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_settings enable row level security;

commit;
