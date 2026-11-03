-- MBC Arena - Migration 017: tournament match SP award
--
-- The §7.1 formula is approved (D13) and the `approved-2026-11` rule version is
-- enabled (migration 016), so a completed tournament match can now move SP.
-- This migration adds the tournament award and the compensating reversal that
-- F4 requires. It ships no new numbers: every value comes from the rule version.
--
--   * award_tournament_sp() reads either the single approved+enabled version
--     (first award) or the version that produced the original rows (re-award
--     after a correction, per F4). It computes one team adjustment from the two
--     team averages with the approved order - clamp, round half-up, then apply
--     the tournament multiplier - and splits it across the rated players.
--   * A doubles team uses the average of its rated partners and splits the team
--     adjustment evenly; an odd point goes to the lower player id. A guest has
--     no player row and no SP, so a team's rated players share the adjustment.
--   * Ledger rows are keyed tournament:<match>:<player> (then :2, :3, ... for a
--     re-award), so a retry or a replayed finalizer is a no-op. Seasonal SP
--     accrues for the active season (S1, S13).
--   * reverse_tournament_sp() writes append-only `reversal` rows keyed to the
--     original row. It never edits or deletes a ledger row, and it restores the
--     prior balance without pushing a player below the 0 floor.
--   * record_match_result() and correct_match_result() are superseded so the
--     award, the reversal, and the re-award happen in the result transaction.
--     A correction re-awards under the ORIGINAL rule version (F4); a
--     score-only correction that keeps the winner writes no SP rows.
--
-- Still absent: placement, walkover/forfeit SP, and any manual adjustment. A
-- match can never award against an unapproved rule.
--
-- Apply after 016_approved_sp_rule.sql. No new table, no new policy, and no
-- client grant: both helpers are internal. This migration is intentionally not
-- idempotent.

begin;

-- ---------------------------------------------------------------------------
-- award_tournament_sp: one completed tournament match -> one row per rated player
-- ---------------------------------------------------------------------------
create function public.award_tournament_sp(
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

  select s.id into v_season
    from public.seasons as s
   where s.status = 'active';

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
      select a.current_sp into v_before
        from public.sp_accounts as a
       where a.player_id = v_player;

      v_delta := v_sign * (
        v_share + case when v_index <= v_remainder then 1 else 0 end
      );

      if v_floor is not null and v_before + v_delta < v_floor then
        v_delta := (v_floor - v_before)::integer;
      end if;

      -- A zero change is not a ledger row (sp_delta <> 0).
      if v_delta = 0 then
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
          'season_id', v_season
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

        -- Seasonal SP accrues with the award, never with a deduction (S1, S13).
        if v_season is not null then
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
    'team_total', v_total,
    'awarded', v_awarded,
    'skipped', v_skipped
  );
end;
$function$;

comment on function public.award_tournament_sp(uuid, text) is
  'Internal. Awards a completed tournament match from the approved rule version, accrues Seasonal SP, and re-awards a corrected result under the original version. Idempotent per player.';

revoke all on function public.award_tournament_sp(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- reverse_tournament_sp: compensating rows for a corrected or voided result
-- ---------------------------------------------------------------------------
create function public.reverse_tournament_sp(p_match_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_row public.sp_transactions%rowtype;
  v_before integer;
  v_delta integer;
  v_after integer;
  v_key text;
  v_tx uuid;
  v_season uuid;
  v_reversed integer := 0;
  v_skipped integer := 0;
begin
  perform 1
     from public.sp_accounts as a
    where a.player_id in (
      select t.player_id
        from public.sp_transactions as t
       where t.reference_type = 'match'
         and t.reference_id = p_match_id
         and t.transaction_type = 'tournament'
    )
    order by a.player_id
      for update;

  for v_row in
    select t.*
      from public.sp_transactions as t
     where t.reference_type = 'match'
       and t.reference_id = p_match_id
       and t.transaction_type = 'tournament'
       and not exists (
         select 1
           from public.sp_transactions as r
          where r.idempotency_key = t.idempotency_key || ':reversal'
       )
     order by t.player_id, t.created_at
       for update
  loop
    select a.current_sp into v_before
      from public.sp_accounts as a
     where a.player_id = v_row.player_id;

    if v_before is null then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_delta := -v_row.sp_delta;

    -- A reversal restores the prior balance but never pushes a player below 0.
    if v_before + v_delta < 0 then
      v_delta := -v_before;
    end if;

    if v_delta = 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_after := v_before + v_delta;
    v_key := v_row.idempotency_key || ':reversal';
    v_season := (v_row.metadata ->> 'season_id')::uuid;

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
      v_row.player_id,
      'reversal',
      v_before,
      v_delta,
      v_after,
      'correction',
      v_row.id,
      v_row.rule_version,
      v_key,
      jsonb_build_object(
        'source', 'tournament',
        'match_id', p_match_id,
        'reason', nullif(btrim(p_reason), ''),
        'original_transaction_id', v_row.id,
        'original_key', v_row.idempotency_key
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
       where player_id = v_row.player_id;

      -- A closed season is never rewritten (S7, S19): only an active season's
      -- balance is reduced by the reversal.
      if v_season is not null and exists (
        select 1
          from public.seasons as s
         where s.id = v_season
           and s.status = 'active'
      ) then
        update public.season_balances
           set seasonal_sp = seasonal_sp + v_delta,
               updated_at = now()
         where season_id = v_season
           and player_id = v_row.player_id;
      end if;

      v_reversed := v_reversed + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'status', 'reversed',
    'reversed', v_reversed,
    'skipped', v_skipped
  );
end;
$function$;

comment on function public.reverse_tournament_sp(uuid, text) is
  'Internal. Writes append-only reversal rows for every tournament award on a match, keyed to the original row. Idempotent.';

revoke all on function public.reverse_tournament_sp(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- record_match_result: unchanged, plus the award in the same transaction
-- ---------------------------------------------------------------------------
create or replace function public.record_match_result(p_match_id uuid, p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_match public.matches%rowtype;
  v_result jsonb;
  v_award jsonb;
begin
  v_actor := public.require_tournament_staff();

  select *
    into v_match
    from public.matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.status <> 'pending' then
    raise exception 'match already has a result; correct it instead' using errcode = '22023';
  end if;

  v_result := public.apply_match_result(p_match_id, p_games, v_actor);
  v_award := public.award_tournament_sp(p_match_id);

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.match_result',
    'matches',
    p_match_id,
    v_result || jsonb_build_object('sp_award', v_award)
  );

  return v_result || jsonb_build_object('sp_award', v_award);
end;
$function$;

comment on function public.record_match_result(uuid, jsonb) is
  'Records the first result for a ready match, advances the winner/loser, audits, and awards tournament SP from the approved rule version.';

revoke all on function public.record_match_result(uuid, jsonb) from public, anon;
grant execute on function public.record_match_result(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- correct_match_result: reverse, replace, re-award under the original version
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
  -- keeps the same winner writes no SP rows at all.
  v_original_winner := v_match.winner_entry_id;

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
         recorded_by = null,
         recorded_at = null
   where id = p_match_id;

  v_result := public.apply_match_result(p_match_id, p_games, v_actor);

  if (v_result ->> 'winner_entry_id')::uuid = v_original_winner then
    v_reversal := jsonb_build_object('status', 'unchanged', 'reversed', 0, 'skipped', 0);
    v_award := jsonb_build_object(
      'status', 'unchanged',
      'reason', 'the winner did not change',
      'awarded', 0
    );
  else
    v_reversal := public.reverse_tournament_sp(p_match_id, v_reason);
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
  'Replaces a result and re-advances it while downstream matches are unplayed. Reverses a winner flip and re-awards under the original rule version (a score-only correction writes no SP rows), and audits with a reason.';

revoke all on function public.correct_match_result(uuid, jsonb, text) from public, anon;
grant execute on function public.correct_match_result(uuid, jsonb, text) to authenticated;

commit;
