-- MBC Arena - Migration 011: friendly match SP award
--
-- The formula is still awaiting club approval (PLAN.md §7 rules 1, 2, and 6;
-- docs/sp-formula-signoff.md). This migration adds the *machinery*, not a rule:
--
--   * award_friendly_sp() reads the single rule version that is both approved
--     and enabled. When there is none it returns status 'disabled' and writes
--     nothing, so today's behaviour is unchanged and no match can move SP until
--     a version is deliberately enabled.
--   * It writes one append-only ledger row per player keyed
--     friendly:<match_id>:<player>, and updates the cached balance in the same
--     transaction, so a retry, a replay, or a second approval is a no-op.
--   * approve_friendly_result() and auto_approve_friendly_matches() are
--     superseded to call it, so the award happens in the same transaction as
--     the confirmation.
--
-- Deliberately absent: tournament awards (they need the team/player mapping and
-- the approved 2x rule), placement, seasons, and reversal. Those land with the
-- migrations that own them. An award can never run against an unapproved rule.
--
-- Apply after 010_friendly_matches.sql. No new table, no new policy, and no
-- client grant: the helper is internal. This migration is intentionally not
-- idempotent.

begin;

-- ---------------------------------------------------------------------------
-- award_friendly_sp: one confirmed singles friendly -> two ledger rows
-- ---------------------------------------------------------------------------
create function public.award_friendly_sp(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match public.friendly_matches%rowtype;
  v_version text;
  v_config jsonb;
  v_base numeric;
  v_sensitivity numeric;
  v_min numeric;
  v_max numeric;
  v_floor numeric;
  v_winner uuid;
  v_loser uuid;
  v_winner_sp integer;
  v_loser_sp integer;
  v_raw numeric;
  v_magnitude integer;
  v_player uuid;
  v_opponent uuid;
  v_before integer;
  v_delta integer;
  v_after integer;
  v_key text;
  v_tx uuid;
  v_awarded integer := 0;
  v_skipped integer := 0;
begin
  select * into v_match
    from public.friendly_matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.status not in ('confirmed', 'auto_approved') then
    raise exception 'only a confirmed friendly can award SP' using errcode = '22023';
  end if;

  -- The only place the ledger can learn a formula. Both conditions are required:
  -- a provisional or disabled version can never compute an award.
  select r.version, r.config
    into v_version, v_config
    from public.sp_rule_versions as r
   where r.is_enabled
     and r.status = 'approved';

  if not found then
    return jsonb_build_object(
      'status', 'disabled',
      'reason', 'no approved rule version is enabled',
      'awarded', 0
    );
  end if;

  v_base := (v_config ->> 'baseChange')::numeric;
  v_sensitivity := (v_config ->> 'strengthSensitivity')::numeric;
  v_min := (v_config ->> 'minGainPerMatch')::numeric;
  v_max := (v_config ->> 'maxGainPerMatch')::numeric;
  v_floor := (v_config ->> 'floor')::numeric;

  if v_base is null or v_sensitivity is null or v_min is null or v_max is null then
    raise exception 'rule version % is missing a required config key', v_version
      using errcode = '22023';
  end if;

  if coalesce(v_config ->> 'rounding', 'round') <> 'round' then
    raise exception 'rule version % uses an unsupported rounding policy', v_version
      using errcode = '22023';
  end if;

  v_winner := v_match.winner_id;
  v_loser := case
    when v_match.winner_id = v_match.challenger_id then v_match.opponent_id
    else v_match.challenger_id
  end;

  -- Lock both accounts in a deterministic order so two matches finishing at the
  -- same time cannot spend the same cached balance or deadlock each other.
  perform 1
     from public.sp_accounts as a
    where a.player_id in (v_winner, v_loser)
    order by a.player_id
      for update;

  select a.current_sp into v_winner_sp
    from public.sp_accounts as a
   where a.player_id = v_winner;

  select a.current_sp into v_loser_sp
    from public.sp_accounts as a
   where a.player_id = v_loser;

  if v_winner_sp is null or v_loser_sp is null then
    raise exception 'both players need an SP account before a friendly can award'
      using errcode = '22023';
  end if;

  -- Exact formula: clamp, round half-up on the size of the change, then apply
  -- the multiplier. A friendly uses 1x; the tournament 2x multiplier belongs to
  -- the tournament award, not this function.
  v_raw := v_base + v_sensitivity * (v_loser_sp - v_winner_sp);
  v_magnitude := floor(least(greatest(v_raw, v_min), v_max) + 0.5)::integer;

  for v_player, v_opponent, v_before, v_delta in
    select v_winner, v_loser, v_winner_sp, v_magnitude
    union all
    select v_loser, v_winner, v_loser_sp, -v_magnitude
  loop
    if v_floor is not null and v_before + v_delta < v_floor then
      v_delta := (v_floor - v_before)::integer;
    end if;

    -- A zero change is not a ledger row (sp_delta <> 0). It happens only at the
    -- configured floor.
    if v_delta = 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_after := v_before + v_delta;
    v_key := format('friendly:%s:%s', v_match.id, v_player);

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
      metadata,
      created_by
    )
    values (
      v_player,
      'friendly',
      v_before,
      v_delta,
      v_after,
      'match',
      v_match.id,
      v_version,
      v_key,
      jsonb_build_object(
        'source', 'friendly',
        'match_status', v_match.status,
        'winner_id', v_winner,
        'opponent_id', v_opponent
      ),
      auth.uid()
    )
    on conflict (idempotency_key) do nothing
    returning id into v_tx;

    if v_tx is null then
      v_skipped := v_skipped + 1;
    else
      update public.sp_accounts
         set current_sp = v_after
       where player_id = v_player;

      v_awarded := v_awarded + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'awarded',
    'rule_version', v_version,
    'awarded', v_awarded,
    'skipped', v_skipped
  );
end;
$function$;

comment on function public.award_friendly_sp(uuid) is
  'Internal. Awards a confirmed singles friendly from the one approved+enabled rule version; returns disabled and writes nothing when there is none. Idempotent per player.';

revoke all on function public.award_friendly_sp(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- approve_friendly_result: unchanged, plus the award in the same transaction
-- ---------------------------------------------------------------------------
create or replace function public.approve_friendly_result(p_match_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid := public.require_friendly_player();
  v_match public.friendly_matches%rowtype;
begin
  select * into v_match
    from public.friendly_matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.status <> 'awaiting_approval' then
    raise exception 'this result is no longer awaiting approval' using errcode = '22023';
  end if;

  if v_player not in (v_match.challenger_id, v_match.opponent_id) then
    raise exception 'only the players in this match can approve a result'
      using errcode = '42501';
  end if;

  if v_player = v_match.winner_id then
    raise exception 'the winner cannot approve their own result' using errcode = '42501';
  end if;

  update public.friendly_matches
     set status = 'confirmed',
         confirmed_at = now(),
         responded_by = v_actor,
         responded_at = now()
   where id = v_match.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'friendly.result.confirmed',
    'friendly_matches',
    v_match.id,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object('status', 'confirmed', 'winner_id', v_match.winner_id)
  );

  -- Award in the same transaction as the confirmation. A rule that is not
  -- approved AND enabled returns disabled and writes nothing.
  perform public.award_friendly_sp(v_match.id);

  return jsonb_build_object('id', v_match.id, 'status', 'confirmed');
end;
$function$;

comment on function public.approve_friendly_result(uuid) is
  'Losing player confirms the submitted result. Winner cannot approve. Awards SP only when an approved rule version is enabled.';

-- ---------------------------------------------------------------------------
-- auto_approve_friendly_matches: unchanged, plus the award in the same loop
-- ---------------------------------------------------------------------------
create or replace function public.auto_approve_friendly_matches()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_match public.friendly_matches%rowtype;
  v_count integer := 0;
begin
  if v_caller is not null and not public.has_role(v_caller, 'super_admin') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  for v_match in
    select *
      from public.friendly_matches as m
     where m.status = 'awaiting_approval'
       and m.auto_approval_due_at <= now()
     order by m.auto_approval_due_at
       for update skip locked
  loop
    update public.friendly_matches
       set status = 'auto_approved',
           confirmed_at = now()
     where id = v_match.id;

    insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
    values (
      null,
      'friendly.result.auto_approved',
      'friendly_matches',
      v_match.id,
      jsonb_build_object(
        'status', 'auto_approved',
        'winner_id', v_match.winner_id,
        'auto_approval_due_at', v_match.auto_approval_due_at
      )
    );

    perform public.award_friendly_sp(v_match.id);

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

comment on function public.auto_approve_friendly_matches() is
  'Confirms results 24 hours after submission. Idempotent, Super Admin or the scheduler only; awards SP only when an approved rule version is enabled.';

commit;
