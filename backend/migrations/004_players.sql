-- MBC Arena - Migration 004: player directory RPCs (Phase 2, Group K)
--
-- Apply after 003_auth_lifecycle.sql.
--
-- Two lifecycle actions cannot be done through the table grants:
--   * replacing a member's role set after approval (user_roles has no client
--     write grant, so roles only change through a checked RPC);
--   * linking or unlinking a player record and an approved account
--     (players.profile_id is deliberately absent from the staff insert/update
--     grants, because the one-to-one link is a privileged decision).
--
-- Both are Super Admin only, audited, and idempotent where it makes sense.
--
-- Security notes:
--   * every function is SECURITY DEFINER with an empty search_path;
--   * require_super_admin() from migration 003 re-checks authority server-side;
--   * the unique profile_id constraint remains the last line of defence, so a
--     race between two admins cannot link one player to two accounts.
--
-- This migration is intentionally not idempotent. It fails loudly if applied
-- twice, like the earlier migrations.

begin;

-- ---------------------------------------------------------------------------
-- set_profile_roles: replace an approved member's role set in one operation.
-- At least one role is required, matching approval. An admin cannot remove
-- their own super_admin role, so a lone admin cannot lock themselves out.
-- ---------------------------------------------------------------------------
create function public.set_profile_roles(p_profile_id uuid, p_role_keys text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_profile public.profiles%rowtype;
  v_role_keys text[];
  v_role_count integer;
  v_before_roles jsonb;
  v_after_roles jsonb;
begin
  v_actor := public.require_super_admin();

  v_role_keys := array(
    select distinct k
      from unnest(coalesce(p_role_keys, array[]::text[])) as k
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
    raise exception 'unknown role' using errcode = '22023';
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
    raise exception 'pending accounts are handled through registration approval'
      using errcode = '22023';
  end if;

  if v_profile.id = v_actor and not ('super_admin' = any (v_role_keys)) then
    raise exception 'you cannot remove your own super admin role' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(r.key order by r.key), '[]'::jsonb)
    into v_before_roles
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
   where ur.profile_id = v_profile.id;

  delete from public.user_roles as ur
   using public.roles as r
   where ur.role_id = r.id
     and ur.profile_id = v_profile.id
     and not (r.key = any (v_role_keys));

  insert into public.user_roles (profile_id, role_id, granted_by)
  select v_profile.id, r.id, v_actor
    from public.roles as r
   where r.key = any (v_role_keys)
  on conflict (profile_id, role_id) do nothing;

  select coalesce(jsonb_agg(r.key order by r.key), '[]'::jsonb)
    into v_after_roles
    from public.user_roles as ur
    join public.roles as r on r.id = ur.role_id
   where ur.profile_id = v_profile.id;

  if v_before_roles = v_after_roles then
    return jsonb_build_object(
      'profile_id', v_profile.id,
      'roles', v_after_roles,
      'changed', false
    );
  end if;

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
    'profile.roles',
    'profiles',
    v_profile.id,
    jsonb_build_object('roles', v_before_roles),
    jsonb_build_object('roles', v_after_roles)
  );

  return jsonb_build_object(
    'profile_id', v_profile.id,
    'roles', v_after_roles,
    'changed', true
  );
end;
$function$;

comment on function public.set_profile_roles(uuid, text[]) is
  'Super-admin only role replacement. Refuses empty/unknown sets and self-demotion from super_admin.';

revoke all on function public.set_profile_roles(uuid, text[]) from public, anon;
grant execute on function public.set_profile_roles(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- link_player_account: connect one player record to one approved account.
-- Repeating the same link is a no-op. A player or account that already has a
-- different partner is refused; the unique constraint is the final guard.
-- ---------------------------------------------------------------------------
create function public.link_player_account(p_profile_id uuid, p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_profile public.profiles%rowtype;
  v_player public.players%rowtype;
  v_other_player_id uuid;
begin
  v_actor := public.require_super_admin();

  if p_profile_id is null or p_player_id is null then
    raise exception 'profile and player are required' using errcode = '22023';
  end if;

  select *
    into v_profile
    from public.profiles as p
   where p.id = p_profile_id
     for update;

  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if v_profile.status <> 'active' then
    raise exception 'only an approved account can be linked to a player record'
      using errcode = '22023';
  end if;

  select *
    into v_player
    from public.players as p
   where p.id = p_player_id
     for update;

  if not found then
    raise exception 'player record not found' using errcode = 'P0002';
  end if;

  if v_player.profile_id = v_profile.id then
    return jsonb_build_object(
      'profile_id', v_profile.id,
      'player_id', v_player.id,
      'changed', false,
      'already_linked', true
    );
  end if;

  if v_player.profile_id is not null then
    raise exception 'player record is already linked to another account'
      using errcode = '23505';
  end if;

  select p.id
    into v_other_player_id
    from public.players as p
   where p.profile_id = v_profile.id
     and p.id <> v_player.id;

  if v_other_player_id is not null then
    raise exception 'profile already has a different player record' using errcode = '23505';
  end if;

  update public.players
     set profile_id = v_profile.id
   where id = v_player.id;

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
    'player.account_linked',
    'players',
    v_player.id,
    jsonb_build_object('profile_id', null),
    jsonb_build_object('profile_id', v_profile.id)
  );

  return jsonb_build_object(
    'profile_id', v_profile.id,
    'player_id', v_player.id,
    'changed', true,
    'already_linked', false
  );
end;
$function$;

comment on function public.link_player_account(uuid, uuid) is
  'Super-admin only link of one player record to one approved account. Idempotent for the same pair.';

revoke all on function public.link_player_account(uuid, uuid) from public, anon;
grant execute on function public.link_player_account(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- unlink_player_account: detach an account without deleting the player record
-- or its history. Used to correct a mistaken link; the player row stays.
-- ---------------------------------------------------------------------------
create function public.unlink_player_account(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_player public.players%rowtype;
begin
  v_actor := public.require_super_admin();

  if p_player_id is null then
    raise exception 'player is required' using errcode = '22023';
  end if;

  select *
    into v_player
    from public.players as p
   where p.id = p_player_id
     for update;

  if not found then
    raise exception 'player record not found' using errcode = 'P0002';
  end if;

  if v_player.profile_id is null then
    return jsonb_build_object(
      'player_id', v_player.id,
      'profile_id', null,
      'changed', false
    );
  end if;

  update public.players
     set profile_id = null
   where id = v_player.id;

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
    'player.account_unlinked',
    'players',
    v_player.id,
    jsonb_build_object('profile_id', v_player.profile_id),
    jsonb_build_object('profile_id', null)
  );

  return jsonb_build_object(
    'player_id', v_player.id,
    'profile_id', null,
    'changed', true
  );
end;
$function$;

comment on function public.unlink_player_account(uuid) is
  'Super-admin only unlink. Keeps the player record and all history.';

revoke all on function public.unlink_player_account(uuid) from public, anon;
grant execute on function public.unlink_player_account(uuid) to authenticated;

commit;
