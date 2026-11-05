-- MBC Arena - Migration 020: friendly doubles (D20)
--
-- Apply after 019_placement_and_unplayed_sp.sql. Policies live in
-- backend/policies/020_friendly_doubles.sql.
--
-- Scope (PLAN.md §7.5, approved 2026-11-04 as D20):
--   * a friendly may be singles or doubles;
--   * the challenger names a partner when creating a doubles challenge, and the
--     challenged player names a partner when accepting it;
--   * both losing partners may approve or dispute; the result is official when
--     both approve, or at the 24-hour deadline if neither disputes; a dispute
--     by either partner freezes the whole result;
--   * either member of the winning team may submit once for the team;
--   * friendly doubles may be any pairing; D10 stays tournament-only;
--   * SP uses the D13 team-average formula, an even split with the odd point to
--     the lower player id, and the D19 own-share rule in placement matches.
--
-- The singles RPCs keep their behaviour. Doubles has its own create and respond
-- RPCs so a singles caller cannot accidentally create an incomplete team. The
-- shared result RPCs are superseded here with doubles-aware versions.
--
-- Dispute resolution remains §7 rule 8 and is not implemented.
--
-- This migration is intentionally not idempotent. It fails loudly if applied
-- twice, like the earlier migrations.

begin;

-- ---------------------------------------------------------------------------
-- schema: teams and per-partner approval state
-- ---------------------------------------------------------------------------
alter table public.friendly_matches
  add column match_type text not null default 'singles',
  add column challenger_partner_id uuid references public.players (id) on delete restrict,
  add column opponent_partner_id uuid references public.players (id) on delete restrict,
  add column challenger_approved_at timestamptz,
  add column challenger_partner_approved_at timestamptz,
  add column opponent_approved_at timestamptz,
  add column opponent_partner_approved_at timestamptz;

alter table public.friendly_matches
  add constraint friendly_matches_type_check
    check (match_type in ('singles', 'doubles')),
  add constraint friendly_matches_partner_shape_check
    check (
      (match_type = 'singles'
        and challenger_partner_id is null
        and opponent_partner_id is null)
      or (match_type = 'doubles' and challenger_partner_id is not null)
    ),
  add constraint friendly_matches_distinct_players_check
    check (
      challenger_id <> opponent_id
      and (challenger_partner_id is null
        or (challenger_partner_id <> challenger_id
          and challenger_partner_id <> opponent_id))
      and (opponent_partner_id is null
        or (opponent_partner_id <> challenger_id
          and opponent_partner_id <> opponent_id
          and opponent_partner_id <> challenger_partner_id))
    ),
  add constraint friendly_matches_acceptance_shape_check
    check (
      match_type = 'singles'
      or status in ('pending', 'declined', 'cancelled')
      or opponent_partner_id is not null
    );

-- The winner is stored as the captain of the winning team. A doubles result
-- can never name a partner as the winner.
alter table public.friendly_matches
  drop constraint friendly_matches_winner_check;

alter table public.friendly_matches
  add constraint friendly_matches_winner_check
    check (
      winner_id is null
      or coalesce(
        winner_id = challenger_id
        or winner_id = opponent_id
        or winner_id = challenger_partner_id
        or winner_id = opponent_partner_id,
        false
      )
    ),
  add constraint friendly_matches_winner_captain_check
    check (
      winner_id is null
      or match_type = 'singles'
      or winner_id in (challenger_id, opponent_id)
    );

comment on table public.friendly_matches is
  'Friendly match, singles or doubles. Confirmed results award SP under the enabled approved rule.';
comment on column public.friendly_matches.match_type is
  'singles or doubles. A doubles challenge has a challenger partner at creation and an opponent partner at acceptance.';
comment on column public.friendly_matches.challenger_partner_id is
  'The challenger team partner. Null for singles.';
comment on column public.friendly_matches.opponent_partner_id is
  'The challenged team partner, named when the challenge is accepted. Null for singles or an unaccepted challenge.';
comment on column public.friendly_matches.winner_id is
  'The captain of the winning team. A doubles winner is always challenger_id or opponent_id.';
comment on column public.friendly_matches.challenger_approved_at is
  'When the challenger captain approved a losing result. Singles and doubles.';
comment on column public.friendly_matches.challenger_partner_approved_at is
  'When the challenger partner approved a losing result. Doubles only.';
comment on column public.friendly_matches.opponent_approved_at is
  'When the opponent captain approved a losing result. Singles and doubles.';
comment on column public.friendly_matches.opponent_partner_approved_at is
  'When the opponent partner approved a losing result. Doubles only.';
comment on column public.friendly_matches.status is
  'pending -> accepted -> awaiting_approval -> confirmed | auto_approved | disputed; pending -> declined; pending/accepted -> cancelled.';

-- ---------------------------------------------------------------------------
-- helper: the winning or losing team for a match
-- ---------------------------------------------------------------------------
create function public.friendly_team(p_match_id uuid, p_winning boolean)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when m.match_type = 'singles' then
      case
        when p_winning then array[m.winner_id]
        else array[
          case
            when m.winner_id = m.challenger_id then m.opponent_id
            else m.challenger_id
          end
        ]
      end
    when p_winning then
      case
        when coalesce(
          m.winner_id = m.challenger_id
          or m.winner_id = m.challenger_partner_id,
          false
        )
          then array[m.challenger_id, m.challenger_partner_id]
        else array[m.opponent_id, m.opponent_partner_id]
      end
    else
      case
        when coalesce(
          m.winner_id = m.challenger_id
          or m.winner_id = m.challenger_partner_id,
          false
        )
          then array[m.opponent_id, m.opponent_partner_id]
        else array[m.challenger_id, m.challenger_partner_id]
      end
  end
  from public.friendly_matches as m
  where m.id = p_match_id;
$function$;

comment on function public.friendly_team(uuid, boolean) is
  'Internal. The winning or losing team as a player-id array. Singles has one member; doubles has two.';

revoke all on function public.friendly_team(uuid, boolean)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_doubles_friendly_challenge
-- ---------------------------------------------------------------------------
create function public.create_doubles_friendly_challenge(
  p_opponent_id uuid,
  p_partner_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_challenger public.players%rowtype;
  v_partner public.players%rowtype;
  v_opponent public.players%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_match public.friendly_matches%rowtype;
begin
  if v_actor is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_challenger
    from public.players as p
   where p.profile_id = v_actor
     and p.status = 'active';

  if not found then
    raise exception 'an active player record is required to challenge'
      using errcode = '42501';
  end if;

  if p_opponent_id is null then
    raise exception 'choose an opponent' using errcode = '22023';
  end if;

  if p_partner_id is null then
    raise exception 'choose a doubles partner' using errcode = '22023';
  end if;

  if p_opponent_id = v_challenger.id then
    raise exception 'you cannot challenge yourself' using errcode = '22023';
  end if;

  if p_partner_id = v_challenger.id then
    raise exception 'you cannot partner with yourself' using errcode = '22023';
  end if;

  if p_partner_id = p_opponent_id then
    raise exception 'your partner must be a different player' using errcode = '22023';
  end if;

  select * into v_partner
    from public.players as p
   where p.id = p_partner_id
     and p.status = 'active';

  if not found then
    raise exception 'that partner is not available' using errcode = '22023';
  end if;

  if v_partner.profile_id is null then
    raise exception 'that partner has no linked account yet' using errcode = '22023';
  end if;

  select * into v_opponent
    from public.players as p
   where p.id = p_opponent_id
     and p.status = 'active';

  if not found then
    raise exception 'that player is not available' using errcode = '22023';
  end if;

  if v_opponent.profile_id is null then
    raise exception 'that player has no linked account yet' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'the note is too long' using errcode = '22023';
  end if;

  if public.find_open_friendly(v_challenger.id, v_opponent.id) is not null then
    raise exception 'you already have an open friendly match with this player'
      using errcode = '23505';
  end if;

  insert into public.friendly_matches (
    challenger_id,
    challenger_partner_id,
    opponent_id,
    match_type,
    note,
    created_by
  )
  values (
    v_challenger.id,
    v_partner.id,
    v_opponent.id,
    'doubles',
    v_note,
    v_actor
  )
  returning * into v_match;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'friendly.challenge.created',
    'friendly_matches',
    v_match.id,
    jsonb_build_object(
      'match_type', v_match.match_type,
      'challenger_id', v_match.challenger_id,
      'challenger_partner_id', v_match.challenger_partner_id,
      'opponent_id', v_match.opponent_id,
      'status', v_match.status
    )
  );

  return jsonb_build_object('id', v_match.id, 'status', v_match.status, 'match_type', 'doubles');
end;
$function$;

comment on function public.create_doubles_friendly_challenge(uuid, uuid, text) is
  'Creates a doubles challenge: the challenger names their partner. The challenged player names their partner on acceptance. One open match per captain pair; audited.';

revoke all on function public.create_doubles_friendly_challenge(uuid, uuid, text)
  from public, anon;
grant execute on function public.create_doubles_friendly_challenge(uuid, uuid, text)
  to authenticated;

-- ---------------------------------------------------------------------------
-- respond_friendly_challenge: singles only, and it now says so
-- ---------------------------------------------------------------------------
create or replace function public.respond_friendly_challenge(
  p_match_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid := public.require_friendly_player();
  v_match public.friendly_matches%rowtype;
  v_status text := case when p_accept then 'accepted' else 'declined' end;
begin
  select * into v_match
    from public.friendly_matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.match_type <> 'singles' then
    raise exception 'use the doubles response for a doubles challenge'
      using errcode = '22023';
  end if;

  if v_match.opponent_id <> v_player then
    raise exception 'only the challenged player can respond' using errcode = '42501';
  end if;

  if v_match.status <> 'pending' then
    raise exception 'this challenge is no longer pending' using errcode = '22023';
  end if;

  update public.friendly_matches
     set status = v_status,
         responded_by = v_actor,
         responded_at = now()
   where id = v_match.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'friendly.challenge.response',
    'friendly_matches',
    v_match.id,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object('status', v_status)
  );

  return jsonb_build_object('id', v_match.id, 'status', v_status);
end;
$function$;

comment on function public.respond_friendly_challenge(uuid, boolean) is
  'Accept or decline a pending singles challenge. Challenged player only. Doubles uses respond_doubles_friendly_challenge.';

-- ---------------------------------------------------------------------------
-- respond_doubles_friendly_challenge
-- ---------------------------------------------------------------------------
create function public.respond_doubles_friendly_challenge(
  p_match_id uuid,
  p_accept boolean,
  p_partner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid := public.require_friendly_player();
  v_match public.friendly_matches%rowtype;
  v_partner public.players%rowtype;
  v_status text := case when p_accept then 'accepted' else 'declined' end;
begin
  select * into v_match
    from public.friendly_matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.match_type <> 'doubles' then
    raise exception 'this is not a doubles challenge' using errcode = '22023';
  end if;

  if v_match.opponent_id <> v_player then
    raise exception 'only the challenged player can respond' using errcode = '42501';
  end if;

  if v_match.status <> 'pending' then
    raise exception 'this challenge is no longer pending' using errcode = '22023';
  end if;

  if p_accept then
    if p_partner_id is null then
      raise exception 'choose a doubles partner' using errcode = '22023';
    end if;

    if coalesce(
      p_partner_id = v_match.challenger_id
      or p_partner_id = v_match.challenger_partner_id
      or p_partner_id = v_match.opponent_id,
      false
    ) then
      raise exception 'choose a different partner' using errcode = '22023';
    end if;

    select * into v_partner
      from public.players as p
     where p.id = p_partner_id
       and p.status = 'active';

    if not found then
      raise exception 'that partner is not available' using errcode = '22023';
    end if;

    if v_partner.profile_id is null then
      raise exception 'that partner has no linked account yet' using errcode = '22023';
    end if;

    -- The same two teams may not hold two open friendlies at once.
    if exists (
      select 1
        from public.friendly_matches as m
       where m.id <> v_match.id
         and m.status in ('pending', 'accepted', 'awaiting_approval')
         and m.match_type = 'doubles'
         and (
           (m.challenger_id = v_match.challenger_id
             and m.challenger_partner_id = v_match.challenger_partner_id
             and m.opponent_id = v_match.opponent_id
             and m.opponent_partner_id = p_partner_id)
           or
           (m.challenger_id = v_match.opponent_id
             and m.challenger_partner_id = p_partner_id
             and m.opponent_id = v_match.challenger_id
             and m.opponent_partner_id = v_match.challenger_partner_id)
         )
    ) then
      raise exception 'these two teams already have an open friendly'
        using errcode = '23505';
    end if;
  end if;

  update public.friendly_matches
     set status = v_status,
         opponent_partner_id = case when p_accept then p_partner_id else null end,
         responded_by = v_actor,
         responded_at = now()
   where id = v_match.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'friendly.challenge.response',
    'friendly_matches',
    v_match.id,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object(
      'status', v_status,
      'match_type', 'doubles',
      'opponent_partner_id', case when p_accept then p_partner_id else null end
    )
  );

  return jsonb_build_object(
    'id', v_match.id,
    'status', v_status,
    'match_type', 'doubles'
  );
end;
$function$;

comment on function public.respond_doubles_friendly_challenge(uuid, boolean, uuid) is
  'Accept or decline a pending doubles challenge. The challenged captain accepts and names the opposing partner.';

revoke all on function public.respond_doubles_friendly_challenge(uuid, boolean, uuid)
  from public, anon;
grant execute on function public.respond_doubles_friendly_challenge(uuid, boolean, uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- submit_friendly_result: either winning partner may submit once
-- ---------------------------------------------------------------------------
create or replace function public.submit_friendly_result(
  p_match_id uuid,
  p_winner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid := public.require_friendly_player();
  v_match public.friendly_matches%rowtype;
  v_due timestamptz;
  v_is_winner_side boolean;
begin
  select * into v_match
    from public.friendly_matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if not coalesce(
    v_player = v_match.challenger_id
    or v_player = v_match.opponent_id
    or v_player = v_match.challenger_partner_id
    or v_player = v_match.opponent_partner_id,
    false
  ) then
    raise exception 'only the players in this match can submit a result'
      using errcode = '42501';
  end if;

  if v_match.status <> 'accepted' then
    raise exception 'only an accepted challenge can take a result'
      using errcode = '22023';
  end if;

  if p_winner_id is null
    or p_winner_id not in (v_match.challenger_id, v_match.opponent_id) then
    raise exception 'the winner must be one of the two teams' using errcode = '22023';
  end if;

  v_is_winner_side := coalesce(
    (p_winner_id = v_match.challenger_id
      and (v_player = v_match.challenger_id
        or v_player = v_match.challenger_partner_id))
    or (p_winner_id = v_match.opponent_id
      and (v_player = v_match.opponent_id
        or v_player = v_match.opponent_partner_id)),
    false
  );

  if not v_is_winner_side then
    if v_match.match_type = 'singles' then
      raise exception 'only the winner can submit the result' using errcode = '42501';
    else
      raise exception 'only the winning team can submit the result' using errcode = '42501';
    end if;
  end if;

  v_due := now() + interval '24 hours';

  update public.friendly_matches
     set status = 'awaiting_approval',
         winner_id = p_winner_id,
         submitted_by = v_actor,
         submitted_at = now(),
         auto_approval_due_at = v_due,
         challenger_approved_at = null,
         challenger_partner_approved_at = null,
         opponent_approved_at = null,
         opponent_partner_approved_at = null
   where id = v_match.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'friendly.result.submitted',
    'friendly_matches',
    v_match.id,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object(
      'status', 'awaiting_approval',
      'match_type', v_match.match_type,
      'winner_id', p_winner_id,
      'submitted_by_player_id', v_player,
      'auto_approval_due_at', v_due
    )
  );

  return jsonb_build_object(
    'id', v_match.id,
    'status', 'awaiting_approval',
    'match_type', v_match.match_type
  );
end;
$function$;

comment on function public.submit_friendly_result(uuid, uuid) is
  'The winning side submits the winning captain. Either winning partner may submit a doubles result once. Starts the 24-hour approval window.';

-- ---------------------------------------------------------------------------
-- approve_friendly_result: both losing partners, or the deadline
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
  v_losing_team uuid[];
  v_complete boolean := false;
  v_approvals integer := 0;
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

  v_losing_team := public.friendly_team(v_match.id, false);

  if v_player = v_match.winner_id then
    raise exception 'the winner cannot approve their own result' using errcode = '42501';
  end if;

  if not (v_player = any(v_losing_team)) then
    raise exception 'only the losing side can approve a result'
      using errcode = '42501';
  end if;

  update public.friendly_matches
     set challenger_approved_at =
           case when v_player = challenger_id then now() else challenger_approved_at end,
         challenger_partner_approved_at =
           case when v_player = challenger_partner_id then now()
             else challenger_partner_approved_at end,
         opponent_approved_at =
           case when v_player = opponent_id then now() else opponent_approved_at end,
         opponent_partner_approved_at =
           case when v_player = opponent_partner_id then now()
             else opponent_partner_approved_at end
   where id = v_match.id
  returning * into v_match;

  if v_match.match_type = 'singles' then
    v_complete := true;
  elsif coalesce(
    v_match.winner_id = v_match.challenger_id
    or v_match.winner_id = v_match.challenger_partner_id,
    false
  ) then
    v_complete := v_match.opponent_approved_at is not null
      and v_match.opponent_partner_approved_at is not null;
  else
    v_complete := v_match.challenger_approved_at is not null
      and v_match.challenger_partner_approved_at is not null;
  end if;

  if v_complete then
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
      jsonb_build_object('status', 'awaiting_approval'),
      jsonb_build_object(
        'status', 'confirmed',
        'match_type', v_match.match_type,
        'winner_id', v_match.winner_id
      )
    );

    perform public.award_friendly_sp(v_match.id);

    return jsonb_build_object(
      'id', v_match.id,
      'status', 'confirmed',
      'match_type', v_match.match_type
    );
  end if;

  v_approvals := case
    when coalesce(
      v_match.winner_id = v_match.challenger_id
      or v_match.winner_id = v_match.challenger_partner_id,
      false
    )
      then (case when v_match.opponent_approved_at is not null then 1 else 0 end)
        + (case when v_match.opponent_partner_approved_at is not null then 1 else 0 end)
    else (case when v_match.challenger_approved_at is not null then 1 else 0 end)
      + (case when v_match.challenger_partner_approved_at is not null then 1 else 0 end)
  end;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'friendly.result.partner_approved',
    'friendly_matches',
    v_match.id,
    jsonb_build_object(
      'status', 'awaiting_approval',
      'match_type', v_match.match_type,
      'approving_player_id', v_player,
      'approvals', v_approvals
    )
  );

  return jsonb_build_object(
    'id', v_match.id,
    'status', 'awaiting_approval',
    'match_type', v_match.match_type,
    'approvals', v_approvals
  );
end;
$function$;

comment on function public.approve_friendly_result(uuid) is
  'A losing player approves. Singles confirms immediately. Doubles confirms when both losing partners approve; a silent partner still auto-approves at the deadline.';

-- ---------------------------------------------------------------------------
-- dispute_friendly_result: either losing partner can freeze the result
-- ---------------------------------------------------------------------------
create or replace function public.dispute_friendly_result(
  p_match_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid := public.require_friendly_player();
  v_match public.friendly_matches%rowtype;
  v_losing_team uuid[];
  v_reason text := btrim(coalesce(p_reason, ''));
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

  v_losing_team := public.friendly_team(v_match.id, false);

  if v_player = v_match.winner_id then
    raise exception 'the winner cannot dispute their own result' using errcode = '42501';
  end if;

  if not (v_player = any(v_losing_team)) then
    raise exception 'only the losing side can dispute a result'
      using errcode = '42501';
  end if;

  if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'a dispute needs a reason between 5 and 500 characters'
      using errcode = '22023';
  end if;

  update public.friendly_matches
     set status = 'disputed',
         dispute_reason = v_reason,
         disputed_at = now(),
         responded_by = v_actor,
         responded_at = now()
   where id = v_match.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'friendly.result.disputed',
    'friendly_matches',
    v_match.id,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object(
      'status', 'disputed',
      'match_type', v_match.match_type,
      'reason', v_reason,
      'disputing_player_id', v_player
    )
  );

  return jsonb_build_object(
    'id', v_match.id,
    'status', 'disputed',
    'match_type', v_match.match_type
  );
end;
$function$;

comment on function public.dispute_friendly_result(uuid, text) is
  'Either losing partner disputes with a reason. The whole doubles result is frozen. No resolution path is built while §7 rule 8 is open.';

-- ---------------------------------------------------------------------------
-- award_friendly_sp: singles and doubles, placement-aware, unplayed-aware
-- ---------------------------------------------------------------------------
create or replace function public.award_friendly_sp(p_match_id uuid)
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
  v_season uuid;
  v_winning_team uuid[];
  v_losing_team uuid[];
  v_winning_avg numeric;
  v_losing_avg numeric;
  v_is_placement boolean := false;
  v_raw numeric;
  v_magnitude integer;
  v_team uuid[];
  v_team_size integer;
  v_share_high integer;
  v_share_low integer;
  v_player uuid;
  v_opponent uuid;
  v_before integer;
  v_delta integer;
  v_after integer;
  v_rating text;
  v_won boolean;
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

  if v_match.match_type = 'doubles'
    and (v_match.challenger_partner_id is null or v_match.opponent_partner_id is null) then
    raise exception 'a doubles friendly needs both teams before it can award'
      using errcode = '22023';
  end if;

  -- D18: an unplayed outcome is an official result but moves no SP.
  if v_match.result_kind not in ('played', 'retirement') then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'unplayed match',
      'awarded', 0
    );
  end if;

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

  -- S6: only a result finalized inside the active season's Manila date range
  -- accrues Seasonal SP. Current SP still moves normally.
  v_season := public.active_season_for(
    coalesce(v_match.confirmed_at, v_match.responded_at, now())
  );

  v_winning_team := public.friendly_team(v_match.id, true);
  v_losing_team := public.friendly_team(v_match.id, false);

  perform 1
     from public.sp_accounts as a
    where a.player_id = any(v_winning_team || v_losing_team)
    order by a.player_id
      for update;

  select avg(a.current_sp) into v_winning_avg
    from public.sp_accounts as a
   where a.player_id = any(v_winning_team);

  select avg(a.current_sp) into v_losing_avg
    from public.sp_accounts as a
   where a.player_id = any(v_losing_team);

  if v_winning_avg is null or v_losing_avg is null then
    raise exception 'both sides need an SP account before a friendly can award'
      using errcode = '22023';
  end if;

  -- D11/D15: if any participant is Unrated this is a placement match. Only
  -- Unrated participants move; Rated participants receive no row at all.
  select exists (
    select 1
      from public.players as p
     where p.id = any(v_winning_team || v_losing_team)
       and p.rating_status = 'unrated'
  ) into v_is_placement;

  v_raw := v_base + v_sensitivity * (v_losing_avg - v_winning_avg);
  v_magnitude := floor(least(greatest(v_raw, v_min), v_max) + 0.5)::integer;

  -- D13: the team adjustment is split evenly. An odd point goes to the lower
  -- player id on each side. A singles team has one member and takes it all.
  v_team_size := cardinality(v_winning_team);
  if v_team_size = 2 then
    v_share_high := (v_magnitude + 1) / 2;
    v_share_low := v_magnitude / 2;
  else
    v_share_high := v_magnitude;
    v_share_low := v_magnitude;
  end if;

  for v_player, v_before, v_rating, v_won in
    select t.player_id, a.current_sp, p.rating_status, t.won
      from (
        select unnest(v_winning_team) as player_id, true as won
        union all
        select unnest(v_losing_team), false
      ) as t
      join public.sp_accounts as a on a.player_id = t.player_id
      join public.players as p on p.id = t.player_id
     order by t.player_id
  loop
    v_team := case when v_won then v_winning_team else v_losing_team end;

    if v_is_placement and v_rating = 'rated' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if cardinality(v_team) = 2 then
      v_delta := case
        when v_player = least(v_team[1], v_team[2]) then v_share_high
        else v_share_low
      end;
    else
      v_delta := v_magnitude;
    end if;

    if not v_won then
      v_delta := -v_delta;
    end if;

    v_opponent := case when v_won then v_losing_team[1] else v_winning_team[1] end;

    if v_floor is not null and v_before + v_delta < v_floor then
      v_delta := (v_floor - v_before)::integer;
    end if;

    -- A placement credit is earned by the match, not by the size of the delta,
    -- so a zero-delta result still counts.
    if v_delta = 0 then
      if v_is_placement then
        perform public.record_placement_credit(
          v_player, 'friendly', v_match.id, v_version
        );
      end if;

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
        'match_type', v_match.match_type,
        'match_status', v_match.status,
        'winner_id', v_match.winner_id,
        'opponent_id', v_opponent,
        'season_id', case when v_is_placement then null else v_season end,
        'placement', v_is_placement,
        'rating_status', v_rating
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

      if v_is_placement then
        -- S21: a placement match accrues no Seasonal SP for anyone.
        perform public.record_placement_credit(
          v_player, 'friendly', v_match.id, v_version
        );
      elsif v_season is not null then
        -- Seasonal SP accrues with the award, never with a deduction (S1, S13).
        insert into public.season_balances (season_id, player_id, seasonal_sp)
        values (v_season, v_player, v_delta)
        on conflict (season_id, player_id) do update
          set seasonal_sp = public.season_balances.seasonal_sp + excluded.seasonal_sp,
              updated_at = now();
      end if;

      v_awarded := v_awarded + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'awarded',
    'rule_version', v_version,
    'season_id', v_season,
    'placement', v_is_placement,
    'match_type', v_match.match_type,
    'awarded', v_awarded,
    'skipped', v_skipped
  );
end;
$function$;

comment on function public.award_friendly_sp(uuid) is
  'Internal. Awards a confirmed singles or doubles friendly from the approved rule version. Doubles uses the team average and an even split with the odd point to the lower player id. A placement match moves only Unrated participants, writes a placement credit, and accrues no Seasonal SP (D11, D15, D19, S21). An unplayed result awards nothing (D18).';

revoke all on function public.award_friendly_sp(uuid) from public, anon, authenticated;

commit;
