-- MBC Arena - Migration 012: seasons, seasonal balances, snapshots, deduction batches
--
-- Implements the approved seasonal rules S1–S23 (PLAN.md §7.3):
--   * S1  separate Current SP and Seasonal SP; the seasonal balance resets each season and may go negative;
--   * S2  12-month calendar seasons in Asia/Manila (dates are calendar dates; boundary jobs are S20 work);
--   * S3  close -> snapshot -> deduction batch -> activate; pending batches never block the next season;
--   * S8  fixed 40 / 30 / 20 / 10 SP tiers by fixed ranking position, applied to Current SP only;
--   * S9  a Super Admin approves or rejects a batch; approval applies it exactly once to the latest
--         Current SP, capped at the available balance, with the remainder permanently waived;
--   * S11 negative seasonal balances are excluded from the ranking;
--   * S12 competition ranking, so ties share a position (1, 2, 3, 3, 5);
--   * S19 one immutable per-player snapshot per season, with a reason code for excluded players;
--   * S20 one checkpoint per season and step, so a retried transition is a no-op.
--
-- Not built here: the S18 tie-break statistics (wins, game and point difference) are columns on the
-- snapshot but are left null, because they need the tournament result joins; the scheduled January 1
-- job; the recovery screen; and any UI. Nothing in this migration enables SP awards.
--
-- Apply after 011_friendly_sp_award.sql, before backend/policies/012_seasons.sql.
-- This migration is intentionally not idempotent.

begin;

-- ---------------------------------------------------------------------------
-- seasons
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'scheduled',
  started_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_label_unique unique (label),
  constraint seasons_label_check
    check (label = btrim(label) and char_length(label) between 4 and 40),
  constraint seasons_dates_check check (ends_on >= starts_on),
  constraint seasons_status_check check (status in ('scheduled', 'active', 'closed')),
  constraint seasons_active_state_check
    check ((status = 'active') = (started_at is not null and closed_at is null)),
  constraint seasons_closed_state_check
    check ((status = 'closed') <= (closed_at is not null))
);

comment on table public.seasons is
  'Season records. S2: one calendar year in Asia/Manila. Exactly one season is active at a time.';
comment on column public.seasons.status is
  'scheduled -> active -> closed. A closed season is never reopened (S7/S19: its snapshot is final).';

create trigger seasons_set_updated_at
  before update on public.seasons
  for each row execute function public.set_updated_at();

create unique index seasons_one_active_key
  on public.seasons ((true))
  where status = 'active';

-- ---------------------------------------------------------------------------
-- season_balances: Seasonal SP per player per season (S1)
-- ---------------------------------------------------------------------------
create table public.season_balances (
  season_id uuid not null references public.seasons (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  seasonal_sp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, player_id)
);

comment on table public.season_balances is
  'Seasonal SP: net actual SP gained and lost by eligible finalized matches in the season. May be negative (S1); a negative balance is excluded from the ranking (S11).';
comment on column public.season_balances.seasonal_sp is
  'Never touched by a seasonal deduction: a deduction reduces Current SP only (S1, S8).';

create trigger season_balances_set_updated_at
  before update on public.season_balances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- season_player_results: the immutable snapshot written at close (S19)
-- ---------------------------------------------------------------------------
create table public.season_player_results (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  position integer,
  seasonal_sp integer not null,
  current_sp integer not null,
  matches_played integer,
  wins integer,
  excluded_reason text,
  rule_version text,
  recorded_at timestamptz not null default now(),
  constraint season_player_results_unique unique (season_id, player_id),
  constraint season_player_results_position_check
    check (position is null or position >= 1),
  constraint season_player_results_exclusion_check
    check (
      (excluded_reason is null and position is not null)
      or (excluded_reason is not null and position is null)
    ),
  constraint season_player_results_reason_check
    check (
      excluded_reason is null
      or excluded_reason in ('negative_seasonal_sp')
    ),
  constraint season_player_results_rule_version_check
    check (rule_version is null or char_length(btrim(rule_version)) between 1 and 50)
);

comment on table public.season_player_results is
  'Immutable per-player season snapshot (S19). Written once at close, never recalculated; history reads this, not live data.';
comment on column public.season_player_results.matches_played is
  'Reserved for the S18 tie-break statistics; null until the tournament result joins are built.';
comment on column public.season_player_results.excluded_reason is
  'Why the player has no position. S11: a negative seasonal balance is excluded from the ranking.';

-- ---------------------------------------------------------------------------
-- deduction batches and their entries (S8, S9)
-- ---------------------------------------------------------------------------
create table public.season_deduction_batches (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  status text not null default 'pending',
  generated_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles (id) on delete set null,
  rejection_reason text,
  constraint season_deduction_batches_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint season_deduction_batches_pending_check
    check ((status = 'pending') = (decided_at is null)),
  constraint season_deduction_batches_rejection_check
    check ((status = 'rejected') = (rejection_reason is not null)),
  constraint season_deduction_batches_reason_check
    check (rejection_reason is null or char_length(btrim(rejection_reason)) between 5 and 500)
);

comment on table public.season_deduction_batches is
  'One pending batch per season, and at most one approved batch (S9: applied exactly once). A rejected batch is preserved for audit.';

create unique index season_deduction_batches_pending_key
  on public.season_deduction_batches (season_id)
  where status = 'pending';

create unique index season_deduction_batches_approved_key
  on public.season_deduction_batches (season_id)
  where status = 'approved';

create table public.season_deduction_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.season_deduction_batches (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  position integer not null,
  tier integer not null,
  proposed_amount integer not null,
  applied_amount integer,
  waived_amount integer,
  transaction_id uuid references public.sp_transactions (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint season_deduction_entries_unique unique (batch_id, player_id),
  constraint season_deduction_entries_position_check check (position >= 1),
  constraint season_deduction_entries_tier_check check (tier between 1 and 4),
  constraint season_deduction_entries_amount_check
    check (proposed_amount > 0 and coalesce(applied_amount, 0) >= 0 and coalesce(waived_amount, 0) >= 0),
  constraint season_deduction_entries_split_check
    check (
      applied_amount is null
      or applied_amount + coalesce(waived_amount, 0) = proposed_amount
    )
);

comment on table public.season_deduction_entries is
  'One proposed deduction per ranked player, with the amount actually applied and the remainder waived (S8).';

-- ---------------------------------------------------------------------------
-- season_transition_steps: the S20 checkpoints
-- ---------------------------------------------------------------------------
create table public.season_transition_steps (
  season_id uuid not null references public.seasons (id) on delete cascade,
  step text not null,
  status text not null default 'completed',
  attempts integer not null default 1,
  last_error text,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (season_id, step),
  constraint season_transition_steps_step_check
    check (step in ('activated', 'snapshot', 'deduction_batch', 'closed', 'balances_reset')),
  constraint season_transition_steps_status_check
    check (status in ('completed', 'failed')),
  constraint season_transition_steps_failed_check
    check (status = 'completed' or last_error is not null)
);

comment on table public.season_transition_steps is
  'One checkpoint per season and step (S20). A retried transition is a no-op for a completed step.';

create trigger season_transition_steps_set_updated_at
  before update on public.season_transition_steps
  for each row execute function public.set_updated_at();

alter table public.seasons enable row level security;
alter table public.season_balances enable row level security;
alter table public.season_player_results enable row level security;
alter table public.season_deduction_batches enable row level security;
alter table public.season_deduction_entries enable row level security;
alter table public.season_transition_steps enable row level security;

-- ---------------------------------------------------------------------------
-- create_season / start_season (S2, S3)
-- ---------------------------------------------------------------------------
create function public.create_season(p_label text, p_starts_on date, p_ends_on date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_label text := btrim(coalesce(p_label, ''));
  v_season public.seasons%rowtype;
begin
  perform public.require_super_admin();

  if char_length(v_label) < 4 or char_length(v_label) > 40 then
    raise exception 'a season label needs between 4 and 40 characters' using errcode = '22023';
  end if;

  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then
    raise exception 'a season needs a start and an end date' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.seasons as s
     where daterange(s.starts_on, s.ends_on, '[]') && daterange(p_starts_on, p_ends_on, '[]')
  ) then
    raise exception 'this season overlaps an existing season' using errcode = '22023';
  end if;

  insert into public.seasons (label, starts_on, ends_on, created_by)
  values (v_label, p_starts_on, p_ends_on, v_actor)
  returning * into v_season;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'season.created',
    'seasons',
    v_season.id,
    jsonb_build_object(
      'label', v_season.label,
      'starts_on', v_season.starts_on,
      'ends_on', v_season.ends_on
    )
  );

  return jsonb_build_object(
    'id', v_season.id,
    'label', v_season.label,
    'status', v_season.status
  );
end;
$function$;

comment on function public.create_season(text, date, date) is
  'Super Admin only. Creates a scheduled season; overlapping seasons are refused (S2).';

revoke all on function public.create_season(text, date, date) from public, anon;
grant execute on function public.create_season(text, date, date) to authenticated;

create function public.start_season(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_season public.seasons%rowtype;
begin
  perform public.require_super_admin();

  select * into v_season
    from public.seasons as s
   where s.id = p_season_id
     for update;

  if not found then
    raise exception 'season not found' using errcode = 'P0002';
  end if;

  if v_season.status = 'active' then
    raise exception 'this season is already active' using errcode = '22023';
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
    v_actor,
    'season.started',
    'seasons',
    v_season.id,
    jsonb_build_object('status', v_season.status),
    jsonb_build_object('status', 'active')
  );

  return jsonb_build_object('id', v_season.id, 'status', 'active');
end;
$function$;

comment on function public.start_season(uuid) is
  'Super Admin only. Activates a scheduled season; only one season may be active (S3).';

revoke all on function public.start_season(uuid) from public, anon;
grant execute on function public.start_season(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- close_season: snapshot + pending deduction batch, idempotently (S3, S8, S19, S20)
-- ---------------------------------------------------------------------------
create function public.close_season(p_season_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_season public.seasons%rowtype;
  v_batch_id uuid;
  v_snapshot_count integer := 0;
  v_entry_count integer := 0;
  v_rule_version text;
begin
  perform public.require_super_admin();

  select * into v_season
    from public.seasons as s
   where s.id = p_season_id
     for update;

  if not found then
    raise exception 'season not found' using errcode = 'P0002';
  end if;

  if v_season.status = 'closed' then
    return jsonb_build_object('id', v_season.id, 'status', 'closed', 'already_processed', true);
  end if;

  if v_season.status <> 'active' then
    raise exception 'only an active season can be closed' using errcode = '22023';
  end if;

  select r.version into v_rule_version
    from public.sp_rule_versions as r
   where r.is_enabled
     and r.status = 'approved';

  -- One immutable snapshot per player. Competition ranking gives ties a shared
  -- position (S12); a negative seasonal balance is excluded (S11).
  insert into public.season_player_results (
    season_id,
    player_id,
    position,
    seasonal_sp,
    current_sp,
    excluded_reason,
    rule_version
  )
  select
    v_season.id,
    b.player_id,
    case when b.seasonal_sp < 0 then null else rank() over (order by b.seasonal_sp desc) end,
    b.seasonal_sp,
    coalesce(a.current_sp, 0),
    case when b.seasonal_sp < 0 then 'negative_seasonal_sp' end,
    v_rule_version
  from public.season_balances as b
  left join public.sp_accounts as a on a.player_id = b.player_id
  where b.season_id = v_season.id
  on conflict (season_id, player_id) do nothing;

  get diagnostics v_snapshot_count = row_count;

  insert into public.season_transition_steps (season_id, step, status, completed_at)
  values (v_season.id, 'snapshot', 'completed', now())
  on conflict (season_id, step) do nothing;

  -- One pending batch per season. Generating it twice is a no-op.
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
      r.position,
      case
        when r.position <= 3 then 1
        when r.position <= 10 then 2
        when r.position <= 20 then 3
        else 4
      end,
      case
        when r.position <= 3 then 40
        when r.position <= 10 then 30
        when r.position <= 20 then 20
        else 10
      end
    from public.season_player_results as r
    where r.season_id = v_season.id
      and r.position is not null
      and r.excluded_reason is null
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
    v_actor,
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

comment on function public.close_season(uuid) is
  'Super Admin only. Freezes the season snapshot, generates one pending deduction batch, and records checkpoints. Replaying it is a no-op.';

revoke all on function public.close_season(uuid) from public, anon;
grant execute on function public.close_season(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- decide_season_deduction_batch: approve or reject (S9)
-- ---------------------------------------------------------------------------
create function public.decide_season_deduction_batch(
  p_batch_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_batch public.season_deduction_batches%rowtype;
  v_entry public.season_deduction_entries%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_before integer;
  v_applied integer;
  v_waived integer;
  v_tx uuid;
  v_players integer := 0;
  v_total integer := 0;
begin
  perform public.require_super_admin();

  if p_approve is null then
    raise exception 'say whether the batch is approved or rejected' using errcode = '22023';
  end if;

  select * into v_batch
    from public.season_deduction_batches as d
   where d.id = p_batch_id
     for update;

  if not found then
    raise exception 'deduction batch not found' using errcode = 'P0002';
  end if;

  if v_batch.status <> 'pending' then
    raise exception 'this deduction batch was already %', v_batch.status
      using errcode = '22023';
  end if;

  if not p_approve then
    if char_length(v_reason) < 5 or char_length(v_reason) > 500 then
      raise exception 'rejecting a batch needs a reason between 5 and 500 characters'
        using errcode = '22023';
    end if;

    update public.season_deduction_batches
       set status = 'rejected',
           decided_at = now(),
           decided_by = v_actor,
           rejection_reason = v_reason
     where id = v_batch.id;

    insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
    values (
      v_actor,
      'season.deduction.rejected',
      'season_deduction_batches',
      v_batch.id,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object('status', 'rejected', 'reason', v_reason)
    );

    return jsonb_build_object('id', v_batch.id, 'status', 'rejected', 'applied', 0);
  end if;

  for v_entry in
    select *
      from public.season_deduction_entries as e
     where e.batch_id = v_batch.id
     order by e.player_id
       for update
  loop
    select a.current_sp into v_before
      from public.sp_accounts as a
     where a.player_id = v_entry.player_id
       for update;

    if v_before is null then
      raise exception 'player % has no SP account; the batch cannot be applied',
        v_entry.player_id using errcode = '22023';
    end if;

    -- S8: applied to the latest Current SP at approval time, capped at the
    -- available balance; the remainder is permanently waived.
    v_applied := least(v_entry.proposed_amount, greatest(v_before, 0));
    v_waived := v_entry.proposed_amount - v_applied;
    v_tx := null;

    if v_applied > 0 then
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
        v_entry.player_id,
        'season_deduction',
        v_before,
        -v_applied,
        v_before - v_applied,
        'season',
        v_batch.season_id,
        null,
        format('season:%s:%s:deduction', v_batch.season_id, v_entry.player_id),
        jsonb_build_object(
          'batch_id', v_batch.id,
          'position', v_entry.position,
          'tier', v_entry.tier,
          'proposed', v_entry.proposed_amount,
          'waived', v_waived
        ),
        v_actor
      )
      on conflict (idempotency_key) do nothing
      returning id into v_tx;

      if v_tx is not null then
        update public.sp_accounts
           set current_sp = v_before - v_applied
         where player_id = v_entry.player_id;

        v_players := v_players + 1;
        v_total := v_total + v_applied;
      end if;
    end if;

    update public.season_deduction_entries
       set applied_amount = v_applied,
           waived_amount = v_waived,
           transaction_id = v_tx
     where id = v_entry.id;
  end loop;

  update public.season_deduction_batches
     set status = 'approved',
         decided_at = now(),
         decided_by = v_actor
   where id = v_batch.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'season.deduction.approved',
    'season_deduction_batches',
    v_batch.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'approved', 'players', v_players, 'applied_total', v_total)
  );

  return jsonb_build_object(
    'id', v_batch.id,
    'status', 'approved',
    'applied', v_players,
    'applied_total', v_total
  );
end;
$function$;

comment on function public.decide_season_deduction_batch(uuid, boolean, text) is
  'Super Admin only. Approves (applies once, capped at the balance, remainder waived) or rejects (reason required) a pending batch (S8, S9).';

revoke all on function public.decide_season_deduction_batch(uuid, boolean, text) from public, anon;
grant execute on function public.decide_season_deduction_batch(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- award_friendly_sp: superseded to accrue Seasonal SP (S1, S13)
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

  select s.id into v_season
    from public.seasons as s
   where s.status = 'active';

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
  'Internal. Awards a confirmed singles friendly from the one approved+enabled rule version and accrues Seasonal SP for the active season. Returns disabled and writes nothing when no rule version is enabled.';

revoke all on function public.award_friendly_sp(uuid) from public, anon, authenticated;

commit;
