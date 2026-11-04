-- MBC Arena - Migration 019: placement and unplayed-match SP
--
-- Implements the decisions approved by the club owner on 2026-11-04:
--
--   * D15 (placement, Path B): a new player is publicly Unrated for their first
--     10 eligible finalized matches. Provisional SP is calculated from match one
--     and kept hidden; at the 10th credit it is published unchanged, with no
--     reset and no bonus. Qualification is permanent. Existing players are
--     backfilled as Rated; no historical match is credited.
--   * D16 (hidden starting value): the existing 1,000 SP starting award becomes
--     the hidden provisional balance. `grant_starting_sp` is not changed.
--   * D17 (visibility): only a Super Admin may read a provisional value. A player
--     sees progress (for example 6/10), never the number. The public leaderboard
--     excludes Unrated players. Direct `sp_accounts` and `sp_transactions`
--     SELECT is revoked; the published views replace it.
--   * D18 (unplayed matches): walkovers, no-shows, forfeits before play,
--     withdrawals before play, and disqualifications move no SP. A retirement
--     counts only with an official final result. `matches` and
--     `friendly_matches` gain `result_kind`; an award and a placement credit are
--     written only for `played` or `retirement`.
--   * D19 (Unrated doubles share): under D11 an Unrated partner receives their
--     normal split share only. A Rated partner's share is not applied, and the
--     odd point follows the existing lower-id rule and may be discarded.
--
-- S21 is also enforced: a placement match accrues no Seasonal SP for any
-- participant, and no zero-delta row is written.
--
-- Apply after 018_seasonal_implementation.sql, before policies/019_placement.sql.
-- This migration is intentionally not idempotent.

begin;

-- ---------------------------------------------------------------------------
-- Approved placement parameters
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, value, description)
values (
  'sp.placement.match_requirement',
  '10'::jsonb,
  'Approved 2026-11-04 (D15): eligible finalized matches required to become Rated.'
)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Rating status
-- ---------------------------------------------------------------------------
alter table public.players
  add column rating_status text not null default 'unrated',
  add constraint players_rating_status_check
    check (rating_status in ('unrated', 'rated'));

comment on column public.players.rating_status is
  'D15: unrated during the first 10 eligible finalized matches; rated afterwards. Separate from membership status.';

-- Existing players are already published, so they are backfilled as Rated.
-- A player record created after this migration starts Unrated.
update public.players set rating_status = 'rated';

-- ---------------------------------------------------------------------------
-- Result vocabulary (D18)
-- ---------------------------------------------------------------------------
alter table public.friendly_matches
  add column result_kind text not null default 'played',
  add constraint friendly_matches_result_kind_check
    check (result_kind in (
      'played', 'retirement', 'walkover', 'no_show', 'forfeit',
      'withdrawal', 'disqualification'
    ));

alter table public.matches
  add column result_kind text not null default 'played',
  add constraint matches_result_kind_check
    check (result_kind in (
      'played', 'retirement', 'walkover', 'no_show', 'forfeit',
      'withdrawal', 'disqualification'
    ));

comment on column public.matches.result_kind is
  'D18: only played and retirement results move SP; the other outcomes record an official result but award nothing.';
comment on column public.friendly_matches.result_kind is
  'D18: only played and retirement results move SP.';

-- ---------------------------------------------------------------------------
-- Placement credits and qualifications
-- ---------------------------------------------------------------------------
create table public.placement_credits (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete restrict,
  source text not null,
  match_id uuid not null,
  rule_version text,
  recorded_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  constraint placement_credits_source_check
    check (source in ('friendly', 'tournament')),
  constraint placement_credits_player_match_key
    unique (source, match_id, player_id),
  constraint placement_credits_void_check
    check (
      (voided_at is null and void_reason is null and voided_by is null)
      or (voided_at is not null and void_reason is not null)
    ),
  constraint placement_credits_void_reason_check
    check (void_reason is null or char_length(void_reason) between 1 and 1000)
);

comment on table public.placement_credits is
  'D12/D15: one durable credit per eligible Unrated participant per finalized match. Voided, never deleted, when a result is invalidated.';

create index placement_credits_active_idx
  on public.placement_credits (player_id)
  where voided_at is null;

create index placement_credits_match_idx
  on public.placement_credits (source, match_id);

create table public.placement_qualifications (
  player_id uuid primary key references public.players (id) on delete restrict,
  qualified_at timestamptz not null default now(),
  rule_version text,
  credit_count integer not null,
  published_sp integer not null,
  created_at timestamptz not null default now(),
  constraint placement_qualifications_credit_count_check check (credit_count >= 1),
  constraint placement_qualifications_published_sp_check check (published_sp >= 0)
);

comment on table public.placement_qualifications is
  'D15: one immutable qualification record per player. The published value is the provisional balance at qualification, unchanged.';

create function public.prevent_placement_qualification_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'placement_qualifications is immutable';
end;
$function$;

revoke all on function public.prevent_placement_qualification_mutation() from public;

create trigger placement_qualifications_no_update_or_delete
  before update or delete on public.placement_qualifications
  for each row execute function public.prevent_placement_qualification_mutation();

create trigger placement_qualifications_no_truncate
  before truncate on public.placement_qualifications
  for each statement execute function public.prevent_placement_qualification_mutation();

alter table public.placement_credits enable row level security;
alter table public.placement_qualifications enable row level security;

-- ---------------------------------------------------------------------------
-- Non-negative Current SP
-- ---------------------------------------------------------------------------
alter table public.sp_accounts
  add constraint sp_accounts_current_sp_nonnegative
    check (current_sp >= 0) not valid;

alter table public.sp_transactions
  add constraint sp_transactions_after_nonnegative
    check (sp_after >= 0) not valid;

-- ---------------------------------------------------------------------------
-- record_placement_credit: one credit, then an exactly-once qualification
-- ---------------------------------------------------------------------------
create function public.record_placement_credit(
  p_player_id uuid,
  p_source text,
  p_match_id uuid,
  p_rule_version text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_rating text;
  v_required integer;
  v_count integer;
  v_sp integer;
  v_inserted integer := 0;
  v_qualified integer := 0;
begin
  if p_source not in ('friendly', 'tournament') then
    raise exception 'unknown placement source %', p_source using errcode = '22023';
  end if;

  select p.rating_status into v_rating
    from public.players as p
   where p.id = p_player_id
     for update;

  if not found then
    raise exception 'player not found' using errcode = 'P0002';
  end if;

  -- Placement ends once per player. A late result for an already-Rated player
  -- is an ordinary match and never adds a credit.
  if v_rating <> 'unrated' then
    return jsonb_build_object(
      'status', 'already_rated',
      'player_id', p_player_id,
      'awarded', false
    );
  end if;

  select (s.value)::integer into v_required
    from public.app_settings as s
   where s.key = 'sp.placement.match_requirement';

  if v_required is null or v_required < 1 then
    raise exception 'placement match requirement is not configured'
      using errcode = '22023';
  end if;

  insert into public.placement_credits (
    player_id,
    source,
    match_id,
    rule_version
  )
  values (p_player_id, p_source, p_match_id, p_rule_version)
  on conflict (source, match_id, player_id) do nothing;

  get diagnostics v_inserted = row_count;

  select count(*)::integer into v_count
    from public.placement_credits as c
   where c.player_id = p_player_id
     and c.voided_at is null;

  if v_count >= v_required then
    select a.current_sp into v_sp
      from public.sp_accounts as a
     where a.player_id = p_player_id;

    if v_sp is null then
      raise exception 'a placement player needs an SP account'
        using errcode = '22023';
    end if;

    insert into public.placement_qualifications (
      player_id,
      rule_version,
      credit_count,
      published_sp
    )
    values (p_player_id, p_rule_version, v_count, v_sp)
    on conflict (player_id) do nothing;

    get diagnostics v_qualified = row_count;

    if v_qualified > 0 then
      update public.players
         set rating_status = 'rated'
       where id = p_player_id;
    end if;
  end if;

  return jsonb_build_object(
    'status', case
      when v_qualified > 0 then 'qualified'
      when v_inserted > 0 then 'credited'
      else 'already_counted'
    end,
    'player_id', p_player_id,
    'credits', v_count,
    'required', v_required,
    'published_sp', case when v_qualified > 0 then v_sp else null end
  );
end;
$function$;

comment on function public.record_placement_credit(uuid, text, uuid, text) is
  'Internal. Writes one idempotent placement credit and performs the exactly-once Unrated -> Rated qualification.';

revoke all on function public.record_placement_credit(uuid, text, uuid, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- void_placement_credits: invalidation keeps the audit trail
-- ---------------------------------------------------------------------------
create function public.void_placement_credits(
  p_source text,
  p_match_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_reason text := coalesce(nullif(btrim(p_reason), ''), 'result invalidated');
  v_count integer := 0;
begin
  update public.placement_credits
     set voided_at = now(),
         voided_by = auth.uid(),
         void_reason = v_reason
   where source = p_source
     and match_id = p_match_id
     and voided_at is null;

  get diagnostics v_count = row_count;

  return v_count;
end;
$function$;

comment on function public.void_placement_credits(text, uuid, text) is
  'Internal. Voids active placement credits for an invalidated result without deleting the audit trail.';

revoke all on function public.void_placement_credits(text, uuid, text)
  from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- award_friendly_sp: placement-aware, unplayed-aware, S21-aware
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
  v_winner uuid;
  v_loser uuid;
  v_winner_sp integer;
  v_loser_sp integer;
  v_winner_rating text;
  v_loser_rating text;
  v_is_placement boolean := false;
  v_raw numeric;
  v_magnitude integer;
  v_player uuid;
  v_opponent uuid;
  v_before integer;
  v_delta integer;
  v_after integer;
  v_rating text;
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

  v_winner := v_match.winner_id;
  v_loser := case
    when v_match.winner_id = v_match.challenger_id then v_match.opponent_id
    else v_match.challenger_id
  end;

  perform 1
     from public.sp_accounts as a
    where a.player_id in (v_winner, v_loser)
    order by a.player_id
      for update;

  select a.current_sp, p.rating_status
    into v_winner_sp, v_winner_rating
    from public.sp_accounts as a
    join public.players as p on p.id = a.player_id
   where a.player_id = v_winner;

  select a.current_sp, p.rating_status
    into v_loser_sp, v_loser_rating
    from public.sp_accounts as a
    join public.players as p on p.id = a.player_id
   where a.player_id = v_loser;

  if v_winner_sp is null or v_loser_sp is null then
    raise exception 'both players need an SP account before a friendly can award'
      using errcode = '22023';
  end if;

  -- D11/D15: if either participant is Unrated this is a placement match. Only
  -- Unrated participants move; Rated participants receive no row at all.
  v_is_placement := v_winner_rating = 'unrated' or v_loser_rating = 'unrated';

  v_raw := v_base + v_sensitivity * (v_loser_sp - v_winner_sp);
  v_magnitude := floor(least(greatest(v_raw, v_min), v_max) + 0.5)::integer;

  for v_player, v_opponent, v_before, v_delta, v_rating in
    select v_winner, v_loser, v_winner_sp, v_magnitude, v_winner_rating
    union all
    select v_loser, v_winner, v_loser_sp, -v_magnitude, v_loser_rating
  loop
    if v_is_placement and v_rating = 'rated' then
      v_skipped := v_skipped + 1;
      continue;
    end if;

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
        'match_status', v_match.status,
        'winner_id', v_winner,
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
    'awarded', v_awarded,
    'skipped', v_skipped
  );
end;
$function$;

comment on function public.award_friendly_sp(uuid) is
  'Internal. Awards a confirmed singles friendly from the approved rule version. A placement match moves only Unrated participants, writes a placement credit, and accrues no Seasonal SP (D11, D15, S21). An unplayed result awards nothing (D18).';

revoke all on function public.award_friendly_sp(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- award_tournament_sp: placement-aware, unplayed-aware, S21-aware
-- ---------------------------------------------------------------------------
create or replace function public.award_tournament_sp(
  p_match_id uuid,
  p_rule_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match public.matches%rowtype;
  v_discipline text;
  v_version text;
  v_config jsonb;
  v_base numeric;
  v_sensitivity numeric;
  v_min numeric;
  v_max numeric;
  v_floor numeric;
  v_multiplier numeric;
  v_total integer;
  v_winner_entry uuid;
  v_loser_entry uuid;
  v_winner_players uuid[];
  v_loser_players uuid[];
  v_winner_avg numeric;
  v_loser_avg numeric;
  v_raw numeric;
  v_magnitude integer;
  v_side text;
  v_players uuid[];
  v_sign integer;
  v_count integer;
  v_share integer;
  v_remainder integer;
  v_index bigint;
  v_player uuid;
  v_before integer;
  v_delta integer;
  v_after integer;
  v_rating text;
  v_is_placement boolean := false;
  v_seq integer;
  v_key text;
  v_tx uuid;
  v_season uuid;
  v_awarded integer := 0;
  v_skipped integer := 0;
begin
  select * into v_match
    from public.matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.status <> 'completed' or v_match.winner_entry_id is null then
    raise exception 'only a completed tournament match can award SP'
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

  select e.discipline into v_discipline
    from public.tournament_events as e
   where e.id = v_match.event_id;

  -- A correction re-awards under the version that produced the original rows;
  -- a first award uses the one approved AND enabled version.
  if p_rule_version is not null then
    select r.version, r.config
      into v_version, v_config
      from public.sp_rule_versions as r
     where r.version = p_rule_version
       and r.status = 'approved';
  else
    select r.version, r.config
      into v_version, v_config
      from public.sp_rule_versions as r
     where r.is_enabled
       and r.status = 'approved';
  end if;

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

  v_multiplier := coalesce((v_config ->> 'tournamentMultiplier')::numeric, 2);

  if v_multiplier < 1 or v_multiplier <> trunc(v_multiplier) then
    raise exception 'rule version % needs a whole-number tournament multiplier', v_version
      using errcode = '22023';
  end if;

  v_winner_entry := v_match.winner_entry_id;
  v_loser_entry := case
    when v_match.winner_entry_id = v_match.home_entry_id then v_match.away_entry_id
    else v_match.home_entry_id
  end;

  -- Every linked, rated player on each side. A doubles guest has no player row
  -- and no SP; an unlinked player without an account is skipped rather than
  -- blocking a result the tournament already recorded.
  select coalesce(array_agg(x.player_id order by x.player_id), '{}')
    into v_winner_players
    from (
      select e.player_id
        from public.tournament_entries as e
       where e.id = v_winner_entry
         and e.player_id is not null
      union
      select tm.player_id
        from public.tournament_entries as e
        join public.team_members as tm on tm.team_id = e.team_id
       where e.id = v_winner_entry
    ) as x
    join public.sp_accounts as a on a.player_id = x.player_id;

  select coalesce(array_agg(x.player_id order by x.player_id), '{}')
    into v_loser_players
    from (
      select e.player_id
        from public.tournament_entries as e
       where e.id = v_loser_entry
         and e.player_id is not null
      union
      select tm.player_id
        from public.tournament_entries as e
        join public.team_members as tm on tm.team_id = e.team_id
       where e.id = v_loser_entry
    ) as x
    join public.sp_accounts as a on a.player_id = x.player_id;

  if coalesce(array_length(v_winner_players, 1), 0) = 0
     or coalesce(array_length(v_loser_players, 1), 0) = 0 then
    return jsonb_build_object(
      'status', 'skipped',
      'reason', 'both sides need at least one rated player',
      'awarded', 0
    );
  end if;

  -- Lock every affected account in a deterministic order.
  perform 1
     from public.sp_accounts as a
    where a.player_id = any(v_winner_players || v_loser_players)
    order by a.player_id
      for update;

  select exists (
    select 1
      from public.sp_accounts as a
      join public.players as p on p.id = a.player_id
     where a.player_id = any(v_winner_players || v_loser_players)
       and p.rating_status = 'unrated'
  ) into v_is_placement;

  select avg(a.current_sp) into v_winner_avg
    from public.sp_accounts as a
   where a.player_id = any(v_winner_players);

  select avg(a.current_sp) into v_loser_avg
    from public.sp_accounts as a
   where a.player_id = any(v_loser_players);

  -- Approved order: clamp the raw change, round half-up on the magnitude, then
  -- apply the tournament multiplier.
  v_raw := v_base + v_sensitivity * (v_loser_avg - v_winner_avg);
  v_magnitude := floor(least(greatest(v_raw, v_min), v_max) + 0.5)::integer;
  v_total := (v_magnitude * v_multiplier)::integer;

  -- S6/S7: the immutable first-finalization time decides the season. A
  -- correction of a closed-season result therefore accrues nothing in the new
  -- season, and a result finalized after the cutoff accrues nothing at all.
  v_season := public.active_season_for(
    coalesce(v_match.finalized_at, v_match.recorded_at)
  );

  for v_side, v_players, v_sign in
    select 'winner', v_winner_players, 1
    union all
    select 'loser', v_loser_players, -1
  loop
    v_count := array_length(v_players, 1);
    v_share := v_total / v_count;
    v_remainder := v_total % v_count;

    for v_player, v_index in
      select p, i
        from unnest(v_players) with ordinality as t(p, i)
       order by p
    loop
      select a.current_sp, p.rating_status
        into v_before, v_rating
        from public.sp_accounts as a
        join public.players as p on p.id = a.player_id
       where a.player_id = v_player;

      -- D11/D19: a Rated participant in a placement match receives no row. The
      -- Unrated partner keeps their normal share; the Rated share is discarded.
      if v_is_placement and v_rating = 'rated' then
        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_delta := v_sign * (
        v_share + case when v_index <= v_remainder then 1 else 0 end
      );

      if v_floor is not null and v_before + v_delta < v_floor then
        v_delta := (v_floor - v_before)::integer;
      end if;

      -- A placement credit is earned by the match, not by the size of the delta,
      -- so a zero-delta result still counts.
      if v_delta = 0 then
        if v_is_placement then
          perform public.record_placement_credit(
            v_player, 'tournament', p_match_id, v_version
          );
        end if;

        v_skipped := v_skipped + 1;
        continue;
      end if;

      v_after := v_before + v_delta;

      -- One award generation per reversal: a replay maps to the same key and is
      -- a no-op, while a correction (which writes a reversal first) advances it.
      select count(*) + 1 into v_seq
        from public.sp_transactions as r
       where r.transaction_type = 'reversal'
         and r.reference_type = 'correction'
         and r.player_id = v_player
         and r.metadata ->> 'match_id' = p_match_id::text;

      v_key := case
        when v_seq = 1 then format('tournament:%s:%s', p_match_id, v_player)
        else format('tournament:%s:%s:%s', p_match_id, v_player, v_seq)
      end;

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
        'tournament',
        v_before,
        v_delta,
        v_after,
        'match',
        p_match_id,
        v_version,
        v_key,
        jsonb_build_object(
          'source', 'tournament',
          'match_id', p_match_id,
          'event_id', v_match.event_id,
          'discipline', v_discipline,
          'side', v_side,
          'team_total', v_total,
          'team_share_count', v_count,
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
            v_player, 'tournament', p_match_id, v_version
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
  end loop;

  return jsonb_build_object(
    'status', 'awarded',
    'rule_version', v_version,
    'season_id', v_season,
    'placement', v_is_placement,
    'team_total', v_total,
    'awarded', v_awarded,
    'skipped', v_skipped
  );
end;
$function$;

comment on function public.award_tournament_sp(uuid, text) is
  'Internal. Awards a completed tournament match from the approved rule version. A placement match moves only Unrated participants, writes placement credits, and accrues no Seasonal SP (D11, D15, D19, S21). An unplayed result awards nothing (D18).';

revoke all on function public.award_tournament_sp(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- correct_match_result: reset result_kind and award an unplayed -> played fix
-- ---------------------------------------------------------------------------
create or replace function public.correct_match_result(
  p_match_id uuid,
  p_games jsonb,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_match public.matches%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_before jsonb;
  v_result jsonb;
  v_original_winner uuid;
  v_original_kind text;
  v_original_version text;
  v_reversal jsonb;
  v_award jsonb;
begin
  v_actor := public.require_tournament_staff();

  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'a correction reason is required' using errcode = '22023';
  end if;

  select *
    into v_match
    from public.matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.status <> 'completed' then
    raise exception 'only a completed match can be corrected' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.matches as m
     where (m.home_source_match_id = p_match_id or m.away_source_match_id = p_match_id)
       and (
         m.status not in ('pending', 'cancelled')
         or exists (select 1 from public.match_games as g where g.match_id = m.id)
       )
  ) then
    raise exception 'a downstream match already has a result; correct that one first'
      using errcode = '22023';
  end if;

  select jsonb_build_object(
      'status', v_match.status,
      'winner_entry_id', v_match.winner_entry_id,
      'result_kind', v_match.result_kind,
      'games', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'game_number', g.game_number,
              'home_points', g.home_points,
              'away_points', g.away_points
            )
            order by g.game_number
          )
          from public.match_games as g
         where g.match_id = p_match_id
        ),
        '[]'::jsonb
      )
    )
    into v_before;

  -- F4: a winner flip reverses every award on the match, then re-awards under
  -- the version that produced the original rows. A score-only correction that
  -- keeps the same winner writes no SP rows at all. A correction that turns an
  -- unplayed outcome into a played result awards for the first time.
  v_original_winner := v_match.winner_entry_id;
  v_original_kind := v_match.result_kind;

  select t.rule_version into v_original_version
    from public.sp_transactions as t
   where t.reference_type = 'match'
     and t.reference_id = p_match_id
     and t.transaction_type = 'tournament'
   order by t.created_at asc, t.id asc
   limit 1;

  update public.matches as m
     set home_entry_id = case when m.home_source_match_id = p_match_id then null else m.home_entry_id end,
         away_entry_id = case when m.away_source_match_id = p_match_id then null else m.away_entry_id end,
         status = case when m.reset and m.status = 'cancelled' then 'pending' else m.status end,
         winner_entry_id = case when m.reset and m.status = 'cancelled' then null else m.winner_entry_id end,
         recorded_by = case when m.reset and m.status = 'cancelled' then null else m.recorded_by end,
         recorded_at = case when m.reset and m.status = 'cancelled' then null else m.recorded_at end
   where m.home_source_match_id = p_match_id or m.away_source_match_id = p_match_id;

  delete from public.match_games as g where g.match_id = p_match_id;

  update public.matches
     set winner_entry_id = null,
         status = 'pending',
         result_kind = 'played',
         recorded_by = null,
         recorded_at = null
   where id = p_match_id;

  v_result := public.apply_match_result(p_match_id, p_games, v_actor);

  if v_original_kind in ('played', 'retirement')
     and (v_result ->> 'winner_entry_id')::uuid = v_original_winner then
    v_reversal := jsonb_build_object('status', 'unchanged', 'reversed', 0, 'skipped', 0);
    v_award := jsonb_build_object(
      'status', 'unchanged',
      'reason', 'the winner did not change',
      'awarded', 0
    );
  else
    if v_original_kind in ('played', 'retirement') then
      v_reversal := public.reverse_tournament_sp(p_match_id, v_reason);
    else
      v_reversal := jsonb_build_object(
        'status', 'not_needed',
        'reason', 'the original result was unplayed',
        'reversed', 0,
        'skipped', 0
      );
    end if;

    v_award := public.award_tournament_sp(p_match_id, v_original_version);
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.match_result_corrected',
    'matches',
    p_match_id,
    v_before,
    v_result || jsonb_build_object(
      'reason', v_reason,
      'sp_reversal', v_reversal,
      'sp_award', v_award
    )
  );

  return v_result || jsonb_build_object(
    'sp_reversal', v_reversal,
    'sp_award', v_award
  );
end;
$function$;

comment on function public.correct_match_result(uuid, jsonb, text) is
  'Replaces a result and re-advances it while downstream matches are unplayed. Reverses a winner flip and re-awards under the original rule version; a score-only correction writes no SP rows, and an unplayed -> played correction awards for the first time (F4, D18).';

revoke all on function public.correct_match_result(uuid, jsonb, text) from public, anon;
grant execute on function public.correct_match_result(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- mark_match_unplayed: record an official unplayed outcome, move no SP
-- ---------------------------------------------------------------------------
create function public.mark_match_unplayed(
  p_match_id uuid,
  p_winner_entry_id uuid,
  p_result_kind text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_match public.matches%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
  v_original_kind text;
  v_winner uuid;
  v_loser uuid;
  v_reversal jsonb := '{}'::jsonb;
  v_voided integer := 0;
  v_reset public.matches%rowtype;
begin
  v_actor := public.require_tournament_staff();

  if v_reason is null or char_length(v_reason) > 1000 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;

  if p_result_kind not in (
    'walkover', 'no_show', 'forfeit', 'withdrawal', 'disqualification'
  ) then
    raise exception 'unknown unplayed result kind' using errcode = '22023';
  end if;

  select *
    into v_match
    from public.matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.status not in ('pending', 'completed') then
    raise exception 'only a pending or completed match can record an unplayed outcome'
      using errcode = '22023';
  end if;

  if v_match.home_entry_id is null or v_match.away_entry_id is null then
    raise exception 'both sides must be decided before recording a result'
      using errcode = '22023';
  end if;

  if p_winner_entry_id not in (v_match.home_entry_id, v_match.away_entry_id) then
    raise exception 'the winner must be one of the two entries' using errcode = '22023';
  end if;

  if v_match.status = 'completed' and exists (
    select 1
      from public.matches as m
     where (m.home_source_match_id = p_match_id or m.away_source_match_id = p_match_id)
       and (
         m.status not in ('pending', 'cancelled')
         or exists (select 1 from public.match_games as g where g.match_id = m.id)
       )
  ) then
    raise exception 'a downstream match already has a result; correct that one first'
      using errcode = '22023';
  end if;

  v_original_kind := v_match.result_kind;

  -- F4/D18: a played result that becomes unplayed reverses its SP and voids its
  -- placement credits. The ledger and the credit trail are never deleted.
  if v_match.status = 'completed' and v_original_kind in ('played', 'retirement') then
    v_reversal := public.reverse_tournament_sp(p_match_id, v_reason);
  end if;

  v_voided := public.void_placement_credits('tournament', p_match_id, v_reason);

  update public.matches as m
     set home_entry_id = case when m.home_source_match_id = p_match_id then null else m.home_entry_id end,
         away_entry_id = case when m.away_source_match_id = p_match_id then null else m.away_entry_id end,
         status = case when m.reset and m.status = 'cancelled' then 'pending' else m.status end,
         winner_entry_id = case when m.reset and m.status = 'cancelled' then null else m.winner_entry_id end,
         recorded_by = case when m.reset and m.status = 'cancelled' then null else m.recorded_by end,
         recorded_at = case when m.reset and m.status = 'cancelled' then null else m.recorded_at end
   where m.home_source_match_id = p_match_id or m.away_source_match_id = p_match_id;

  delete from public.match_games as g where g.match_id = p_match_id;

  update public.matches
     set winner_entry_id = p_winner_entry_id,
         status = 'completed',
         result_kind = p_result_kind,
         recorded_by = v_actor,
         recorded_at = now()
   where id = p_match_id;

  v_winner := p_winner_entry_id;
  v_loser := case
    when p_winner_entry_id = v_match.home_entry_id then v_match.away_entry_id
    else v_match.home_entry_id
  end;

  update public.matches as m
     set home_entry_id = case
           when m.home_source_outcome = 'winner' then v_winner
           else v_loser
         end
   where m.home_source_match_id = p_match_id;

  update public.matches as m
     set away_entry_id = case
           when m.away_source_outcome = 'winner' then v_winner
           else v_loser
         end
   where m.away_source_match_id = p_match_id;

  if v_match.bracket = 'grand_final' and not v_match.reset then
    select *
      into v_reset
      from public.matches as m
     where m.event_id = v_match.event_id
       and m.reset
       and m.home_source_match_id = p_match_id
       for update;

    if found and v_winner = v_match.home_entry_id then
      update public.matches
         set status = 'cancelled',
             winner_entry_id = v_winner,
             recorded_by = v_actor,
             recorded_at = now()
       where id = v_reset.id;
    end if;
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.match_unplayed',
    'matches',
    p_match_id,
    jsonb_build_object(
      'reason', v_reason,
      'result_kind', p_result_kind,
      'winner_entry_id', v_winner,
      'sp_reversal', v_reversal,
      'voided_credits', v_voided
    )
  );

  return jsonb_build_object(
    'status', 'recorded',
    'match_id', p_match_id,
    'result_kind', p_result_kind,
    'winner_entry_id', v_winner,
    'loser_entry_id', v_loser,
    'sp_reversal', v_reversal,
    'voided_credits', v_voided
  );
end;
$function$;

comment on function public.mark_match_unplayed(uuid, uuid, text, text) is
  'Records an official unplayed tournament outcome (walkover, no-show, forfeit, withdrawal before play, disqualification). Advances the bracket but moves no SP and voids placement credits (D18).';

revoke all on function public.mark_match_unplayed(uuid, uuid, text, text) from public, anon;
grant execute on function public.mark_match_unplayed(uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Read exposure (D17)
-- ---------------------------------------------------------------------------
create view public.published_sp_balances as
select
  a.player_id,
  a.current_sp,
  a.updated_at
from public.sp_accounts as a
join public.players as p on p.id = a.player_id
where p.rating_status = 'rated'
  and (
    public.has_role((select auth.uid()), 'super_admin')
    or public.has_role((select auth.uid()), 'tournament_manager')
    or public.has_role((select auth.uid()), 'trainer')
    or public.has_role((select auth.uid()), 'player')
  );

comment on view public.published_sp_balances is
  'D17: Rated balances only. Replaces the direct sp_accounts SELECT for clients.';

create view public.published_sp_leaderboard as
select
  a.player_id,
  p.full_name,
  p.status,
  p.rating_status,
  a.current_sp,
  a.updated_at
from public.sp_accounts as a
join public.players as p on p.id = a.player_id
where p.rating_status = 'rated'
  and (
    public.has_role((select auth.uid()), 'super_admin')
    or public.has_role((select auth.uid()), 'tournament_manager')
    or public.has_role((select auth.uid()), 'trainer')
    or public.has_role((select auth.uid()), 'player')
  );

comment on view public.published_sp_leaderboard is
  'D17: the public Current SP leaderboard. Unrated players are excluded until qualification.';

create view public.published_sp_transactions as
select
  t.id,
  t.player_id,
  t.transaction_type,
  t.sp_before,
  t.sp_delta,
  t.sp_after,
  t.reference_type,
  t.reference_id,
  t.rule_version,
  t.metadata,
  t.created_at
from public.sp_transactions as t
join public.players as p on p.id = t.player_id
where public.has_role((select auth.uid()), 'super_admin')
   or (p.rating_status = 'rated' and p.profile_id = (select auth.uid()));

comment on view public.published_sp_transactions is
  'D17: a Super Admin sees every ledger row; a player sees their own rows only after qualification.';

create view public.placement_progress as
select
  p.id as player_id,
  p.rating_status,
  coalesce(c.credits, 0) as credits,
  coalesce(
    (select (s.value)::integer from public.app_settings as s
      where s.key = 'sp.placement.match_requirement'),
    10
  ) as required,
  q.qualified_at
from public.players as p
left join (
  select player_id, count(*)::integer as credits
    from public.placement_credits
   where voided_at is null
   group by player_id
) as c on c.player_id = p.id
left join public.placement_qualifications as q on q.player_id = p.id
where (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

comment on view public.placement_progress is
  'D15/D17: visible placement progress. It never exposes the provisional SP value.';

create view public.placement_audit as
select
  p.id as player_id,
  p.full_name,
  p.rating_status,
  a.current_sp,
  coalesce(c.credits, 0) as credits,
  coalesce(
    (select (s.value)::integer from public.app_settings as s
      where s.key = 'sp.placement.match_requirement'),
    10
  ) as required,
  q.qualified_at,
  q.published_sp,
  q.rule_version as qualification_rule_version
from public.players as p
join public.sp_accounts as a on a.player_id = p.id
left join (
  select player_id, count(*)::integer as credits
    from public.placement_credits
   where voided_at is null
   group by player_id
) as c on c.player_id = p.id
left join public.placement_qualifications as q on q.player_id = p.id
where public.has_role((select auth.uid()), 'super_admin');

comment on view public.placement_audit is
  'D17: Super Admin-only audit of provisional balances, credits, and qualifications.';

commit;
