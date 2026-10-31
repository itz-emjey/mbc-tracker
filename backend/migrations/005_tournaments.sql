-- MBC Arena - Migration 005: tournaments, events, entries, draws, and results
--
-- Apply after 004_players.sql. Policies live in backend/policies/005_tournaments.sql.
--
-- Scope (Phase 3, backend gate):
--   * tournament metadata and event definitions;
--   * singles entries and doubles teams;
--   * a persisted elimination/round-robin draw;
--   * match results and bracket advancement.
--
-- Design notes:
--   * every tournament table is read-only to clients; all writes cross an RPC so
--     caps, D10 pairings, draw coverage, and result advancement are checked in
--     one transaction and audited;
--   * entries are never deleted. A withdrawal changes status, so history and
--     seeds survive;
--   * a bye is the absence of a match. An entry with a bye starts in a later
--     round as a direct side;
--   * a match side may carry both an entry and its source match. The source is
--     kept as lineage after advancement; the entry is what the UI displays;
--   * the grand-final reset stays a conditional placeholder. It is cancelled
--     automatically when the winners-bracket finalist wins the first final.
--
-- This migration is intentionally not idempotent. It fails loudly if applied
-- twice, like the earlier migrations.

begin;

-- ---------------------------------------------------------------------------
-- tournaments
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  venue text,
  starts_on date not null,
  ends_on date not null,
  registration_deadline timestamptz,
  status text not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournaments_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint tournaments_description_check
    check (description is null or char_length(description) <= 2000),
  constraint tournaments_venue_check
    check (venue is null or (venue = btrim(venue) and char_length(venue) between 1 and 160)),
  constraint tournaments_dates_check
    check (ends_on >= starts_on),
  constraint tournaments_status_check
    check (status in ('draft', 'published', 'in_progress', 'completed', 'archived'))
);

comment on table public.tournaments is
  'Tournament metadata. Drafts are staff-only; publishing exposes the event to club members.';
comment on column public.tournaments.status is
  'draft -> published -> in_progress -> completed -> archived. Status changes cross set_tournament_status.';

create index tournaments_status_dates_idx
  on public.tournaments (status, starts_on desc);

create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tournament_events: one discipline/format within a tournament
-- ---------------------------------------------------------------------------
create table public.tournament_events (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete restrict,
  discipline text not null,
  format text not null,
  max_entries integer not null,
  draw_generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_events_tournament_discipline_key
    unique (tournament_id, discipline),
  constraint tournament_events_discipline_check
    check (discipline in ('singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles')),
  constraint tournament_events_format_check
    check (format in ('single_elimination', 'double_elimination', 'round_robin')),
  constraint tournament_events_max_entries_check
    check (max_entries between 2 and 256)
);

comment on table public.tournament_events is
  'A discipline and format inside a tournament. One event per discipline per tournament.';
comment on column public.tournament_events.draw_generated_at is
  'Set when a draw is saved. Entry changes are refused afterwards so the bracket cannot drift.';

create trigger tournament_events_set_updated_at
  before update on public.tournament_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- teams and team_members: doubles pairs belong to one event
-- ---------------------------------------------------------------------------
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tournament_events (id) on delete restrict,
  name text,
  created_at timestamptz not null default now(),
  constraint teams_name_check
    check (name is null or (name = btrim(name) and char_length(name) between 1 and 120))
);

comment on table public.teams is
  'Doubles team. Created through register_tournament_entry; members are fixed once the entry exists.';

create index teams_event_id_idx on public.teams (event_id);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete restrict,
  primary key (team_id, player_id)
);

comment on table public.team_members is
  'Exactly two player records per doubles team, enforced by validate_team_member().';

create index team_members_player_id_idx on public.team_members (player_id);

-- ---------------------------------------------------------------------------
-- tournament_entries: singles player or doubles team
-- ---------------------------------------------------------------------------
create table public.tournament_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tournament_events (id) on delete restrict,
  player_id uuid references public.players (id) on delete restrict,
  team_id uuid references public.teams (id) on delete restrict,
  seed integer,
  status text not null default 'registered',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_entries_owner_check
    check ((player_id is null) <> (team_id is null)),
  constraint tournament_entries_seed_check
    check (seed is null or seed >= 1),
  constraint tournament_entries_status_check
    check (status in ('registered', 'withdrawn', 'disqualified'))
);

comment on table public.tournament_entries is
  'A singles player or a doubles team in one event. Withdrawal changes status; rows are never deleted.';
comment on column public.tournament_entries.team_id is
  'Doubles entries point at a team; singles entries point at a player. Exactly one is set.';

create unique index tournament_entries_event_player_key
  on public.tournament_entries (event_id, player_id)
  where player_id is not null;

create unique index tournament_entries_event_team_key
  on public.tournament_entries (event_id, team_id)
  where team_id is not null;

create unique index tournament_entries_event_seed_key
  on public.tournament_entries (event_id, seed)
  where seed is not null and status = 'registered';

create index tournament_entries_event_status_idx
  on public.tournament_entries (event_id, status);

create trigger tournament_entries_set_updated_at
  before update on public.tournament_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- matches: elimination and round-robin matches for one event
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tournament_events (id) on delete restrict,
  bracket text not null,
  round integer not null,
  position integer not null,
  home_entry_id uuid references public.tournament_entries (id) on delete restrict,
  away_entry_id uuid references public.tournament_entries (id) on delete restrict,
  home_source_match_id uuid references public.matches (id) on delete set null,
  away_source_match_id uuid references public.matches (id) on delete set null,
  home_source_outcome text,
  away_source_outcome text,
  winner_entry_id uuid references public.tournament_entries (id) on delete restrict,
  status text not null default 'pending',
  conditional boolean not null default false,
  reset boolean not null default false,
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint matches_event_bracket_round_position_key
    unique (event_id, bracket, round, position),
  constraint matches_bracket_check
    check (bracket in ('winners', 'losers', 'grand_final', 'round_robin')),
  constraint matches_round_check check (round >= 1),
  constraint matches_position_check check (position >= 1),
  constraint matches_home_side_check
    check (home_entry_id is not null or home_source_match_id is not null),
  constraint matches_away_side_check
    check (away_entry_id is not null or away_source_match_id is not null),
  constraint matches_home_source_outcome_check
    check ((home_source_match_id is null) = (home_source_outcome is null)),
  constraint matches_away_source_outcome_check
    check ((away_source_match_id is null) = (away_source_outcome is null)),
  constraint matches_source_outcome_check
    check (
      (home_source_outcome is null or home_source_outcome in ('winner', 'loser'))
      and (away_source_outcome is null or away_source_outcome in ('winner', 'loser'))
    ),
  constraint matches_distinct_entries_check
    check (home_entry_id is null or away_entry_id is null or home_entry_id <> away_entry_id),
  constraint matches_status_check
    check (status in ('pending', 'completed', 'cancelled')),
  constraint matches_recorded_state_check
    check (
      (status = 'pending' and winner_entry_id is null and recorded_by is null and recorded_at is null)
      or
      (status in ('completed', 'cancelled') and winner_entry_id is not null
        and recorded_by is not null and recorded_at is not null)
    )
);

comment on table public.matches is
  'Tournament match. Source links preserve bracket lineage after an entry advances.';
comment on column public.matches.status is
  'pending: not played; completed: a result exists; cancelled: a conditional reset was not needed.';
comment on column public.matches.winner_entry_id is
  'Set only for completed matches and for a grand final whose reset was cancelled.';

create index matches_event_idx on public.matches (event_id, bracket, round, position);
create index matches_home_source_idx on public.matches (home_source_match_id);
create index matches_away_source_idx on public.matches (away_source_match_id);

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- match_games: per-game points, immutable once the match is completed
-- ---------------------------------------------------------------------------
create table public.match_games (
  match_id uuid not null references public.matches (id) on delete cascade,
  game_number integer not null,
  home_points integer not null,
  away_points integer not null,
  primary key (match_id, game_number),
  constraint match_games_points_check
    check (home_points >= 0 and away_points >= 0),
  constraint match_games_winner_check
    check (home_points <> away_points)
);

comment on table public.match_games is
  'Ordered game scores. A game cannot end level; the match winner is the side with more games won.';

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create function public.is_tournament_staff(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.has_role(p_profile_id, 'super_admin')
      or public.has_role(p_profile_id, 'tournament_manager');
$function$;

comment on function public.is_tournament_staff(uuid) is
  'True when the active profile is a Super Admin or Tournament Manager.';

revoke all on function public.is_tournament_staff(uuid) from public;
grant execute on function public.is_tournament_staff(uuid) to authenticated, service_role;

create function public.is_club_member(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.profiles as p
    where p.id = p_profile_id
      and p.status = 'active'
      and exists (
        select 1
        from public.user_roles as ur
        where ur.profile_id = p.id
      )
  );
$function$;

comment on function public.is_club_member(uuid) is
  'True for an active profile holding at least one role.';

revoke all on function public.is_club_member(uuid) from public;
grant execute on function public.is_club_member(uuid) to authenticated, service_role;

create function public.can_view_tournament(p_profile_id uuid, p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select public.is_tournament_staff(p_profile_id)
      or (
        public.is_club_member(p_profile_id)
        and exists (
          select 1
          from public.tournaments as t
          where t.id = p_tournament_id
            and t.status <> 'draft'
        )
      );
$function$;

comment on function public.can_view_tournament(uuid, uuid) is
  'Drafts are staff-only; every published tournament is readable by active club members.';

revoke all on function public.can_view_tournament(uuid, uuid) from public;
grant execute on function public.can_view_tournament(uuid, uuid) to authenticated, service_role;

create function public.require_tournament_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.is_tournament_staff(v_uid) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return v_uid;
end;
$function$;

comment on function public.require_tournament_staff() is
  'Server-side authority check for tournament writes.';

revoke all on function public.require_tournament_staff() from public;

-- ---------------------------------------------------------------------------
-- D10 and team integrity triggers
-- ---------------------------------------------------------------------------
create function public.validate_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_discipline text;
  v_event_id uuid;
  v_member_count integer;
begin
  select e.discipline, e.id
    into v_discipline, v_event_id
    from public.teams as t
    join public.tournament_events as e on e.id = t.event_id
   where t.id = new.team_id;

  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;

  if v_discipline = 'singles' then
    raise exception 'a singles event cannot have teams' using errcode = '23514';
  end if;

  if exists (
    select 1
      from public.team_members as tm
      join public.teams as t on t.id = tm.team_id
     where t.event_id = v_event_id
       and tm.player_id = new.player_id
  ) then
    raise exception 'player is already in another team for this event'
      using errcode = '23505';
  end if;

  select count(*)
    into v_member_count
    from public.team_members as tm
   where tm.team_id = new.team_id;

  if v_member_count >= 2 then
    raise exception 'a doubles team must have exactly two players'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_team_member() from public;

create trigger team_members_validate
  before insert on public.team_members
  for each row execute function public.validate_team_member();

create function public.validate_tournament_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_discipline text;
  v_member_count integer;
  v_male_count integer;
  v_female_count integer;
begin
  select e.discipline
    into v_discipline
    from public.tournament_events as e
   where e.id = new.event_id;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  if v_discipline = 'singles' then
    if new.player_id is null or new.team_id is not null then
      raise exception 'a singles entry needs exactly one player'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if new.team_id is null or new.player_id is not null then
    raise exception 'a doubles entry needs exactly one team'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
      from public.teams as t
     where t.id = new.team_id
       and t.event_id = new.event_id
  ) then
    raise exception 'team does not belong to this event' using errcode = '23514';
  end if;

  select
      count(*),
      count(*) filter (where p.gender = 'male'),
      count(*) filter (where p.gender = 'female')
    into v_member_count, v_male_count, v_female_count
    from public.team_members as tm
    join public.players as p on p.id = tm.player_id
   where tm.team_id = new.team_id;

  if v_member_count <> 2 then
    raise exception 'a doubles team must have exactly two players'
      using errcode = '23514';
  end if;

  if v_male_count + v_female_count <> 2 then
    raise exception 'both players need a recorded gender for this event'
      using errcode = '23514';
  end if;

  if v_discipline = 'mixed_doubles' and not (v_male_count = 1 and v_female_count = 1) then
    raise exception 'mixed doubles needs exactly one male and one female player'
      using errcode = '23514';
  end if;

  if v_discipline = 'mens_doubles' and v_male_count <> 2 then
    raise exception 'men''s doubles needs two male players' using errcode = '23514';
  end if;

  if v_discipline = 'womens_doubles' and v_female_count <> 2 then
    raise exception 'women''s doubles needs two female players' using errcode = '23514';
  end if;

  return new;
end;
$function$;

revoke all on function public.validate_tournament_entry() from public;

create trigger tournament_entries_validate
  before insert or update of event_id, player_id, team_id, status
  on public.tournament_entries
  for each row execute function public.validate_tournament_entry();

-- ---------------------------------------------------------------------------
-- create_tournament
-- ---------------------------------------------------------------------------
create function public.create_tournament(
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_venue text default null,
  p_description text default null,
  p_registration_deadline timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_name text := nullif(btrim(p_name), '');
  v_venue text := nullif(btrim(p_venue), '');
  v_description text := nullif(btrim(p_description), '');
  v_tournament public.tournaments%rowtype;
begin
  v_actor := public.require_tournament_staff();

  if v_name is null or char_length(v_name) > 120 then
    raise exception 'a tournament name is required' using errcode = '22023';
  end if;
  if p_starts_on is null or p_ends_on is null or p_ends_on < p_starts_on then
    raise exception 'the end date must be on or after the start date' using errcode = '22023';
  end if;
  if v_venue is not null and char_length(v_venue) > 160 then
    raise exception 'venue is too long' using errcode = '22023';
  end if;
  if v_description is not null and char_length(v_description) > 2000 then
    raise exception 'description is too long' using errcode = '22023';
  end if;

  insert into public.tournaments (
    name,
    description,
    venue,
    starts_on,
    ends_on,
    registration_deadline,
    created_by
  )
  values (
    v_name,
    v_description,
    v_venue,
    p_starts_on,
    p_ends_on,
    p_registration_deadline,
    v_actor
  )
  returning * into v_tournament;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.created',
    'tournaments',
    v_tournament.id,
    jsonb_build_object(
      'name', v_tournament.name,
      'starts_on', v_tournament.starts_on,
      'ends_on', v_tournament.ends_on,
      'status', v_tournament.status
    )
  );

  return to_jsonb(v_tournament);
end;
$function$;

comment on function public.create_tournament(text, date, date, text, text, timestamptz) is
  'Tournament-manager only tournament creation. Starts in draft and is audited.';

revoke all on function public.create_tournament(text, date, date, text, text, timestamptz)
  from public, anon;
grant execute on function public.create_tournament(text, date, date, text, text, timestamptz)
  to authenticated;

-- ---------------------------------------------------------------------------
-- set_tournament_status: explicit lifecycle with no silent reversals
-- ---------------------------------------------------------------------------
create function public.set_tournament_status(p_tournament_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_tournament public.tournaments%rowtype;
begin
  v_actor := public.require_tournament_staff();

  if p_status not in ('draft', 'published', 'in_progress', 'completed', 'archived') then
    raise exception 'unknown tournament status' using errcode = '22023';
  end if;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = p_tournament_id
     for update;

  if not found then
    raise exception 'tournament not found' using errcode = 'P0002';
  end if;

  if v_tournament.status = p_status then
    return jsonb_build_object(
      'tournament_id', v_tournament.id,
      'status', p_status,
      'changed', false
    );
  end if;

  if not (
    (v_tournament.status = 'draft' and p_status in ('published', 'archived'))
    or (v_tournament.status = 'published' and p_status in ('in_progress', 'archived'))
    or (v_tournament.status = 'in_progress' and p_status = 'completed')
    or (v_tournament.status = 'completed' and p_status = 'archived')
  ) then
    raise exception 'cannot move a tournament from % to %', v_tournament.status, p_status
      using errcode = '22023';
  end if;

  if p_status = 'published' and not exists (
    select 1 from public.tournament_events as e where e.tournament_id = v_tournament.id
  ) then
    raise exception 'add at least one event before publishing' using errcode = '22023';
  end if;

  update public.tournaments
     set status = p_status
   where id = v_tournament.id;

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
    'tournament.status',
    'tournaments',
    v_tournament.id,
    jsonb_build_object('status', v_tournament.status),
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object(
    'tournament_id', v_tournament.id,
    'status', p_status,
    'changed', true
  );
end;
$function$;

comment on function public.set_tournament_status(uuid, text) is
  'Forward-only tournament lifecycle; publishing requires an event. Audited and idempotent.';

revoke all on function public.set_tournament_status(uuid, text) from public, anon;
grant execute on function public.set_tournament_status(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_tournament_event
-- ---------------------------------------------------------------------------
create function public.create_tournament_event(
  p_tournament_id uuid,
  p_discipline text,
  p_format text,
  p_max_entries integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_tournament public.tournaments%rowtype;
  v_event public.tournament_events%rowtype;
begin
  v_actor := public.require_tournament_staff();

  if p_discipline not in ('singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles') then
    raise exception 'unknown discipline' using errcode = '22023';
  end if;
  if p_format not in ('single_elimination', 'double_elimination', 'round_robin') then
    raise exception 'unknown format' using errcode = '22023';
  end if;
  if p_max_entries is null or p_max_entries < 2 or p_max_entries > 256 then
    raise exception 'max entries must be between 2 and 256' using errcode = '22023';
  end if;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = p_tournament_id
     for update;

  if not found then
    raise exception 'tournament not found' using errcode = 'P0002';
  end if;

  if v_tournament.status not in ('draft', 'published') then
    raise exception 'events can only be added before the tournament starts'
      using errcode = '22023';
  end if;

  insert into public.tournament_events (tournament_id, discipline, format, max_entries)
  values (p_tournament_id, p_discipline, p_format, p_max_entries)
  returning * into v_event;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.event_created',
    'tournament_events',
    v_event.id,
    jsonb_build_object(
      'tournament_id', p_tournament_id,
      'discipline', v_event.discipline,
      'format', v_event.format,
      'max_entries', v_event.max_entries
    )
  );

  return to_jsonb(v_event);
end;
$function$;

comment on function public.create_tournament_event(uuid, text, text, integer) is
  'Adds one event to a draft/published tournament. One event per discipline.';

revoke all on function public.create_tournament_event(uuid, text, text, integer)
  from public, anon;
grant execute on function public.create_tournament_event(uuid, text, text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- update_tournament_event: format/cap only before entries or a draw exist
-- ---------------------------------------------------------------------------
create function public.update_tournament_event(
  p_event_id uuid,
  p_format text,
  p_max_entries integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_event public.tournament_events%rowtype;
  v_tournament public.tournaments%rowtype;
  v_entry_count integer;
begin
  v_actor := public.require_tournament_staff();

  if p_format not in ('single_elimination', 'double_elimination', 'round_robin') then
    raise exception 'unknown format' using errcode = '22023';
  end if;
  if p_max_entries is null or p_max_entries < 2 or p_max_entries > 256 then
    raise exception 'max entries must be between 2 and 256' using errcode = '22023';
  end if;

  select *
    into v_event
    from public.tournament_events as e
   where e.id = p_event_id
     for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = v_event.tournament_id
     for update;

  if v_tournament.status not in ('draft', 'published') then
    raise exception 'events can only be edited before the tournament starts'
      using errcode = '22023';
  end if;

  select count(*)
    into v_entry_count
    from public.tournament_entries as en
   where en.event_id = v_event.id;

  if v_event.draw_generated_at is not null or v_entry_count > 0 then
    raise exception 'remove the draw and entries before changing the format or cap'
      using errcode = '22023';
  end if;

  update public.tournament_events
     set format = p_format,
         max_entries = p_max_entries
   where id = v_event.id
  returning * into v_event;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.event_updated',
    'tournament_events',
    v_event.id,
    jsonb_build_object('format', v_event.format, 'max_entries', v_event.max_entries),
    jsonb_build_object('format', p_format, 'max_entries', p_max_entries)
  );

  return to_jsonb(v_event);
end;
$function$;

comment on function public.update_tournament_event(uuid, text, integer) is
  'Changes format/cap only while no entries or draw exist. Audited.';

revoke all on function public.update_tournament_event(uuid, text, integer)
  from public, anon;
grant execute on function public.update_tournament_event(uuid, text, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- register_tournament_entry: singles player or doubles team
-- ---------------------------------------------------------------------------
create function public.register_tournament_entry(
  p_event_id uuid,
  p_player_ids uuid[],
  p_seed integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_event public.tournament_events%rowtype;
  v_tournament public.tournaments%rowtype;
  v_players uuid[];
  v_expected integer;
  v_active_count integer;
  v_player_count integer;
  v_male_count integer;
  v_female_count integer;
  v_team_id uuid;
  v_entry public.tournament_entries%rowtype;
begin
  v_actor := public.require_tournament_staff();

  if p_event_id is null then
    raise exception 'event is required' using errcode = '22023';
  end if;

  select *
    into v_event
    from public.tournament_events as e
   where e.id = p_event_id
     for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = v_event.tournament_id
     for update;

  if v_tournament.status not in ('draft', 'published') then
    raise exception 'registration is closed for this tournament' using errcode = '22023';
  end if;

  if v_tournament.status = 'published'
     and v_tournament.registration_deadline is not null
     and v_tournament.registration_deadline < now() then
    raise exception 'the registration deadline has passed' using errcode = '22023';
  end if;

  if v_event.draw_generated_at is not null then
    raise exception 'the draw already exists; entries are locked' using errcode = '22023';
  end if;

  v_expected := case when v_event.discipline = 'singles' then 1 else 2 end;
  v_players := array(
    select distinct p
      from unnest(coalesce(p_player_ids, array[]::uuid[])) as p
     where p is not null
  );

  if coalesce(array_length(v_players, 1), 0) <> v_expected then
    raise exception 'this event needs exactly % player(s) per entry', v_expected
      using errcode = '22023';
  end if;

  if array_length(p_player_ids, 1) <> v_expected then
    raise exception 'duplicate players are not allowed in one entry' using errcode = '22023';
  end if;

  select count(*)
    into v_player_count
    from public.players as p
   where p.id = any (v_players)
     and p.status = 'active';

  if v_player_count <> v_expected then
    raise exception 'one or more selected players are missing or inactive'
      using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.tournament_entries as en
      left join public.team_members as tm on tm.team_id = en.team_id
     where en.event_id = v_event.id
       and en.status = 'registered'
       and (en.player_id = any (v_players) or tm.player_id = any (v_players))
  ) then
    raise exception 'a player cannot be registered twice in the same event'
      using errcode = '23505';
  end if;

  select count(*)
    into v_active_count
    from public.tournament_entries as en
   where en.event_id = v_event.id
     and en.status = 'registered';

  if v_active_count >= v_event.max_entries then
    raise exception 'this event is full' using errcode = '23514';
  end if;

  if p_seed is not null and (
    p_seed < 1 or exists (
      select 1
        from public.tournament_entries as en
       where en.event_id = v_event.id
         and en.status = 'registered'
         and en.seed = p_seed
    )
  ) then
    raise exception 'that seed is already assigned' using errcode = '23505';
  end if;

  if v_expected = 2 then
    select
        count(*) filter (where p.gender = 'male'),
        count(*) filter (where p.gender = 'female')
      into v_male_count, v_female_count
      from public.players as p
     where p.id = any (v_players);

    if v_male_count + v_female_count <> 2 then
      raise exception 'both players need a recorded gender for this event'
        using errcode = '23514';
    end if;

    if v_event.discipline = 'mixed_doubles'
       and not (v_male_count = 1 and v_female_count = 1) then
      raise exception 'mixed doubles needs exactly one male and one female player'
        using errcode = '23514';
    end if;

    if v_event.discipline = 'mens_doubles' and v_male_count <> 2 then
      raise exception 'men''s doubles needs two male players' using errcode = '23514';
    end if;

    if v_event.discipline = 'womens_doubles' and v_female_count <> 2 then
      raise exception 'women''s doubles needs two female players' using errcode = '23514';
    end if;

    insert into public.teams (event_id)
    values (v_event.id)
    returning id into v_team_id;

    insert into public.team_members (team_id, player_id)
    select v_team_id, p
      from unnest(v_players) as p;
  end if;

  insert into public.tournament_entries (
    event_id,
    player_id,
    team_id,
    seed,
    created_by
  )
  values (
    v_event.id,
    case when v_expected = 1 then v_players[1] else null end,
    v_team_id,
    p_seed,
    v_actor
  )
  returning * into v_entry;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.entry_registered',
    'tournament_entries',
    v_entry.id,
    jsonb_build_object(
      'event_id', v_event.id,
      'player_ids', v_players,
      'team_id', v_team_id,
      'seed', p_seed
    )
  );

  return jsonb_build_object(
    'entry_id', v_entry.id,
    'event_id', v_entry.event_id,
    'player_ids', v_players,
    'team_id', v_entry.team_id,
    'seed', v_entry.seed,
    'status', v_entry.status
  );
end;
$function$;

comment on function public.register_tournament_entry(uuid, uuid[], integer) is
  'Registers one singles player or one doubles team. Enforces cap, duplicate players, seeds, and D10.';

revoke all on function public.register_tournament_entry(uuid, uuid[], integer)
  from public, anon;
grant execute on function public.register_tournament_entry(uuid, uuid[], integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_tournament_entry: keep the record, free the slot before the draw
-- ---------------------------------------------------------------------------
create function public.withdraw_tournament_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_entry public.tournament_entries%rowtype;
  v_event public.tournament_events%rowtype;
begin
  v_actor := public.require_tournament_staff();

  select *
    into v_entry
    from public.tournament_entries as en
   where en.id = p_entry_id
     for update;

  if not found then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;

  select *
    into v_event
    from public.tournament_events as e
   where e.id = v_entry.event_id
     for update;

  if v_event.draw_generated_at is not null then
    raise exception 'the draw already exists; withdraw before generating it'
      using errcode = '22023';
  end if;

  if v_entry.status = 'withdrawn' then
    return jsonb_build_object(
      'entry_id', v_entry.id,
      'status', v_entry.status,
      'changed', false
    );
  end if;

  update public.tournament_entries
     set status = 'withdrawn'
   where id = v_entry.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.entry_withdrawn',
    'tournament_entries',
    v_entry.id,
    jsonb_build_object('status', v_entry.status),
    jsonb_build_object('status', 'withdrawn')
  );

  return jsonb_build_object(
    'entry_id', v_entry.id,
    'status', 'withdrawn',
    'changed', true
  );
end;
$function$;

comment on function public.withdraw_tournament_entry(uuid) is
  'Marks an entry withdrawn before the draw. Never deletes the entry or its history.';

revoke all on function public.withdraw_tournament_entry(uuid) from public, anon;
grant execute on function public.withdraw_tournament_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- save_tournament_draw: persist a generated or manually edited draw
--
-- Each item: key, bracket, round, position, home_entry_id/away_entry_id,
-- home_source_key/away_source_key + outcome, conditional, reset.
-- Sources must refer to an earlier key in the array, so the payload is a valid
-- dependency order and no cycle can be stored.
-- ---------------------------------------------------------------------------
create function public.save_tournament_draw(
  p_event_id uuid,
  p_matches jsonb,
  p_replace boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_event public.tournament_events%rowtype;
  v_tournament public.tournaments%rowtype;
  v_item record;
  v_key text;
  v_bracket text;
  v_round integer;
  v_position integer;
  v_home_entry uuid;
  v_away_entry uuid;
  v_home_source_key text;
  v_away_source_key text;
  v_home_outcome text;
  v_away_outcome text;
  v_home_source uuid;
  v_away_source uuid;
  v_match_id uuid;
  v_keys text[] := array[]::text[];
  v_ids uuid[] := array[]::uuid[];
  v_seen_entries uuid[] := array[]::uuid[];
  v_pair_keys text[] := array[]::text[];
  v_active_count integer;
  v_existing_count integer;
  v_seen_count integer;
  v_distinct_count integer;
  v_source_index integer;
  v_pair_key text;
begin
  v_actor := public.require_tournament_staff();

  select *
    into v_event
    from public.tournament_events as e
   where e.id = p_event_id
     for update;

  if not found then
    raise exception 'event not found' using errcode = 'P0002';
  end if;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = v_event.tournament_id
     for update;

  if v_tournament.status not in ('draft', 'published') then
    raise exception 'the draw can only be set before the tournament starts'
      using errcode = '22023';
  end if;

  if p_matches is null or jsonb_typeof(p_matches) <> 'array' then
    raise exception 'draw must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_matches) = 0 or jsonb_array_length(p_matches) > 2048 then
    raise exception 'draw must contain between 1 and 2048 matches' using errcode = '22023';
  end if;

  select count(*)
    into v_existing_count
    from public.matches as m
   where m.event_id = v_event.id;

  if v_existing_count > 0 then
    if not p_replace then
      raise exception 'a draw already exists; pass replace to overwrite it'
        using errcode = '22023';
    end if;

    if exists (
      select 1
        from public.matches as m
       where m.event_id = v_event.id
         and m.status = 'completed'
    ) then
      raise exception 'a draw with results cannot be replaced' using errcode = '22023';
    end if;

    delete from public.matches as m where m.event_id = v_event.id;
  end if;

  select count(*)
    into v_active_count
    from public.tournament_entries as en
   where en.event_id = v_event.id
     and en.status = 'registered';

  if v_active_count < 2 then
    raise exception 'a draw needs at least two registered entries' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_matches)
  loop
    v_key := nullif(btrim(v_item.value->>'key'), '');
    if v_key is null then
      raise exception 'every draw match needs a key' using errcode = '22023';
    end if;
    if array_position(v_keys, v_key) is not null then
      raise exception 'duplicate draw key: %', v_key using errcode = '22023';
    end if;

    v_bracket := v_item.value->>'bracket';
    if v_bracket is null then
      raise exception 'draw match % has no bracket', v_key using errcode = '22023';
    end if;

    if v_event.format = 'single_elimination' and v_bracket <> 'winners' then
      raise exception 'a single-elimination draw only has winners-bracket matches'
        using errcode = '22023';
    end if;
    if v_event.format = 'round_robin' and v_bracket <> 'round_robin' then
      raise exception 'a round-robin draw only has round-robin matches'
        using errcode = '22023';
    end if;
    if v_event.format = 'double_elimination'
       and v_bracket not in ('winners', 'losers', 'grand_final') then
      raise exception 'a double-elimination draw has winners, losers, and grand-final matches'
        using errcode = '22023';
    end if;

    v_round := (v_item.value->>'round')::integer;
    v_position := (v_item.value->>'position')::integer;
    if v_round is null or v_round < 1 or v_position is null or v_position < 1 then
      raise exception 'draw match % needs a positive round and position', v_key
        using errcode = '22023';
    end if;

    v_home_entry := nullif(v_item.value->>'home_entry_id', '')::uuid;
    v_away_entry := nullif(v_item.value->>'away_entry_id', '')::uuid;
    v_home_source_key := nullif(btrim(v_item.value->>'home_source_key'), '');
    v_away_source_key := nullif(btrim(v_item.value->>'away_source_key'), '');
    v_home_outcome := nullif(v_item.value->>'home_source_outcome', '');
    v_away_outcome := nullif(v_item.value->>'away_source_outcome', '');

    if v_home_entry is null and v_home_source_key is null then
      raise exception 'draw match % is missing its home side', v_key using errcode = '22023';
    end if;
    if v_away_entry is null and v_away_source_key is null then
      raise exception 'draw match % is missing its away side', v_key using errcode = '22023';
    end if;
    if v_home_entry is not null and v_home_source_key is not null then
      raise exception 'draw match % must start with an entry or a source, not both', v_key
        using errcode = '22023';
    end if;
    if v_away_entry is not null and v_away_source_key is not null then
      raise exception 'draw match % must start with an entry or a source, not both', v_key
        using errcode = '22023';
    end if;
    if (v_home_source_key is null) <> (v_home_outcome is null) then
      raise exception 'draw match % needs a home source outcome', v_key using errcode = '22023';
    end if;
    if (v_away_source_key is null) <> (v_away_outcome is null) then
      raise exception 'draw match % needs an away source outcome', v_key using errcode = '22023';
    end if;
    if v_home_outcome is not null and v_home_outcome not in ('winner', 'loser') then
      raise exception 'unknown home source outcome on %', v_key using errcode = '22023';
    end if;
    if v_away_outcome is not null and v_away_outcome not in ('winner', 'loser') then
      raise exception 'unknown away source outcome on %', v_key using errcode = '22023';
    end if;

    if v_event.format = 'round_robin'
       and (v_home_source_key is not null or v_away_source_key is not null) then
      raise exception 'round-robin matches have no source matches' using errcode = '22023';
    end if;

    if v_bracket = 'grand_final' and coalesce((v_item.value->>'reset')::boolean, false)
       and v_home_source_key is null then
      raise exception 'a grand-final reset must point at the first final' using errcode = '22023';
    end if;

    if v_home_entry is not null then
      if not exists (
        select 1
          from public.tournament_entries as en
         where en.id = v_home_entry
           and en.event_id = v_event.id
           and en.status = 'registered'
      ) then
        raise exception 'draw match % refers to an unknown or withdrawn entry', v_key
          using errcode = '22023';
      end if;
      if v_event.format <> 'round_robin'
         and array_position(v_seen_entries, v_home_entry) is not null then
        raise exception 'an entry appears twice as a starting side' using errcode = '22023';
      end if;
      v_seen_entries := array_append(v_seen_entries, v_home_entry);
    end if;

    if v_away_entry is not null then
      if not exists (
        select 1
          from public.tournament_entries as en
         where en.id = v_away_entry
           and en.event_id = v_event.id
           and en.status = 'registered'
      ) then
        raise exception 'draw match % refers to an unknown or withdrawn entry', v_key
          using errcode = '22023';
      end if;
      if v_event.format <> 'round_robin'
         and array_position(v_seen_entries, v_away_entry) is not null then
        raise exception 'an entry appears twice as a starting side' using errcode = '22023';
      end if;
      v_seen_entries := array_append(v_seen_entries, v_away_entry);
    end if;

    if v_home_entry is not null and v_away_entry is not null
       and v_home_entry = v_away_entry then
      raise exception 'an entry cannot play itself' using errcode = '22023';
    end if;

    if v_home_source_key is not null then
      v_source_index := array_position(v_keys, v_home_source_key);
      if v_source_index is null then
        raise exception 'draw match % refers to a later or unknown source %', v_key, v_home_source_key
          using errcode = '22023';
      end if;
      v_home_source := v_ids[v_source_index];
    else
      v_home_source := null;
    end if;

    if v_away_source_key is not null then
      v_source_index := array_position(v_keys, v_away_source_key);
      if v_source_index is null then
        raise exception 'draw match % refers to a later or unknown source %', v_key, v_away_source_key
          using errcode = '22023';
      end if;
      v_away_source := v_ids[v_source_index];
    else
      v_away_source := null;
    end if;

    if v_event.format = 'round_robin' then
      v_pair_key := least(v_home_entry::text, v_away_entry::text)
        || ':' || greatest(v_home_entry::text, v_away_entry::text);
      if array_position(v_pair_keys, v_pair_key) is not null then
        raise exception 'a round-robin pair appears twice' using errcode = '22023';
      end if;
      v_pair_keys := array_append(v_pair_keys, v_pair_key);
    end if;

    insert into public.matches (
      event_id,
      bracket,
      round,
      position,
      home_entry_id,
      away_entry_id,
      home_source_match_id,
      away_source_match_id,
      home_source_outcome,
      away_source_outcome,
      conditional,
      reset
    )
    values (
      v_event.id,
      v_bracket,
      v_round,
      v_position,
      v_home_entry,
      v_away_entry,
      v_home_source,
      v_away_source,
      v_home_outcome,
      v_away_outcome,
      coalesce((v_item.value->>'conditional')::boolean, false),
      coalesce((v_item.value->>'reset')::boolean, false)
    )
    returning id into v_match_id;

    v_keys := array_append(v_keys, v_key);
    v_ids := array_append(v_ids, v_match_id);
  end loop;

  v_seen_count := coalesce(array_length(v_seen_entries, 1), 0);
  select count(distinct e)
    into v_distinct_count
    from unnest(v_seen_entries) as e;

  if v_event.format = 'round_robin' then
    if v_seen_count <> v_active_count * (v_active_count - 1)
       or v_distinct_count <> v_active_count then
      raise exception 'a round-robin draw must contain every pair exactly once'
        using errcode = '22023';
    end if;

    if exists (
      select 1
        from unnest(v_seen_entries) as e
       group by e
      having count(*) <> v_active_count - 1
    ) then
      raise exception 'every entry must play the same number of round-robin matches'
        using errcode = '22023';
    end if;
  else
    if v_seen_count <> v_active_count or v_distinct_count <> v_active_count then
      raise exception 'an elimination draw must place every registered entry exactly once'
        using errcode = '22023';
    end if;
  end if;

  if v_event.draw_generated_at is null then
    update public.tournament_events
       set draw_generated_at = now()
     where id = v_event.id;
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    case when v_existing_count > 0 then 'tournament.draw_replaced' else 'tournament.draw_saved' end,
    'tournament_events',
    v_event.id,
    jsonb_build_object('match_count', v_existing_count),
    jsonb_build_object('match_count', jsonb_array_length(p_matches), 'entry_count', v_active_count)
  );

  return jsonb_build_object(
    'event_id', v_event.id,
    'match_count', jsonb_array_length(p_matches),
    'entry_count', v_active_count,
    'replaced', v_existing_count > 0
  );
end;
$function$;

comment on function public.save_tournament_draw(uuid, jsonb, boolean) is
  'Persists a draw in dependency order, validates coverage and sources, and locks entries. Replace is allowed only before results.';

revoke all on function public.save_tournament_draw(uuid, jsonb, boolean) from public, anon;
grant execute on function public.save_tournament_draw(uuid, jsonb, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- score_match_games: validate an ordered game list and decide the winner
-- ---------------------------------------------------------------------------
create function public.score_match_games(
  p_home_entry_id uuid,
  p_away_entry_id uuid,
  p_games jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_item jsonb;
  v_index integer := 0;
  v_home_points integer;
  v_away_points integer;
  v_home_wins integer := 0;
  v_away_wins integer := 0;
  v_games jsonb := '[]'::jsonb;
begin
  if p_home_entry_id is null or p_away_entry_id is null
     or p_home_entry_id = p_away_entry_id then
    raise exception 'a match needs two different entries' using errcode = '22023';
  end if;

  if p_games is null or jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) = 0 then
    raise exception 'at least one game score is required' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_games)
  loop
    v_index := v_index + 1;

    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'each game must be an object' using errcode = '22023';
    end if;

    v_home_points := (v_item->>'home_points')::integer;
    v_away_points := (v_item->>'away_points')::integer;

    if v_home_points is null or v_away_points is null
       or v_home_points < 0 or v_away_points < 0 then
      raise exception 'game points must be non-negative whole numbers'
        using errcode = '22023';
    end if;
    if v_home_points = v_away_points then
      raise exception 'a game cannot end level' using errcode = '22023';
    end if;

    if v_home_points > v_away_points then
      v_home_wins := v_home_wins + 1;
    else
      v_away_wins := v_away_wins + 1;
    end if;

    v_games := v_games || jsonb_build_array(
      jsonb_build_object(
        'game_number', v_index,
        'home_points', v_home_points,
        'away_points', v_away_points
      )
    );
  end loop;

  if v_home_wins = v_away_wins then
    raise exception 'the match must have a winner' using errcode = '22023';
  end if;

  return jsonb_build_object(
    'games', v_games,
    'home_games', v_home_wins,
    'away_games', v_away_wins,
    'winner_entry_id', case when v_home_wins > v_away_wins
      then p_home_entry_id else p_away_entry_id end
  );
end;
$function$;

revoke all on function public.score_match_games(uuid, uuid, jsonb) from public;

-- ---------------------------------------------------------------------------
-- apply_match_result: internal mutation used by record and correct wrappers
-- ---------------------------------------------------------------------------
create function public.apply_match_result(
  p_match_id uuid,
  p_games jsonb,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_match public.matches%rowtype;
  v_result jsonb;
  v_winner uuid;
  v_loser uuid;
  v_reset public.matches%rowtype;
begin
  select *
    into v_match
    from public.matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_match.status <> 'pending' then
    raise exception 'match already has a result' using errcode = '22023';
  end if;

  if v_match.home_entry_id is null or v_match.away_entry_id is null then
    raise exception 'both sides must be decided before recording a result'
      using errcode = '22023';
  end if;

  v_result := public.score_match_games(
    v_match.home_entry_id,
    v_match.away_entry_id,
    p_games
  );
  v_winner := (v_result->>'winner_entry_id')::uuid;
  v_loser := case when v_winner = v_match.home_entry_id
    then v_match.away_entry_id else v_match.home_entry_id end;

  insert into public.match_games (match_id, game_number, home_points, away_points)
  select
      p_match_id,
      (game->>'game_number')::integer,
      (game->>'home_points')::integer,
      (game->>'away_points')::integer
    from jsonb_array_elements(v_result->'games') as game;

  update public.matches
     set winner_entry_id = v_winner,
         status = 'completed',
         recorded_by = p_actor,
         recorded_at = now()
   where id = p_match_id;

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
             recorded_by = p_actor,
             recorded_at = now()
       where id = v_reset.id;
    end if;
  end if;

  return v_result || jsonb_build_object(
    'match_id', p_match_id,
    'winner_entry_id', v_winner,
    'loser_entry_id', v_loser
  );
end;
$function$;

revoke all on function public.apply_match_result(uuid, jsonb, uuid) from public;

-- ---------------------------------------------------------------------------
-- record_match_result
-- ---------------------------------------------------------------------------
create function public.record_match_result(p_match_id uuid, p_games jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_match public.matches%rowtype;
  v_result jsonb;
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

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.match_result',
    'matches',
    p_match_id,
    v_result
  );

  return v_result;
end;
$function$;

comment on function public.record_match_result(uuid, jsonb) is
  'Records the first result for a ready match, advances the winner/loser, and audits.';

revoke all on function public.record_match_result(uuid, jsonb) from public, anon;
grant execute on function public.record_match_result(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- correct_match_result: replace a result before anything downstream is played
-- ---------------------------------------------------------------------------
create function public.correct_match_result(
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

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.match_result_corrected',
    'matches',
    p_match_id,
    v_before,
    v_result || jsonb_build_object('reason', v_reason)
  );

  return v_result;
end;
$function$;

comment on function public.correct_match_result(uuid, jsonb, text) is
  'Replaces a result and re-advances it, only while downstream matches are unplayed. Audited with a reason.';

revoke all on function public.correct_match_result(uuid, jsonb, text) from public, anon;
grant execute on function public.correct_match_result(uuid, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS is enabled here; policies are applied by 005_tournaments.sql
-- ---------------------------------------------------------------------------
alter table public.tournaments enable row level security;
alter table public.tournament_events enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.matches enable row level security;
alter table public.match_games enable row level security;

commit;
