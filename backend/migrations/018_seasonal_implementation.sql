-- MBC Arena - Migration 018: seasonal implementation (S1-S23)
--
-- Migration 012 shipped the seasonal tables and the basic close/batch RPCs. This
-- migration completes the approved rules:
--
--   * S5/S6/S7 finalization time: matches gain an immutable `finalized_at` that a
--     correction never moves. Seasonal SP and the S18 tie-break therefore keep a
--     match in the season it was first finalized in; a result finalized after the
--     cutoff contributes no Seasonal SP to the closed season and none to the new
--     season either.
--   * S10/S11/S16/S17 eligibility: only an active, linked player with an SP
--     account is ranked. Zero matches keeps the last earned position; a negative
--     balance is excluded but still deducted at its previous tier; a player with
--     no matches and no previous ranking is unranked; a zero balance with no
--     previous ranking is ranked but not deducted.
--   * S18 tie-break statistics: wins, tournament wins, game difference, and
--     point difference are computed from eligible finalized official tournament
--     matches. Friendlies feed Seasonal SP only.
--   * S19 snapshot: one immutable row per Rated player with the full statistics,
--     the deduction position, and a reason code for every excluded player.
--   * S20 transition: one idempotent RPC runs close -> snapshot -> batch ->
--     activate -> reset, with per-step checkpoints, bounded retries, an in-app
--     Super Admin notification after repeated failures, and a safe re-run.
--   * S15 live leaderboard: `seasonal_standings()` returns the provisional live
--     table while the season is open and reads the frozen snapshot once closed.
--
-- "Rated" is represented by having an SP account until the placement system
-- (§7.2) is approved and implemented. Unrated players are outside the seasonal
-- system, so they receive no snapshot row and no deduction.
--
-- Still absent: placement, walkover/forfeit SP, a seasonal playoff (S22), and any
-- email or push channel. Apply after 017_tournament_sp_award.sql, before
-- backend/policies/018_seasons.sql. This migration is intentionally not
-- idempotent.

begin;

-- ---------------------------------------------------------------------------
-- matches.finalized_at: the immutable first-finalization time (S5, S6, S7)
-- ---------------------------------------------------------------------------
alter table public.matches
  add column finalized_at timestamptz;

comment on column public.matches.finalized_at is
  'When the match first became completed. A correction never moves it, so S5/S6/S7 keep the result in its original season.';

update public.matches
   set finalized_at = recorded_at
 where status = 'completed'
   and recorded_at is not null;

create function public.matches_set_finalized_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' and new.recorded_at is not null then
      new.finalized_at := coalesce(new.finalized_at, new.recorded_at);
    end if;
  elsif new.status = 'completed' and new.recorded_at is not null then
    new.finalized_at := coalesce(old.finalized_at, new.finalized_at, new.recorded_at);
  end if;

  return new;
end;
$function$;

comment on function public.matches_set_finalized_at() is
  'Internal. Stamps the first completion time once and preserves it through every correction.';

revoke all on function public.matches_set_finalized_at() from public, anon, authenticated;

create trigger matches_set_finalized_at
  before insert or update on public.matches
  for each row execute function public.matches_set_finalized_at();

-- ---------------------------------------------------------------------------
-- Snapshot statistics and exclusion reasons (S18, S19)
-- ---------------------------------------------------------------------------
alter table public.season_player_results
  add column tournament_matches integer,
  add column tournament_wins integer,
  add column game_difference integer,
  add column point_difference integer,
  add column deduction_position integer,
  add column previous_position integer;

alter table public.season_player_results
  drop constraint season_player_results_reason_check;

alter table public.season_player_results
  add constraint season_player_results_reason_check
  check (
    excluded_reason is null
    or excluded_reason in (
      'negative_seasonal_sp',
      'no_eligible_matches',
      'inactive_or_unlinked'
    )
  );

alter table public.season_player_results
  add constraint season_player_results_deduction_position_check
  check (deduction_position is null or deduction_position >= 1),
  add constraint season_player_results_previous_position_check
  check (previous_position is null or previous_position >= 1);

comment on column public.season_player_results.tournament_matches is
  'Eligible finalized official tournament matches used for the S18 tie-break.';
comment on column public.season_player_results.tournament_wins is
  'Wins in eligible finalized official tournament matches (S18).';
comment on column public.season_player_results.game_difference is
  'Games won minus games lost in eligible tournament matches (S18).';
comment on column public.season_player_results.point_difference is
  'Points scored minus points conceded in eligible tournament matches (S18).';
comment on column public.season_player_results.deduction_position is
  'The position that decides the S8 tier. It can be a previous position when the player is negative or has no matches (S10, S11).';
comment on column public.season_player_results.previous_position is
  'The last earned position before this season, retained for S10/S11/S23.';

-- ---------------------------------------------------------------------------
-- season_transitions: one resumable transition per closing season (S20)
-- ---------------------------------------------------------------------------
create table public.season_transitions (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  status text not null default 'running',
  attempts integer not null default 0,
  last_error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint season_transitions_season_key unique (season_id),
  constraint season_transitions_status_check
    check (status in ('running', 'failed', 'completed')),
  constraint season_transitions_attempts_check check (attempts >= 0),
  constraint season_transitions_completed_check
    check ((status = 'completed') = (completed_at is not null)),
  constraint season_transitions_failed_check
    check (status <> 'failed' or last_error is not null)
);

comment on table public.season_transitions is
  'One resumable seasonal transition per closing season (S20). The scheduled job and the Super Admin recovery view share it.';

create trigger season_transitions_set_updated_at
  before update on public.season_transitions
  for each row execute function public.set_updated_at();

alter table public.season_transitions enable row level security;

-- The notification type used when a transition keeps failing (S20). Keep the
-- full vocabulary added by migrations 013 and 015.
alter table public.notifications
  drop constraint notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'tournament_published',
      'entry_payment_paid',
      'partner_invitation',
      'partner_invitation_accepted',
      'partner_invitation_declined',
      'partner_invitation_cancelled',
      'friend_request',
      'friend_request_accepted',
      'friend_removed',
      'payment_receipt_approved',
      'payment_receipt_rejected',
      'season_transition_failed'
    )
  );

-- ---------------------------------------------------------------------------
-- active_season_for: the active season that contains one timestamp (S2, S6)
-- ---------------------------------------------------------------------------
create function public.active_season_for(p_at timestamptz)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select s.id
    from public.seasons as s
   where s.status = 'active'
     and p_at >= (s.starts_on::timestamp at time zone 'Asia/Manila')
     and p_at < ((s.ends_on + 1)::timestamp at time zone 'Asia/Manila')
   limit 1;
$function$;

comment on function public.active_season_for(timestamptz) is
  'Internal. The active season whose Asia/Manila date range contains p_at, or null. S6: a result finalized after the cutoff accrues no Seasonal SP.';

revoke all on function public.active_season_for(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- tournament_entry_players: the individual players on one entry
-- ---------------------------------------------------------------------------
create function public.tournament_entry_players(p_entry_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(array_agg(x.player_id), '{}')
  from (
    select e.player_id
      from public.tournament_entries as e
     where e.id = p_entry_id
       and e.player_id is not null
    union
    select tm.player_id
      from public.tournament_entries as e
      join public.team_members as tm on tm.team_id = e.team_id
     where e.id = p_entry_id
  ) as x;
$function$;

comment on function public.tournament_entry_players(uuid) is
  'Internal. The linked players on one tournament entry (one for singles, two for doubles).';

revoke all on function public.tournament_entry_players(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- season_player_stats: eligible finalized match statistics (S13, S18)
-- ---------------------------------------------------------------------------
create function public.season_player_stats(p_season_id uuid)
returns table (
  player_id uuid,
  matches_played integer,
  wins integer,
  tournament_matches integer,
  tournament_wins integer,
  game_difference integer,
  point_difference integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  with bounds as (
    select
      (s.starts_on::timestamp at time zone 'Asia/Manila') as from_ts,
      ((s.ends_on + 1)::timestamp at time zone 'Asia/Manila') as to_ts
    from public.seasons as s
    where s.id = p_season_id
  ),
  tournament as (
    select
      m.id,
      m.winner_entry_id,
      m.home_entry_id,
      m.away_entry_id,
      count(g.*) filter (where g.home_points > g.away_points)::integer as home_game_wins,
      count(g.*) filter (where g.away_points > g.home_points)::integer as away_game_wins,
      coalesce(sum(g.home_points - g.away_points), 0)::integer as home_point_diff
    from public.matches as m
    join bounds as b
      on coalesce(m.finalized_at, m.recorded_at) >= b.from_ts
     and coalesce(m.finalized_at, m.recorded_at) < b.to_ts
    join public.match_games as g on g.match_id = m.id
    where m.status = 'completed'
      and m.winner_entry_id is not null
    group by m.id, m.winner_entry_id, m.home_entry_id, m.away_entry_id
  ),
  tournament_rows as (
    select
      p.player_id,
      1 as matches_played,
      case when t.winner_entry_id = side.entry_id then 1 else 0 end as wins,
      1 as tournament_matches,
      case when t.winner_entry_id = side.entry_id then 1 else 0 end as tournament_wins,
      case
        when side.entry_id = t.home_entry_id
          then t.home_game_wins - t.away_game_wins
        else t.away_game_wins - t.home_game_wins
      end as game_difference,
      case
        when side.entry_id = t.home_entry_id then t.home_point_diff
        else -t.home_point_diff
      end as point_difference
    from tournament as t
    cross join lateral (values (t.home_entry_id), (t.away_entry_id)) as side(entry_id)
    cross join lateral unnest(public.tournament_entry_players(side.entry_id)) as p(player_id)
  ),
  friendly_rows as (
    select
      f.challenger_id as player_id,
      1 as matches_played,
      case when f.winner_id = f.challenger_id then 1 else 0 end as wins,
      0 as tournament_matches,
      0 as tournament_wins,
      0 as game_difference,
      0 as point_difference
    from public.friendly_matches as f
    join bounds as b
      on f.confirmed_at >= b.from_ts
     and f.confirmed_at < b.to_ts
    where f.status in ('confirmed', 'auto_approved')
      and f.winner_id is not null
    union all
    select
      f.opponent_id,
      1,
      case when f.winner_id = f.opponent_id then 1 else 0 end,
      0,
      0,
      0,
      0
    from public.friendly_matches as f
    join bounds as b
      on f.confirmed_at >= b.from_ts
     and f.confirmed_at < b.to_ts
    where f.status in ('confirmed', 'auto_approved')
      and f.winner_id is not null
  )
  select
    x.player_id,
    sum(x.matches_played)::integer,
    sum(x.wins)::integer,
    sum(x.tournament_matches)::integer,
    sum(x.tournament_wins)::integer,
    sum(x.game_difference)::integer,
    sum(x.point_difference)::integer
  from (
    select * from tournament_rows
    union all
    select * from friendly_rows
  ) as x
  group by x.player_id;
$function$;

comment on function public.season_player_stats(uuid) is
  'Internal. Eligible finalized match statistics for one season: friendlies for Seasonal SP, tournament matches for the S18 tie-break.';

revoke all on function public.season_player_stats(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- season_head_to_head: wins against one opponent in eligible tournament matches
-- ---------------------------------------------------------------------------
create function public.season_head_to_head(p_season_id uuid)
returns table (player_id uuid, opponent_id uuid, wins integer)
language sql
stable
security definer
set search_path = ''
as $function$
  with bounds as (
    select
      (s.starts_on::timestamp at time zone 'Asia/Manila') as from_ts,
      ((s.ends_on + 1)::timestamp at time zone 'Asia/Manila') as to_ts
    from public.seasons as s
    where s.id = p_season_id
  ),
  eligible as (
    select
      m.id,
      m.winner_entry_id,
      m.home_entry_id,
      m.away_entry_id
    from public.matches as m
    join bounds as b
      on coalesce(m.finalized_at, m.recorded_at) >= b.from_ts
     and coalesce(m.finalized_at, m.recorded_at) < b.to_ts
    where m.status = 'completed'
      and m.winner_entry_id is not null
      and exists (select 1 from public.match_games as g where g.match_id = m.id)
  )
  select
    w.player_id,
    l.player_id,
    count(*)::integer
  from eligible as e
  cross join lateral unnest(
    public.tournament_entry_players(
      case
        when e.winner_entry_id = e.home_entry_id then e.home_entry_id
        else e.away_entry_id
      end
    )
  ) as w(player_id)
  cross join lateral unnest(
    public.tournament_entry_players(
      case
        when e.winner_entry_id = e.home_entry_id then e.away_entry_id
        else e.home_entry_id
      end
    )
  ) as l(player_id)
  group by w.player_id, l.player_id;
$function$;

comment on function public.season_head_to_head(uuid) is
  'Internal. Per-opponent win counts from eligible finalized tournament matches, used for the S12 head-to-head step.';

revoke all on function public.season_head_to_head(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- season_rankings: the approved S10/S11/S12/S16/S17/S18 ranking
-- ---------------------------------------------------------------------------
create function public.season_rankings(p_season_id uuid)
returns table (
  player_id uuid,
  "position" integer,
  seasonal_sp integer,
  matches_played integer,
  wins integer,
  tournament_matches integer,
  tournament_wins integer,
  game_difference integer,
  point_difference integer,
  excluded_reason text,
  deduction_position integer,
  previous_position integer
)
language sql
stable
security definer
set search_path = ''
as $function$
  with season as (
    select * from public.seasons where id = p_season_id
  ),
  previous as (
    select distinct on (r.player_id)
      r.player_id,
      r.position
    from public.season_player_results as r
    join public.seasons as s on s.id = r.season_id
    cross join season as cur
    where r.position is not null
      and s.ends_on < cur.starts_on
    order by r.player_id, s.ends_on desc
  ),
  base as (
    select
      p.id as player_id,
      coalesce(b.seasonal_sp, 0) as seasonal_sp,
      coalesce(st.matches_played, 0) as matches_played,
      coalesce(st.wins, 0) as wins,
      coalesce(st.tournament_matches, 0) as tournament_matches,
      coalesce(st.tournament_wins, 0) as tournament_wins,
      coalesce(st.game_difference, 0) as game_difference,
      coalesce(st.point_difference, 0) as point_difference,
      prev.position as previous_position,
      p.status as player_status,
      p.profile_id,
      pr.status as profile_status
    from public.players as p
    join public.sp_accounts as a on a.player_id = p.id
    left join public.season_balances as b
      on b.season_id = p_season_id
     and b.player_id = p.id
    left join public.season_player_stats(p_season_id) as st on st.player_id = p.id
    left join previous as prev on prev.player_id = p.id
    left join public.profiles as pr on pr.id = p.profile_id
  ),
  head_to_head as (
    select h.player_id, count(*)::integer as h2h_wins
    from public.season_head_to_head(p_season_id) as h
    join base as b1 on b1.player_id = h.player_id
    join base as b2 on b2.player_id = h.opponent_id
    where b1.seasonal_sp = b2.seasonal_sp
      and b1.tournament_wins = b2.tournament_wins
    group by h.player_id
  ),
  eligible as (
    select b.*, coalesce(h.h2h_wins, 0) as h2h_wins
    from base as b
    left join head_to_head as h on h.player_id = b.player_id
    where b.player_status = 'active'
      and b.profile_id is not null
      and b.profile_status = 'active'
      and not (b.matches_played = 0 and b.previous_position is not null)
      and b.seasonal_sp >= 0
  ),
  ranked as (
    select
      e.*,
      rank() over (
        order by
          e.seasonal_sp desc,
          e.tournament_wins desc,
          e.h2h_wins desc,
          e.game_difference desc,
          e.point_difference desc
      )::integer as live_position
    from eligible as e
  )
  select
    b.player_id,
    case
      when b.player_status <> 'active'
        or b.profile_id is null
        or b.profile_status is distinct from 'active' then null
      when b.matches_played = 0 and b.previous_position is not null then b.previous_position
      when b.seasonal_sp < 0 then null
      when b.matches_played = 0 then null
      else r.live_position
    end as "position",
    b.seasonal_sp,
    b.matches_played,
    b.wins,
    b.tournament_matches,
    b.tournament_wins,
    b.game_difference,
    b.point_difference,
    case
      when b.player_status <> 'active'
        or b.profile_id is null
        or b.profile_status is distinct from 'active' then 'inactive_or_unlinked'
      when b.matches_played = 0 and b.previous_position is not null then null
      when b.seasonal_sp < 0 then 'negative_seasonal_sp'
      when b.matches_played = 0 then 'no_eligible_matches'
      else null
    end as excluded_reason,
    case
      when b.player_status = 'active'
        and b.profile_id is not null
        and b.profile_status = 'active'
        and b.matches_played = 0
        and b.previous_position is not null then b.previous_position
      when b.player_status = 'active'
        and b.profile_id is not null
        and b.profile_status = 'active'
        and b.seasonal_sp < 0 then b.previous_position
      when b.player_status = 'active'
        and b.profile_id is not null
        and b.profile_status = 'active'
        and b.matches_played > 0
        and b.seasonal_sp >= 0
        and (b.seasonal_sp > 0 or b.previous_position is not null) then r.live_position
      else null
    end as deduction_position,
    b.previous_position
  from base as b
  left join ranked as r on r.player_id = b.player_id;
$function$;

comment on function public.season_rankings(uuid) is
  'Internal. The approved S10/S11/S12/S16/S17/S18 ranking, with the deduction position separated from the displayed position.';

revoke all on function public.season_rankings(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- close_season_internal / close_season (S3, S8, S19)
-- ---------------------------------------------------------------------------
create function public.close_season_internal(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_season public.seasons%rowtype;
  v_batch_id uuid;
  v_snapshot_count integer := 0;
  v_entry_count integer := 0;
  v_rule_version text;
begin
  select * into v_season
    from public.seasons as s
   where s.id = p_season_id
     for update;

  if not found then
    raise exception 'season not found' using errcode = 'P0002';
  end if;

  if v_season.status = 'closed' then
    return jsonb_build_object(
      'id', v_season.id,
      'status', 'closed',
      'already_processed', true
    );
  end if;

  if v_season.status <> 'active' then
    raise exception 'only an active season can be closed' using errcode = '22023';
  end if;

  select r.version into v_rule_version
    from public.sp_rule_versions as r
   where r.is_enabled
     and r.status = 'approved';

  insert into public.season_player_results (
    season_id,
    player_id,
    position,
    seasonal_sp,
    current_sp,
    matches_played,
    wins,
    tournament_matches,
    tournament_wins,
    game_difference,
    point_difference,
    excluded_reason,
    deduction_position,
    previous_position,
    rule_version
  )
  select
    v_season.id,
    r.player_id,
    r.position,
    r.seasonal_sp,
    coalesce(a.current_sp, 0),
    r.matches_played,
    r.wins,
    r.tournament_matches,
    r.tournament_wins,
    r.game_difference,
    r.point_difference,
    r.excluded_reason,
    r.deduction_position,
    r.previous_position,
    v_rule_version
  from public.season_rankings(v_season.id) as r
  left join public.sp_accounts as a on a.player_id = r.player_id
  on conflict (season_id, player_id) do nothing;

  get diagnostics v_snapshot_count = row_count;

  insert into public.season_transition_steps (season_id, step, status, completed_at)
  values (v_season.id, 'snapshot', 'completed', now())
  on conflict (season_id, step) do nothing;

  if not exists (
    select 1
      from public.season_deduction_batches as d
     where d.season_id = v_season.id
       and d.status = 'pending'
  ) then
    insert into public.season_deduction_batches (season_id)
    values (v_season.id)
    returning id into v_batch_id;

    insert into public.season_deduction_entries (batch_id, player_id, position, tier, proposed_amount)
    select
      v_batch_id,
      r.player_id,
      r.deduction_position,
      case
        when r.deduction_position <= 3 then 1
        when r.deduction_position <= 10 then 2
        when r.deduction_position <= 20 then 3
        else 4
      end,
      case
        when r.deduction_position <= 3 then 40
        when r.deduction_position <= 10 then 30
        when r.deduction_position <= 20 then 20
        else 10
      end
    from public.season_player_results as r
    where r.season_id = v_season.id
      and r.deduction_position is not null
    on conflict (batch_id, player_id) do nothing;

    get diagnostics v_entry_count = row_count;

    insert into public.season_transition_steps (season_id, step, status, completed_at)
    values (v_season.id, 'deduction_batch', 'completed', now())
    on conflict (season_id, step) do nothing;
  end if;

  update public.seasons
     set status = 'closed',
         closed_at = now()
   where id = v_season.id;

  insert into public.season_transition_steps (season_id, step, status, completed_at)
  values (v_season.id, 'closed', 'completed', now())
  on conflict (season_id, step) do nothing;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    auth.uid(),
    'season.closed',
    'seasons',
    v_season.id,
    jsonb_build_object('status', v_season.status),
    jsonb_build_object(
      'status', 'closed',
      'snapshots', v_snapshot_count,
      'deduction_entries', v_entry_count,
      'rule_version', v_rule_version
    )
  );

  return jsonb_build_object(
    'id', v_season.id,
    'status', 'closed',
    'snapshots', v_snapshot_count,
    'deduction_entries', v_entry_count,
    'batch_id', v_batch_id
  );
end;
$function$;

comment on function public.close_season_internal(uuid) is
  'Internal. Freezes the S19 snapshot, generates one pending deduction batch, and records checkpoints. Replaying it is a no-op.';

revoke all on function public.close_season_internal(uuid) from public, anon, authenticated;

create or replace function public.close_season(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.require_super_admin();
  return public.close_season_internal(p_season_id);
end;
$function$;

comment on function public.close_season(uuid) is
  'Super Admin only. Freezes the season snapshot, generates one pending deduction batch, and records checkpoints. Replaying it is a no-op.';

revoke all on function public.close_season(uuid) from public, anon;
grant execute on function public.close_season(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- start_season_internal / start_season (S3)
-- ---------------------------------------------------------------------------
create function public.start_season_internal(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_season public.seasons%rowtype;
begin
  select * into v_season
    from public.seasons as s
   where s.id = p_season_id
     for update;

  if not found then
    raise exception 'season not found' using errcode = 'P0002';
  end if;

  if v_season.status = 'active' then
    return jsonb_build_object('id', v_season.id, 'status', 'active', 'already_processed', true);
  end if;

  if v_season.status = 'closed' then
    raise exception 'a closed season is never reopened' using errcode = '22023';
  end if;

  if exists (select 1 from public.seasons as s where s.status = 'active') then
    raise exception 'another season is already active; close it first' using errcode = '22023';
  end if;

  update public.seasons
     set status = 'active',
         started_at = now()
   where id = v_season.id;

  insert into public.season_transition_steps (season_id, step, status, completed_at)
  values (v_season.id, 'activated', 'completed', now())
  on conflict (season_id, step) do nothing;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    auth.uid(),
    'season.started',
    'seasons',
    v_season.id,
    jsonb_build_object('status', v_season.status),
    jsonb_build_object('status', 'active')
  );

  return jsonb_build_object('id', v_season.id, 'status', 'active');
end;
$function$;

comment on function public.start_season_internal(uuid) is
  'Internal. Activates a scheduled season; only one season may be active (S3). Replaying it is a no-op.';

revoke all on function public.start_season_internal(uuid) from public, anon, authenticated;

create or replace function public.start_season(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  perform public.require_super_admin();
  return public.start_season_internal(p_season_id);
end;
$function$;

comment on function public.start_season(uuid) is
  'Super Admin only. Activates a scheduled season; only one season may be active (S3).';

revoke all on function public.start_season(uuid) from public, anon;
grant execute on function public.start_season(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- run_season_transition: the S3/S20 transition, idempotently
-- ---------------------------------------------------------------------------
create function public.run_season_transition(p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_today date := (now() at time zone 'Asia/Manila')::date;
  v_year integer := extract(year from (now() at time zone 'Asia/Manila'))::integer;
  v_closing public.seasons%rowtype;
  v_new public.seasons%rowtype;
  v_transition public.season_transitions%rowtype;
  v_attempts integer;
  v_closed jsonb;
  v_started jsonb;
  v_notified integer := 0;
begin
  -- The scheduled job has no JWT. A signed-in caller must be a Super Admin.
  if auth.uid() is not null then
    perform public.require_super_admin();
  end if;

  -- Resume an incomplete transition first; otherwise find the active season
  -- that has ended. A completed transition or a mid-season run is idle.
  select * into v_transition
    from public.season_transitions as t
   where t.status <> 'completed'
   order by t.started_at desc
   limit 1
     for update;

  if found then
    select * into v_closing
      from public.seasons as s
     where s.id = v_transition.season_id
       for update;
  else
    select * into v_closing
      from public.seasons as s
     where s.status = 'active'
       and s.ends_on < v_today
     order by s.ends_on desc
     limit 1
       for update;
  end if;

  if not found then
    return jsonb_build_object('status', 'idle');
  end if;

  if v_transition.id is null then
    insert into public.season_transitions (season_id, status, attempts)
    values (v_closing.id, 'running', 0)
    on conflict (season_id) do update
      set status = 'running',
          last_error = null
    returning * into v_transition;
  end if;

  if v_transition.status = 'completed' then
    return jsonb_build_object('status', 'completed', 'season_id', v_closing.id);
  end if;

  v_attempts := v_transition.attempts + 1;

  if v_attempts > 5 and not p_force then
    return jsonb_build_object(
      'status', 'failed',
      'season_id', v_closing.id,
      'attempts', v_transition.attempts,
      'reason', 'retry limit reached; a Super Admin can re-run the transition'
    );
  end if;

  update public.season_transitions
     set status = 'running',
         attempts = v_attempts,
         last_error = null
   where id = v_transition.id;

  begin
    if v_closing.status = 'active' then
      v_closed := public.close_season_internal(v_closing.id);
    end if;

    select * into v_new
      from public.seasons as s
     where s.starts_on <= v_today
       and s.ends_on >= v_today
     order by s.starts_on desc
     limit 1
       for update;

    if not found then
      insert into public.seasons (label, starts_on, ends_on)
      values (
        format('Season %s', v_year),
        make_date(v_year, 1, 1),
        make_date(v_year, 12, 31)
      )
      on conflict (label) do nothing;

      select * into v_new
        from public.seasons as s
       where s.starts_on <= v_today
         and s.ends_on >= v_today
       order by s.starts_on desc
       limit 1
         for update;

      if not found then
        raise exception 'no season covers % and the calendar season could not be created', v_today
          using errcode = '22023';
      end if;
    end if;

    if v_new.status = 'scheduled' then
      v_started := public.start_season_internal(v_new.id);
    end if;

    -- Seasonal SP is stored per season, so a new season starts at zero by
    -- construction. The checkpoint records that the reset step ran (S3).
    insert into public.season_transition_steps (season_id, step, status, completed_at)
    values (v_new.id, 'balances_reset', 'completed', now())
    on conflict (season_id, step) do nothing;

    update public.season_transitions
       set status = 'completed',
           completed_at = now(),
           last_error = null
     where id = v_transition.id;

    insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
    values (
      auth.uid(),
      'season.transition',
      'seasons',
      v_closing.id,
      jsonb_build_object(
        'status', 'completed',
        'closed', v_closed,
        'started', v_started,
        'new_season_id', v_new.id,
        'service_identity', case when auth.uid() is null then 'system:season-transition' else null end
      )
    );

    return jsonb_build_object(
      'status', 'completed',
      'season_id', v_closing.id,
      'new_season_id', v_new.id,
      'attempts', v_attempts
    );
  exception
    when others then
      update public.season_transitions
         set status = 'failed',
             last_error = left(sqlerrm, 1000)
       where id = v_transition.id;

      if v_attempts = 5 then
        insert into public.notifications (profile_id, type, title, body, link_path)
        select
          ur.profile_id,
          'season_transition_failed',
          'Season transition needs attention',
          format('Season %s could not finish its January transition after five attempts.', v_closing.label),
          '/admin/seasons'
        from public.user_roles as ur
        join public.roles as r on r.id = ur.role_id
        where r.key = 'super_admin';

        get diagnostics v_notified = row_count;
      end if;

      insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
      values (
        auth.uid(),
        'season.transition_failed',
        'seasons',
        v_closing.id,
        jsonb_build_object(
          'status', 'failed',
          'attempts', v_attempts,
          'error', left(sqlerrm, 1000),
          'notified', v_notified,
          'service_identity', case when auth.uid() is null then 'system:season-transition' else null end
        )
      );

      return jsonb_build_object(
        'status', 'failed',
        'season_id', v_closing.id,
        'attempts', v_attempts,
        'error', left(sqlerrm, 1000)
      );
  end;
end;
$function$;

comment on function public.run_season_transition(boolean) is
  'Runs the S3/S20 January transition idempotently: close, snapshot, batch, activate, reset. The scheduled job calls it with no JWT; a signed-in caller must be a Super Admin. p_force resets the retry limit.';

revoke all on function public.run_season_transition(boolean) from public, anon;
grant execute on function public.run_season_transition(boolean) to authenticated;

-- Run at 00:05 Asia/Manila and retry every 15 minutes after that. The minute
-- offsets work in any pg_cron database timezone; the function self-gates, so it
-- is a cheap no-op for the rest of the year.
do $schedule$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'season-transition',
      '5,20,35,50 * * * *',
      $job$select public.run_season_transition()$job$
    );
  end if;
end;
$schedule$;

-- ---------------------------------------------------------------------------
-- seasonal_standings: the S15 live table, or the frozen S19 snapshot
-- ---------------------------------------------------------------------------
create function public.seasonal_standings(p_season_id uuid default null)
returns table (
  season_id uuid,
  player_id uuid,
  full_name text,
  seasonal_sp integer,
  matches_played integer,
  wins integer,
  tournament_matches integer,
  tournament_wins integer,
  game_difference integer,
  point_difference integer,
  "position" integer,
  excluded_reason text,
  provisional boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_season public.seasons%rowtype;
begin
  if p_season_id is null then
    select * into v_season
      from public.seasons as s
     where s.status = 'active'
     limit 1;

    if not found then
      select * into v_season
        from public.seasons as s
       order by s.ends_on desc
       limit 1;
    end if;
  else
    select * into v_season
      from public.seasons as s
     where s.id = p_season_id;
  end if;

  if not found then
    return;
  end if;

  if v_season.status = 'closed' then
    return query
    select
      v_season.id,
      r.player_id,
      p.full_name,
      r.seasonal_sp,
      coalesce(r.matches_played, 0),
      coalesce(r.wins, 0),
      coalesce(r.tournament_matches, 0),
      coalesce(r.tournament_wins, 0),
      coalesce(r.game_difference, 0),
      coalesce(r.point_difference, 0),
      r.position,
      r.excluded_reason,
      false
    from public.season_player_results as r
    join public.players as p on p.id = r.player_id
    where r.season_id = v_season.id
    order by r.position nulls last, r.seasonal_sp desc, p.full_name;
    return;
  end if;

  return query
  select
    v_season.id,
    r.player_id,
    p.full_name,
    r.seasonal_sp,
    r.matches_played,
    r.wins,
    r.tournament_matches,
    r.tournament_wins,
    r.game_difference,
    r.point_difference,
    r.position,
    r.excluded_reason,
    true
  from public.season_rankings(v_season.id) as r
  join public.players as p on p.id = r.player_id
  order by r.position nulls last, r.seasonal_sp desc, p.full_name;
end;
$function$;

comment on function public.seasonal_standings(uuid) is
  'S15: the provisional live seasonal table while a season is open, or the immutable snapshot once it is closed.';

revoke all on function public.seasonal_standings(uuid) from public, anon;
grant execute on function public.seasonal_standings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- award_friendly_sp: superseded to respect the S5/S6 finalization window
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
        'opponent_id', v_opponent,
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

  return jsonb_build_object(
    'status', 'awarded',
    'rule_version', v_version,
    'season_id', v_season,
    'awarded', v_awarded,
    'skipped', v_skipped
  );
end;
$function$;

comment on function public.award_friendly_sp(uuid) is
  'Internal. Awards a confirmed singles friendly from the one approved+enabled rule version and accrues Seasonal SP only when the result was finalized inside the active season (S6).';

revoke all on function public.award_friendly_sp(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- award_tournament_sp: superseded to respect the S5/S6/S7 finalization window
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
  'Internal. Awards a completed tournament match from the approved rule version, accrues Seasonal SP only inside the original finalization season (S6/S7), and re-awards a corrected result under the original version. Idempotent per player.';

revoke all on function public.award_tournament_sp(uuid, text) from public, anon, authenticated;

commit;
