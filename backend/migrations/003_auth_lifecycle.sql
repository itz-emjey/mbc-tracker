-- MBC Arena - Migration 003: authentication lifecycle RPCs (Group G)
--
-- Apply after 002_shuttlepower_bootstrap.sql and policies 001-003.
--
-- Registration is RPC-only. A signed-in Supabase Auth user submits a request;
-- a Super Admin approves or rejects it. Approval is atomic: profile status,
-- player record, role assignments, the one-time starting SP ledger row, and the
-- audit entry either all succeed or all roll back.
--
-- Security notes:
--   * every privileged function is SECURITY DEFINER with an empty search_path;
--   * approval/rejection/status changes re-check super_admin on the server;
--   * grant_starting_sp is internal and is not executable by clients;
--   * the unique idempotency key makes a repeated award a no-op, not a second
--     1,000 SP row.
--
-- This migration is intentionally not idempotent. It fails loudly if applied
-- twice, like the earlier migrations.

begin;

-- ---------------------------------------------------------------------------
-- Internal guard: resolve the caller or raise an authorization error.
-- Not exposed to clients.
-- ---------------------------------------------------------------------------
create function public.require_super_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.has_role(v_uid, 'super_admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return v_uid;
end;
$function$;

comment on function public.require_super_admin() is
  'Internal approval/status guard. Returns the caller id only when the caller is an active super_admin.';

revoke all on function public.require_super_admin() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- submit_registration: create/refresh the caller's pending profile + request.
-- Idempotent for a pending profile; active profiles are left alone.
-- ---------------------------------------------------------------------------
create function public.submit_registration(p_full_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_metadata_name text;
  v_name text;
  v_profile public.profiles%rowtype;
  v_request_id uuid;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select lower(btrim(u.email)),
         nullif(btrim(u.raw_user_meta_data ->> 'full_name'), '')
    into v_email, v_metadata_name
    from auth.users as u
   where u.id = v_uid;

  if v_email is null or v_email = '' then
    raise exception 'account email not found' using errcode = '22023';
  end if;

  select *
    into v_profile
    from public.profiles as p
   where p.id = v_uid
     for update;

  v_name := coalesce(
    nullif(btrim(p_full_name), ''),
    v_profile.full_name,
    v_metadata_name
  );

  if v_name is null then
    raise exception 'full name is required' using errcode = '22023';
  end if;

  if char_length(v_name) > 120 then
    raise exception 'full name is too long' using errcode = '22023';
  end if;

  if v_profile.id is null then
    insert into public.profiles (id, full_name, status)
    values (v_uid, v_name, 'pending')
    returning * into v_profile;
  else
    if v_profile.status = 'active' then
      return jsonb_build_object(
        'status', 'active',
        'profile_id', v_uid,
        'request_id', null
      );
    end if;

    if v_profile.status in ('suspended', 'deactivated') then
      raise exception 'account is not eligible to register' using errcode = '42501';
    end if;

    update public.profiles
       set full_name = v_name
     where id = v_uid
     returning * into v_profile;
  end if;

  select r.id
    into v_request_id
    from public.registration_requests as r
   where r.profile_id = v_uid
     and r.status = 'pending'
     for update;

  if v_request_id is not null then
    update public.registration_requests
       set email = v_email,
           full_name = v_name
     where id = v_request_id;

    return jsonb_build_object(
      'status', 'pending',
      'profile_id', v_uid,
      'request_id', v_request_id
    );
  end if;

  insert into public.registration_requests (profile_id, email, full_name, status)
  values (v_uid, v_email, v_name, 'pending')
  returning id into v_request_id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_uid,
    'registration.submit',
    'registration_requests',
    v_request_id,
    jsonb_build_object('status', 'pending', 'full_name', v_name)
  );

  return jsonb_build_object(
    'status', 'pending',
    'profile_id', v_uid,
    'request_id', v_request_id
  );
exception
  when unique_violation then
    raise exception 'a registration for this email is already pending' using errcode = '23505';
end;
$function$;

comment on function public.submit_registration(text) is
  'Creates or refreshes the signed-in user''s pending profile and registration request. Never creates a player or SP award.';

revoke all on function public.submit_registration(text) from public, anon;
grant execute on function public.submit_registration(text) to authenticated;

-- ---------------------------------------------------------------------------
-- grant_starting_sp: exactly one 1,000 SP initial ledger row per player.
-- Internal: callable by approve_registration (definer), not by clients.
-- ---------------------------------------------------------------------------
create function public.grant_starting_sp(
  p_player_id uuid,
  p_registration_request_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_before integer;
  v_transaction_id uuid;
  v_key text := 'player:' || p_player_id::text || ':initial';
  v_current integer;
begin
  if p_player_id is null then
    raise exception 'player id is required' using errcode = '22023';
  end if;

  insert into public.sp_accounts (player_id, current_sp)
  values (p_player_id, 0)
  on conflict (player_id) do nothing;

  select a.current_sp
    into v_before
    from public.sp_accounts as a
   where a.player_id = p_player_id
     for update;

  insert into public.sp_transactions (
    player_id,
    transaction_type,
    sp_before,
    sp_delta,
    sp_after,
    reference_type,
    reference_id,
    rule_version,
    idempotency_key,
    created_by,
    metadata
  )
  values (
    p_player_id,
    'initial',
    v_before,
    1000,
    v_before + 1000,
    'registration',
    p_registration_request_id,
    'starting-sp-v1',
    v_key,
    auth.uid(),
    jsonb_build_object('award', 'starting_sp')
  )
  on conflict (idempotency_key) do nothing
  returning id into v_transaction_id;

  if v_transaction_id is not null then
    update public.sp_accounts
       set current_sp = v_before + 1000
     where player_id = p_player_id;
  end if;

  select a.current_sp
    into v_current
    from public.sp_accounts as a
   where a.player_id = p_player_id;

  return jsonb_build_object(
    'transaction_id', v_transaction_id,
    'awarded', v_transaction_id is not null,
    'current_sp', v_current
  );
end;
$function$;

comment on function public.grant_starting_sp(uuid, uuid) is
  'Internal one-time 1,000 SP starter award. The unique idempotency key makes repeated calls a no-op.';

revoke all on function public.grant_starting_sp(uuid, uuid) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- approve_registration: atomically activate account, player, roles, and SP.
-- Repeating an approval returns the existing result without side effects.
-- ---------------------------------------------------------------------------
create function public.approve_registration(
  p_request_id uuid,
  p_role_keys text[] default array['player'],
  p_player_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_request public.registration_requests%rowtype;
  v_profile public.profiles%rowtype;
  v_existing_player_id uuid;
  v_player_id uuid;
  v_role_keys text[];
  v_role_count integer;
  v_roles jsonb;
  v_current_sp integer;
begin
  v_actor := public.require_super_admin();

  select *
    into v_request
    from public.registration_requests as r
   where r.id = p_request_id
     for update;

  if not found then
    raise exception 'registration request not found' using errcode = 'P0002';
  end if;

  if v_request.status = 'approved' then
    select coalesce(jsonb_agg(r.key order by r.key), '[]'::jsonb)
      into v_roles
      from public.user_roles as ur
      join public.roles as r on r.id = ur.role_id
     where ur.profile_id = v_request.profile_id;

    select a.current_sp
      into v_current_sp
      from public.sp_accounts as a
     where a.player_id = v_request.linked_player_id;

    return jsonb_build_object(
      'status', 'approved',
      'request_id', v_request.id,
      'profile_id', v_request.profile_id,
      'player_id', v_request.linked_player_id,
      'roles', v_roles,
      'current_sp', v_current_sp,
      'already_processed', true
    );
  end if;

  if v_request.status <> 'pending' then
    raise exception 'registration request is %', v_request.status using errcode = '22023';
  end if;

  select *
    into v_profile
    from public.profiles as p
   where p.id = v_request.profile_id
     for update;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if v_profile.status not in ('pending', 'active') then
    raise exception 'profile is not eligible for approval' using errcode = '22023';
  end if;

  v_role_keys := array(
    select distinct k
      from unnest(coalesce(p_role_keys, array['player']::text[])) as k
     where k is not null
  );

  if coalesce(array_length(v_role_keys, 1), 0) = 0 then
    raise exception 'at least one role is required' using errcode = '22023';
  end if;

  select count(*)
    into v_role_count
    from public.roles as r
   where r.key = any(v_role_keys);

  if v_role_count <> array_length(v_role_keys, 1) then
    raise exception 'unknown role in approval' using errcode = '22023';
  end if;

  select p.id
    into v_existing_player_id
    from public.players as p
   where p.profile_id = v_request.profile_id;

  if p_player_id is not null then
    select p.id, p.profile_id
      into v_player_id, v_existing_player_id
      from public.players as p
     where p.id = p_player_id
       for update;

    if not found then
      raise exception 'player record not found' using errcode = 'P0002';
    end if;

    if v_existing_player_id is not null
       and v_existing_player_id <> v_request.profile_id then
      raise exception 'player record is already linked to another account' using errcode = '23505';
    end if;

    select p.id
      into v_existing_player_id
      from public.players as p
     where p.profile_id = v_request.profile_id
       and p.id <> p_player_id;

    if v_existing_player_id is not null then
      raise exception 'profile already has a different player record' using errcode = '23505';
    end if;

    update public.players
       set profile_id = v_request.profile_id
     where id = p_player_id;

    v_player_id := p_player_id;
  elsif v_existing_player_id is not null then
    v_player_id := v_existing_player_id;
  else
    insert into public.players (profile_id, full_name, status)
    values (v_request.profile_id, v_profile.full_name, 'active')
    returning id into v_player_id;
  end if;

  update public.profiles
     set status = 'active'
   where id = v_request.profile_id;

  insert into public.user_roles (profile_id, role_id, granted_by)
  select v_request.profile_id, r.id, v_actor
    from public.roles as r
   where r.key = any(v_role_keys)
  on conflict (profile_id, role_id) do nothing;

  perform public.grant_starting_sp(v_player_id, v_request.id);

  update public.registration_requests
     set status = 'approved',
         reviewed_at = now(),
         reviewed_by = v_actor,
         linked_player_id = v_player_id
   where id = v_request.id;

  select coalesce(jsonb_agg(r.key order by r.key), '[]'::jsonb)
    into v_roles
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
   where ur.profile_id = v_request.profile_id;

  select a.current_sp
    into v_current_sp
    from public.sp_accounts as a
   where a.player_id = v_player_id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    before_data,
    after_data
  )
  values (
    v_actor,
    'registration.approve',
    'registration_requests',
    v_request.id,
    jsonb_build_object(
      'request_status', v_request.status,
      'profile_status', v_profile.status
    ),
    jsonb_build_object(
      'request_status', 'approved',
      'profile_status', 'active',
      'player_id', v_player_id,
      'roles', v_roles,
      'current_sp', v_current_sp
    )
  );

  return jsonb_build_object(
    'status', 'approved',
    'request_id', v_request.id,
    'profile_id', v_request.profile_id,
    'player_id', v_player_id,
    'roles', v_roles,
    'current_sp', v_current_sp,
    'already_processed', false
  );
end;
$function$;

comment on function public.approve_registration(uuid, text[], uuid) is
  'Super-admin only atomic approval. Assigns roles, creates/links one player, and awards starting SP once.';

revoke all on function public.approve_registration(uuid, text[], uuid) from public, anon;
grant execute on function public.approve_registration(uuid, text[], uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reject_registration: require a reason and audit the decision.
-- Repeating a rejection is a no-op; an approved request cannot be rejected.
-- ---------------------------------------------------------------------------
create function public.reject_registration(p_request_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_request public.registration_requests%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
begin
  v_actor := public.require_super_admin();

  select *
    into v_request
    from public.registration_requests as r
   where r.id = p_request_id
     for update;

  if not found then
    raise exception 'registration request not found' using errcode = 'P0002';
  end if;

  if v_request.status = 'rejected' then
    return jsonb_build_object(
      'status', 'rejected',
      'request_id', v_request.id,
      'already_processed', true
    );
  end if;

  if v_request.status <> 'pending' then
    raise exception 'registration request is %', v_request.status using errcode = '22023';
  end if;

  if v_reason is null then
    raise exception 'a rejection reason is required' using errcode = '22023';
  end if;

  if char_length(v_reason) > 1000 then
    raise exception 'rejection reason is too long' using errcode = '22023';
  end if;

  update public.registration_requests
     set status = 'rejected',
         reviewed_at = now(),
         reviewed_by = v_actor,
         decision_note = v_reason,
         linked_player_id = null
   where id = v_request.id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    before_data,
    after_data
  )
  values (
    v_actor,
    'registration.reject',
    'registration_requests',
    v_request.id,
    jsonb_build_object('request_status', v_request.status),
    jsonb_build_object('request_status', 'rejected', 'decision_note', v_reason)
  );

  return jsonb_build_object(
    'status', 'rejected',
    'request_id', v_request.id,
    'already_processed', false
  );
end;
$function$;

comment on function public.reject_registration(uuid, text) is
  'Super-admin only rejection with a required reason. Audited; repeat calls are harmless.';

revoke all on function public.reject_registration(uuid, text) from public, anon;
grant execute on function public.reject_registration(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- set_profile_status: suspend/deactivate/reactivate an approved account.
-- A pending profile must go through registration approval; self-lockout is
-- rejected so a lone Super Admin cannot close their own workspace.
-- ---------------------------------------------------------------------------
create function public.set_profile_status(p_profile_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_profile public.profiles%rowtype;
begin
  v_actor := public.require_super_admin();

  if p_status not in ('active', 'suspended', 'deactivated') then
    raise exception 'invalid profile status' using errcode = '22023';
  end if;

  select *
    into v_profile
    from public.profiles as p
   where p.id = p_profile_id
     for update;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if v_profile.status = 'pending' then
    raise exception 'pending accounts are handled through registration approval' using errcode = '22023';
  end if;

  if v_profile.id = v_actor and p_status <> 'active' then
    raise exception 'you cannot change your own access' using errcode = '22023';
  end if;

  if v_profile.status = p_status then
    return jsonb_build_object(
      'profile_id', v_profile.id,
      'status', p_status,
      'changed', false
    );
  end if;

  update public.profiles
     set status = p_status
   where id = v_profile.id;

  insert into public.audit_logs (
    actor_id,
    action,
    target_table,
    target_id,
    before_data,
    after_data
  )
  values (
    v_actor,
    'profile.status',
    'profiles',
    v_profile.id,
    jsonb_build_object('status', v_profile.status),
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object(
    'profile_id', v_profile.id,
    'status', p_status,
    'changed', true
  );
end;
$function$;

comment on function public.set_profile_status(uuid, text) is
  'Super-admin only suspension/deactivation/reactivation. Pending accounts use registration approval.';

revoke all on function public.set_profile_status(uuid, text) from public, anon;
grant execute on function public.set_profile_status(uuid, text) to authenticated;

-- Registration becomes RPC-only in backend/policies/004_auth_lifecycle.sql:
-- the earlier direct self-insert policy is removed there so every profile
-- starts with a server-created request.

commit;
