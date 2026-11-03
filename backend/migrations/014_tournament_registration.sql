-- MBC Arena - Migration 014: player self-registration, partner invitations, and fees
--
-- Apply after 013_players_friends_notifications.sql. Policies live in
-- backend/policies/014_tournament_registration.sql.
--
-- Scope:
--   * tournament posters and a per-player entrance fee;
--   * one payment row per participant, marked by tournament staff;
--   * self-service singles/doubles registration, including guest partners;
--   * doubles partner invitations that become entries only after acceptance;
--   * draw eligibility limited to fully paid/waived entries.
--
-- Design notes:
--   * a guest is a tournament-only team member. No player record and no account
--     are created, so the club directory stays clean;
--   * payment is tracked per participant, not per entry, so a doubles pair is
--     eligible only when both players are paid or waived;
--   * entries are never deleted. Withdrawal changes status and keeps history;
--   * unpaid entries remain registered but are skipped by the draw. Once the
--     draw exists, entries are locked as before.
--
-- This migration is intentionally not idempotent. It fails loudly if applied
-- twice, like the earlier migrations.

begin;

-- ---------------------------------------------------------------------------
-- tournaments: poster and entrance fee
-- ---------------------------------------------------------------------------
alter table public.tournaments
  add column poster_path text;

alter table public.tournaments
  add constraint tournaments_poster_path_check
  check (
    poster_path is null
    or (
      char_length(poster_path) <= 400
      and poster_path ~
        '^posters/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
    )
  );

alter table public.tournaments
  add column entrance_fee numeric(10, 2) not null default 0;

alter table public.tournaments
  add constraint tournaments_entrance_fee_check
  check (entrance_fee >= 0 and entrance_fee <= 1000000);

comment on column public.tournaments.poster_path is
  'Object path inside the tournament-posters bucket; null when no poster was uploaded.';
comment on column public.tournaments.entrance_fee is
  'Fee per player, in the club currency. Snapshotted onto each participant payment row.';

-- ---------------------------------------------------------------------------
-- team_members: real player OR tournament-only guest
-- ---------------------------------------------------------------------------
alter table public.team_members drop constraint team_members_pkey;

alter table public.team_members
  add column id uuid not null default gen_random_uuid();

alter table public.team_members
  add constraint team_members_pkey primary key (id);

alter table public.team_members
  alter column player_id drop not null;

alter table public.team_members
  add column guest_name text;

alter table public.team_members
  add column guest_gender text;

alter table public.team_members
  add constraint team_members_owner_check
  check ((player_id is null) <> (guest_name is null));

alter table public.team_members
  add constraint team_members_guest_name_check
  check (
    guest_name is null
    or (guest_name = btrim(guest_name) and char_length(guest_name) between 1 and 120)
  );

alter table public.team_members
  add constraint team_members_guest_gender_check
  check (
    (guest_name is null and guest_gender is null)
    or (guest_name is not null and guest_gender in ('male', 'female'))
  );

comment on column public.team_members.guest_name is
  'Tournament-only partner with no club account. No players row is created for a guest.';
comment on column public.team_members.guest_gender is
  'Recorded so Mixed Doubles and same-gender doubles can be validated for a guest.';

create unique index team_members_team_player_key
  on public.team_members (team_id, player_id)
  where player_id is not null;

-- ---------------------------------------------------------------------------
-- tournament_entry_payments: one row per participant
-- ---------------------------------------------------------------------------
create table public.tournament_entry_payments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.tournament_entries (id) on delete cascade,
  player_id uuid references public.players (id) on delete restrict,
  guest_name text,
  amount numeric(10, 2) not null default 0,
  status text not null default 'unpaid',
  marked_by uuid references public.profiles (id) on delete set null,
  marked_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tournament_entry_payments_owner_check
    check ((player_id is null) <> (guest_name is null)),
  constraint tournament_entry_payments_amount_check
    check (amount >= 0 and amount <= 1000000),
  constraint tournament_entry_payments_status_check
    check (status in ('unpaid', 'paid', 'waived')),
  constraint tournament_entry_payments_note_check
    check (note is null or char_length(note) <= 500),
  constraint tournament_entry_payments_marked_check
    check (
      (status = 'unpaid' and marked_at is null)
      or (status in ('paid', 'waived') and marked_at is not null)
    ),
  constraint tournament_entry_payments_guest_name_check
    check (
      guest_name is null
      or (guest_name = btrim(guest_name) and char_length(guest_name) between 1 and 120)
    )
);

comment on table public.tournament_entry_payments is
  'Per-participant entrance-fee record. Staff mark paid/waived; unpaid rows block the draw.';

create unique index tournament_entry_payments_entry_player_key
  on public.tournament_entry_payments (entry_id, player_id)
  where player_id is not null;

create unique index tournament_entry_payments_entry_guest_key
  on public.tournament_entry_payments (entry_id, guest_name)
  where guest_name is not null;

create index tournament_entry_payments_entry_idx
  on public.tournament_entry_payments (entry_id, status);

create trigger tournament_entry_payments_set_updated_at
  before update on public.tournament_entry_payments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tournament_partner_invitations: friend doubles pair, before the entry exists
-- ---------------------------------------------------------------------------
create table public.tournament_partner_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tournament_events (id) on delete restrict,
  inviter_player_id uuid not null references public.players (id) on delete restrict,
  partner_player_id uuid not null references public.players (id) on delete restrict,
  status text not null default 'pending',
  entry_id uuid references public.tournament_entries (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint tournament_partner_invitations_pair_check
    check (inviter_player_id <> partner_player_id),
  constraint tournament_partner_invitations_status_check
    check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  constraint tournament_partner_invitations_responded_check
    check (
      (status = 'pending' and responded_at is null and entry_id is null)
      or (status = 'accepted' and responded_at is not null and entry_id is not null)
      or (status in ('declined', 'cancelled') and responded_at is not null and entry_id is null)
    )
);

comment on table public.tournament_partner_invitations is
  'Doubles partner invite. Accepting creates the team and entry; declining or cancelling creates none.';

create unique index tournament_partner_invitations_open_inviter_key
  on public.tournament_partner_invitations (event_id, inviter_player_id)
  where status = 'pending';

create unique index tournament_partner_invitations_open_partner_key
  on public.tournament_partner_invitations (event_id, partner_player_id)
  where status = 'pending';

create index tournament_partner_invitations_partner_idx
  on public.tournament_partner_invitations (partner_player_id, status);

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create function public.entry_payment_complete(p_entry_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.tournament_entry_payments as p
     where p.entry_id = p_entry_id
  )
  and not exists (
    select 1
      from public.tournament_entry_payments as p
     where p.entry_id = p_entry_id
       and p.status = 'unpaid'
  );
$function$;

comment on function public.entry_payment_complete(uuid) is
  'True when every participant on the entry is paid or waived. An entry with no payment rows is not eligible.';

revoke all on function public.entry_payment_complete(uuid) from public;
grant execute on function public.entry_payment_complete(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- validate_team_member: allow a guest second member
-- ---------------------------------------------------------------------------
create or replace function public.validate_team_member()
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

  if new.player_id is not null and exists (
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

drop trigger if exists team_members_validate on public.team_members;

create trigger team_members_validate
  before insert or update of team_id, player_id, guest_name on public.team_members
  for each row execute function public.validate_team_member();

-- ---------------------------------------------------------------------------
-- validate_tournament_entry: count guest genders too
-- ---------------------------------------------------------------------------
create or replace function public.validate_tournament_entry()
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
      count(*) filter (where coalesce(p.gender, tm.guest_gender) = 'male'),
      count(*) filter (where coalesce(p.gender, tm.guest_gender) = 'female')
    into v_member_count, v_male_count, v_female_count
    from public.team_members as tm
    left join public.players as p on p.id = tm.player_id
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

-- ---------------------------------------------------------------------------
-- backfill existing entries as waived so old draws stay valid
-- ---------------------------------------------------------------------------
insert into public.tournament_entry_payments (
  entry_id,
  player_id,
  guest_name,
  amount,
  status,
  marked_at
)
select en.id, en.player_id, null, 0, 'waived', now()
  from public.tournament_entries as en
 where en.player_id is not null
on conflict do nothing;

insert into public.tournament_entry_payments (
  entry_id,
  player_id,
  guest_name,
  amount,
  status,
  marked_at
)
select en.id, tm.player_id, null, 0, 'waived', now()
  from public.tournament_entries as en
  join public.team_members as tm on tm.team_id = en.team_id
 where en.team_id is not null
   and tm.player_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- register_tournament_entry: staff entry now creates payment rows
-- ---------------------------------------------------------------------------
create or replace function public.register_tournament_entry(
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
  v_payment_status text;
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

  v_payment_status := case when v_tournament.entrance_fee = 0 then 'waived' else 'unpaid' end;

  insert into public.tournament_entry_payments (
    entry_id,
    player_id,
    guest_name,
    amount,
    status,
    marked_by,
    marked_at
  )
  select
      v_entry.id,
      p,
      null,
      v_tournament.entrance_fee,
      v_payment_status,
      case when v_payment_status = 'waived' then v_actor else null end,
      case when v_payment_status = 'waived' then now() else null end
    from unnest(v_players) as p;

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
      'seed', p_seed,
      'entrance_fee', v_tournament.entrance_fee
    )
  );

  return jsonb_build_object(
    'entry_id', v_entry.id,
    'event_id', v_entry.event_id,
    'player_ids', v_players,
    'team_id', v_entry.team_id,
    'seed', v_entry.seed,
    'status', v_entry.status,
    'payment_status', v_payment_status
  );
end;
$function$;

comment on function public.register_tournament_entry(uuid, uuid[], integer) is
  'Staff entry. Enforces cap, duplicate players, seeds, and D10; creates per-participant payment rows.';

-- ---------------------------------------------------------------------------
-- join_tournament_event: a linked player enters themself
-- ---------------------------------------------------------------------------
create function public.join_tournament_event(
  p_event_id uuid,
  p_partner_player_id uuid default null,
  p_guest_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid;
  v_gender text;
  v_event public.tournament_events%rowtype;
  v_tournament public.tournaments%rowtype;
  v_partner public.players%rowtype;
  v_team_id uuid;
  v_entry public.tournament_entries%rowtype;
  v_invitation public.tournament_partner_invitations%rowtype;
  v_guest text := nullif(btrim(coalesce(p_guest_name, '')), '');
  v_guest_gender text;
  v_active_count integer;
  v_payment_status text;
  v_fee numeric(10, 2);
begin
  v_player := public.require_friendly_player();

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

  if v_tournament.status <> 'published' then
    raise exception 'registration is not open for this tournament' using errcode = '22023';
  end if;

  if v_tournament.registration_deadline is not null
     and v_tournament.registration_deadline < now() then
    raise exception 'the registration deadline has passed' using errcode = '22023';
  end if;

  if v_event.draw_generated_at is not null then
    raise exception 'the draw already exists; entries are locked' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.tournament_entries as en
      left join public.team_members as tm on tm.team_id = en.team_id
     where en.event_id = v_event.id
       and en.status = 'registered'
       and (en.player_id = v_player or tm.player_id = v_player)
  ) then
    raise exception 'you are already registered in this event' using errcode = '23505';
  end if;

  select count(*)
    into v_active_count
    from public.tournament_entries as en
   where en.event_id = v_event.id
     and en.status = 'registered';

  if v_active_count >= v_event.max_entries then
    raise exception 'this event is full' using errcode = '23514';
  end if;

  v_fee := v_tournament.entrance_fee;
  v_payment_status := case when v_fee = 0 then 'waived' else 'unpaid' end;

  if v_event.discipline = 'singles' then
    if p_partner_player_id is not null or v_guest is not null then
      raise exception 'a singles entry cannot have a partner' using errcode = '22023';
    end if;

    insert into public.tournament_entries (event_id, player_id, created_by)
    values (v_event.id, v_player, v_actor)
    returning * into v_entry;

    insert into public.tournament_entry_payments (
      entry_id, player_id, amount, status, marked_by, marked_at
    )
    values (
      v_entry.id,
      v_player,
      v_fee,
      v_payment_status,
      case when v_payment_status = 'waived' then v_actor else null end,
      case when v_payment_status = 'waived' then now() else null end
    );

    insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
    values (
      v_actor,
      'tournament.entry_self_registered',
      'tournament_entries',
      v_entry.id,
      jsonb_build_object('event_id', v_event.id, 'player_id', v_player, 'discipline', 'singles')
    );

    return jsonb_build_object(
      'entry_id', v_entry.id,
      'event_id', v_event.id,
      'status', 'registered',
      'payment_status', v_payment_status,
      'entrance_fee', v_fee
    );
  end if;

  if (p_partner_player_id is null) = (v_guest is null) then
    raise exception 'choose either a club partner or a guest partner' using errcode = '22023';
  end if;

  select p.gender
    into v_gender
    from public.players as p
   where p.id = v_player;

  if v_gender is null then
    raise exception 'your player record needs a recorded gender for doubles'
      using errcode = '23514';
  end if;

  if v_guest is not null then
    if char_length(v_guest) > 120 then
      raise exception 'the guest partner name is too long' using errcode = '22023';
    end if;

    v_guest_gender := case
      when v_event.discipline = 'mixed_doubles' then
        case when v_gender = 'male' then 'female' else 'male' end
      when v_event.discipline = 'mens_doubles' then 'male'
      else 'female'
    end;

    if v_event.discipline = 'mens_doubles' and v_gender <> 'male' then
      raise exception 'men''s doubles needs two male players' using errcode = '23514';
    end if;

    if v_event.discipline = 'womens_doubles' and v_gender <> 'female' then
      raise exception 'women''s doubles needs two female players' using errcode = '23514';
    end if;

    insert into public.teams (event_id)
    values (v_event.id)
    returning id into v_team_id;

    insert into public.team_members (team_id, player_id)
    values (v_team_id, v_player);

    insert into public.team_members (team_id, guest_name, guest_gender)
    values (v_team_id, v_guest, v_guest_gender);

    insert into public.tournament_entries (event_id, team_id, created_by)
    values (v_event.id, v_team_id, v_actor)
    returning * into v_entry;

    insert into public.tournament_entry_payments (
      entry_id, player_id, guest_name, amount, status, marked_by, marked_at
    )
    values
      (
        v_entry.id, v_player, null, v_fee, v_payment_status,
        case when v_payment_status = 'waived' then v_actor else null end,
        case when v_payment_status = 'waived' then now() else null end
      ),
      (
        v_entry.id, null, v_guest, v_fee, v_payment_status,
        case when v_payment_status = 'waived' then v_actor else null end,
        case when v_payment_status = 'waived' then now() else null end
      );

    insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
    values (
      v_actor,
      'tournament.entry_self_registered',
      'tournament_entries',
      v_entry.id,
      jsonb_build_object(
        'event_id', v_event.id,
        'player_id', v_player,
        'guest_name', v_guest,
        'discipline', v_event.discipline
      )
    );

    return jsonb_build_object(
      'entry_id', v_entry.id,
      'event_id', v_event.id,
      'status', 'registered',
      'payment_status', v_payment_status,
      'entrance_fee', v_fee,
      'guest_name', v_guest
    );
  end if;

  select *
    into v_partner
    from public.players as p
   where p.id = p_partner_player_id
     for update;

  if not found then
    raise exception 'partner not found' using errcode = 'P0002';
  end if;

  if v_partner.id = v_player then
    raise exception 'you cannot partner yourself' using errcode = '22023';
  end if;

  if v_partner.status <> 'active' or v_partner.profile_id is null then
    raise exception 'that partner needs an active club account' using errcode = '22023';
  end if;

  if not public.is_friend(v_player, v_partner.id) then
    raise exception 'you can only invite an accepted friend as a partner'
      using errcode = '42501';
  end if;

  if exists (
    select 1
      from public.tournament_entries as en
      left join public.team_members as tm on tm.team_id = en.team_id
     where en.event_id = v_event.id
       and en.status = 'registered'
       and (en.player_id = v_partner.id or tm.player_id = v_partner.id)
  ) then
    raise exception 'that player is already registered in this event'
      using errcode = '23505';
  end if;

  if exists (
    select 1
      from public.tournament_partner_invitations as i
     where i.event_id = v_event.id
       and i.status = 'pending'
       and (
         i.inviter_player_id in (v_player, v_partner.id)
         or i.partner_player_id in (v_player, v_partner.id)
       )
  ) then
    raise exception 'one of you already has a pending partner invitation for this event'
      using errcode = '23505';
  end if;

  insert into public.tournament_partner_invitations (
    event_id,
    inviter_player_id,
    partner_player_id,
    created_by
  )
  values (v_event.id, v_player, v_partner.id, v_actor)
  returning * into v_invitation;

  perform public.notify_profile(
    v_partner.profile_id,
    'partner_invitation',
    'Doubles partner invitation',
    'Accept to join their team in ' || v_tournament.name || '.',
    '/tournaments/' || v_tournament.id,
    v_tournament.id,
    v_actor
  );

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.partner_invited',
    'tournament_partner_invitations',
    v_invitation.id,
    jsonb_build_object(
      'event_id', v_event.id,
      'inviter_player_id', v_player,
      'partner_player_id', v_partner.id
    )
  );

  return jsonb_build_object(
    'invitation_id', v_invitation.id,
    'event_id', v_event.id,
    'status', 'pending_partner',
    'partner_player_id', v_partner.id,
    'entrance_fee', v_fee
  );
end;
$function$;

comment on function public.join_tournament_event(uuid, uuid, text) is
  'Player self-entry. Singles and guest doubles register immediately; a club partner gets a pending invitation.';

revoke all on function public.join_tournament_event(uuid, uuid, text) from public, anon;
grant execute on function public.join_tournament_event(uuid, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- respond_tournament_partner_invitation
-- ---------------------------------------------------------------------------
create function public.respond_tournament_partner_invitation(
  p_invitation_id uuid,
  p_accept boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid;
  v_invitation public.tournament_partner_invitations%rowtype;
  v_inviter public.players%rowtype;
  v_event public.tournament_events%rowtype;
  v_tournament public.tournaments%rowtype;
  v_team_id uuid;
  v_entry public.tournament_entries%rowtype;
  v_active_count integer;
  v_payment_status text;
  v_fee numeric(10, 2);
begin
  v_player := public.require_friendly_player();

  select *
    into v_invitation
    from public.tournament_partner_invitations as i
   where i.id = p_invitation_id
     for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if v_invitation.partner_player_id <> v_player then
    raise exception 'only the invited player can answer this invitation' using errcode = '42501';
  end if;

  if v_invitation.status <> 'pending' then
    return jsonb_build_object(
      'invitation_id', v_invitation.id,
      'status', v_invitation.status,
      'changed', false
    );
  end if;

  select *
    into v_event
    from public.tournament_events as e
   where e.id = v_invitation.event_id
     for update;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = v_event.tournament_id
     for update;

  select *
    into v_inviter
    from public.players as p
   where p.id = v_invitation.inviter_player_id;

  if not p_accept then
    update public.tournament_partner_invitations
       set status = 'declined',
           responded_at = now()
     where id = v_invitation.id
    returning * into v_invitation;

    perform public.notify_profile(
      v_inviter.profile_id,
      'partner_invitation_declined',
      'Partner invitation declined',
      'Choose another partner or a guest before the draw.',
      '/tournaments/' || v_tournament.id,
      v_tournament.id,
      v_actor
    );

    return jsonb_build_object(
      'invitation_id', v_invitation.id,
      'status', 'declined',
      'changed', true
    );
  end if;

  if v_tournament.status <> 'published' then
    raise exception 'registration is not open for this tournament' using errcode = '22023';
  end if;

  if v_tournament.registration_deadline is not null
     and v_tournament.registration_deadline < now() then
    raise exception 'the registration deadline has passed' using errcode = '22023';
  end if;

  if v_event.draw_generated_at is not null then
    raise exception 'the draw already exists; entries are locked' using errcode = '22023';
  end if;

  if v_inviter.status <> 'active' then
    raise exception 'the inviting player is no longer active' using errcode = '22023';
  end if;

  if exists (
    select 1
      from public.tournament_entries as en
      left join public.team_members as tm on tm.team_id = en.team_id
     where en.event_id = v_event.id
       and en.status = 'registered'
       and (
         en.player_id in (v_inviter.id, v_player)
         or tm.player_id in (v_inviter.id, v_player)
       )
  ) then
    raise exception 'one of the players is already registered in this event'
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

  insert into public.teams (event_id)
  values (v_event.id)
  returning id into v_team_id;

  insert into public.team_members (team_id, player_id)
  values (v_team_id, v_inviter.id), (v_team_id, v_player);

  insert into public.tournament_entries (event_id, team_id, created_by)
  values (v_event.id, v_team_id, v_inviter.profile_id)
  returning * into v_entry;

  v_fee := v_tournament.entrance_fee;
  v_payment_status := case when v_fee = 0 then 'waived' else 'unpaid' end;

  insert into public.tournament_entry_payments (
    entry_id, player_id, amount, status, marked_by, marked_at
  )
  values
    (
      v_entry.id, v_inviter.id, v_fee, v_payment_status,
      case when v_payment_status = 'waived' then v_actor else null end,
      case when v_payment_status = 'waived' then now() else null end
    ),
    (
      v_entry.id, v_player, v_fee, v_payment_status,
      case when v_payment_status = 'waived' then v_actor else null end,
      case when v_payment_status = 'waived' then now() else null end
    );

  update public.tournament_partner_invitations
     set status = 'accepted',
         responded_at = now(),
         entry_id = v_entry.id
   where id = v_invitation.id
  returning * into v_invitation;

  perform public.notify_profile(
    v_inviter.profile_id,
    'partner_invitation_accepted',
    'Partner invitation accepted',
    'Your doubles team is registered. Both players still need to pay the entrance fee.',
    '/tournaments/' || v_tournament.id,
    v_tournament.id,
    v_actor
  );

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'tournament.partner_invitation_accepted',
    'tournament_partner_invitations',
    v_invitation.id,
    jsonb_build_object('entry_id', v_entry.id, 'event_id', v_event.id)
  );

  return jsonb_build_object(
    'invitation_id', v_invitation.id,
    'entry_id', v_entry.id,
    'event_id', v_event.id,
    'status', 'accepted',
    'payment_status', v_payment_status,
    'changed', true
  );
end;
$function$;

comment on function public.respond_tournament_partner_invitation(uuid, boolean) is
  'Invited player accepts or declines. Accepting creates the team, entry, and payment rows.';

revoke all on function public.respond_tournament_partner_invitation(uuid, boolean) from public, anon;
grant execute on function public.respond_tournament_partner_invitation(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_tournament_partner_invitation
-- ---------------------------------------------------------------------------
create function public.cancel_tournament_partner_invitation(p_invitation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_player uuid;
  v_invitation public.tournament_partner_invitations%rowtype;
  v_partner public.players%rowtype;
  v_tournament_id uuid;
begin
  v_player := public.require_friendly_player();

  select *
    into v_invitation
    from public.tournament_partner_invitations as i
   where i.id = p_invitation_id
     for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;

  if v_invitation.inviter_player_id <> v_player then
    raise exception 'only the inviting player can cancel this invitation' using errcode = '42501';
  end if;

  if v_invitation.status <> 'pending' then
    return jsonb_build_object(
      'invitation_id', v_invitation.id,
      'status', v_invitation.status,
      'changed', false
    );
  end if;

  update public.tournament_partner_invitations
     set status = 'cancelled',
         responded_at = now()
   where id = v_invitation.id
  returning * into v_invitation;

  select * into v_partner
    from public.players as p
   where p.id = v_invitation.partner_player_id;

  select e.tournament_id
    into v_tournament_id
    from public.tournament_events as e
   where e.id = v_invitation.event_id;

  perform public.notify_profile(
    v_partner.profile_id,
    'partner_invitation_cancelled',
    'Partner invitation cancelled',
    'The invitation is no longer active.',
    '/tournaments/' || v_tournament_id,
    v_tournament_id,
    auth.uid()
  );

  return jsonb_build_object(
    'invitation_id', v_invitation.id,
    'status', 'cancelled',
    'changed', true
  );
end;
$function$;

comment on function public.cancel_tournament_partner_invitation(uuid) is
  'The inviter cancels a pending invitation before the partner answers.';

revoke all on function public.cancel_tournament_partner_invitation(uuid) from public, anon;
grant execute on function public.cancel_tournament_partner_invitation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- withdraw_own_tournament_entry
-- ---------------------------------------------------------------------------
create function public.withdraw_own_tournament_entry(p_entry_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid;
  v_entry public.tournament_entries%rowtype;
  v_event public.tournament_events%rowtype;
  v_tournament public.tournaments%rowtype;
begin
  v_player := public.require_friendly_player();

  select *
    into v_entry
    from public.tournament_entries as en
   where en.id = p_entry_id
     for update;

  if not found then
    raise exception 'entry not found' using errcode = 'P0002';
  end if;

  if v_entry.player_id is distinct from v_player
     and not exists (
       select 1
         from public.team_members as tm
        where tm.team_id = v_entry.team_id
          and tm.player_id = v_player
     ) then
    raise exception 'you can only withdraw your own entry' using errcode = '42501';
  end if;

  select *
    into v_event
    from public.tournament_events as e
   where e.id = v_entry.event_id
     for update;

  if v_event.draw_generated_at is not null then
    raise exception 'the draw already exists; withdraw before it is generated'
      using errcode = '22023';
  end if;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = v_event.tournament_id
     for update;

  if v_tournament.status <> 'published' then
    raise exception 'registration is not open for this tournament' using errcode = '22023';
  end if;

  if v_entry.status = 'withdrawn' then
    return jsonb_build_object(
      'entry_id', v_entry.id,
      'status', 'withdrawn',
      'changed', false
    );
  end if;

  update public.tournament_entries
     set status = 'withdrawn'
   where id = v_entry.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.entry_self_withdrawn',
    'tournament_entries',
    v_entry.id,
    jsonb_build_object('status', v_entry.status),
    jsonb_build_object('status', 'withdrawn', 'player_id', v_player)
  );

  return jsonb_build_object(
    'entry_id', v_entry.id,
    'status', 'withdrawn',
    'changed', true
  );
end;
$function$;

comment on function public.withdraw_own_tournament_entry(uuid) is
  'A participant withdraws their own entry before the draw. Doubles withdraws the whole team.';

revoke all on function public.withdraw_own_tournament_entry(uuid) from public, anon;
grant execute on function public.withdraw_own_tournament_entry(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_entry_payment: staff marks one participant paid/unpaid/waived
-- ---------------------------------------------------------------------------
create function public.set_entry_payment(
  p_payment_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_payment public.tournament_entry_payments%rowtype;
  v_tournament public.tournaments%rowtype;
  v_profile_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  v_actor := public.require_tournament_staff();

  if p_status not in ('unpaid', 'paid', 'waived') then
    raise exception 'unknown payment status' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'the payment note is too long' using errcode = '22023';
  end if;

  select *
    into v_payment
    from public.tournament_entry_payments as p
   where p.id = p_payment_id
     for update;

  if not found then
    raise exception 'payment record not found' using errcode = 'P0002';
  end if;

  update public.tournament_entry_payments
     set status = p_status,
         marked_by = case when p_status = 'unpaid' then null else v_actor end,
         marked_at = case when p_status = 'unpaid' then null else now() end,
         note = v_note
   where id = v_payment.id
  returning * into v_payment;

  select t.*
    into v_tournament
    from public.tournament_events as e
    join public.tournaments as t on t.id = e.tournament_id
   where e.id = (select event_id from public.tournament_entries where id = v_payment.entry_id);
  if p_status = 'paid' and v_payment.player_id is not null then
    select p.profile_id into v_profile_id
      from public.players as p
     where p.id = v_payment.player_id;

    perform public.notify_profile(
      v_profile_id,
      'entry_payment_paid',
      'Entrance fee confirmed',
      'Your payment for ' || v_tournament.name || ' is confirmed. You are eligible for the draw.',
      '/tournaments/' || v_tournament.id,
      v_tournament.id,
      v_actor
    );
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.entry_payment',
    'tournament_entry_payments',
    v_payment.id,
    jsonb_build_object('status', v_payment.status),
    jsonb_build_object('status', p_status, 'note', v_note)
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'entry_id', v_payment.entry_id,
    'status', v_payment.status
  );
end;
$function$;

comment on function public.set_entry_payment(uuid, text, text) is
  'Tournament staff mark one participant paid, unpaid, or waived. Paid notifies the player.';

revoke all on function public.set_entry_payment(uuid, text, text) from public, anon;
grant execute on function public.set_entry_payment(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- tournament poster and fee
-- ---------------------------------------------------------------------------
create function public.set_tournament_poster(p_tournament_id uuid, p_poster_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_tournament public.tournaments%rowtype;
  v_path text := nullif(btrim(coalesce(p_poster_path, '')), '');
begin
  v_actor := public.require_tournament_staff();

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = p_tournament_id
     for update;

  if not found then
    raise exception 'tournament not found' using errcode = 'P0002';
  end if;

  if v_tournament.status = 'archived' then
    raise exception 'an archived tournament cannot change its poster' using errcode = '22023';
  end if;

  if v_path is not null and v_path !~
    '^posters/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$' then
    raise exception 'the poster path must be a posters/<tournament>/<file> image'
      using errcode = '22023';
  end if;

  update public.tournaments
     set poster_path = v_path
   where id = v_tournament.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.poster',
    'tournaments',
    v_tournament.id,
    jsonb_build_object('poster_path', v_tournament.poster_path),
    jsonb_build_object('poster_path', v_path)
  );

  return jsonb_build_object('tournament_id', v_tournament.id, 'poster_path', v_path);
end;
$function$;

comment on function public.set_tournament_poster(uuid, text) is
  'Tournament staff attach or clear a poster. The path shape is validated in the database.';

revoke all on function public.set_tournament_poster(uuid, text) from public, anon;
grant execute on function public.set_tournament_poster(uuid, text) to authenticated;

create function public.set_tournament_entrance_fee(p_tournament_id uuid, p_fee numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_tournament public.tournaments%rowtype;
  v_entry_count integer;
begin
  v_actor := public.require_tournament_staff();

  if p_fee is null or p_fee < 0 or p_fee > 1000000 then
    raise exception 'the entrance fee must be between 0 and 1,000,000' using errcode = '22023';
  end if;

  select *
    into v_tournament
    from public.tournaments as t
   where t.id = p_tournament_id
     for update;

  if not found then
    raise exception 'tournament not found' using errcode = 'P0002';
  end if;

  if v_tournament.status <> 'draft' then
    raise exception 'the entrance fee can only change while the tournament is a draft'
      using errcode = '22023';
  end if;

  select count(*)
    into v_entry_count
    from public.tournament_entries as en
    join public.tournament_events as e on e.id = en.event_id
   where e.tournament_id = v_tournament.id;

  if v_entry_count > 0 then
    raise exception 'entries already exist; the fee is fixed' using errcode = '22023';
  end if;

  update public.tournaments
     set entrance_fee = p_fee
   where id = v_tournament.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'tournament.entrance_fee',
    'tournaments',
    v_tournament.id,
    jsonb_build_object('entrance_fee', v_tournament.entrance_fee),
    jsonb_build_object('entrance_fee', p_fee)
  );

  return jsonb_build_object('tournament_id', v_tournament.id, 'entrance_fee', p_fee);
end;
$function$;

comment on function public.set_tournament_entrance_fee(uuid, numeric) is
  'Changes the fee only on a draft with no entries, so no participant sees a moving price.';

revoke all on function public.set_tournament_entrance_fee(uuid, numeric) from public, anon;
grant execute on function public.set_tournament_entrance_fee(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- create_tournament: add the fee. The old six-argument signature is replaced.
-- ---------------------------------------------------------------------------
drop function public.create_tournament(text, date, date, text, text, timestamptz);

create function public.create_tournament(
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_venue text default null,
  p_description text default null,
  p_registration_deadline timestamptz default null,
  p_entrance_fee numeric default 0
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
  if p_entrance_fee is null or p_entrance_fee < 0 or p_entrance_fee > 1000000 then
    raise exception 'the entrance fee must be between 0 and 1,000,000' using errcode = '22023';
  end if;

  insert into public.tournaments (
    name,
    description,
    venue,
    starts_on,
    ends_on,
    registration_deadline,
    entrance_fee,
    created_by
  )
  values (
    v_name,
    v_description,
    v_venue,
    p_starts_on,
    p_ends_on,
    p_registration_deadline,
    p_entrance_fee,
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
      'entrance_fee', v_tournament.entrance_fee,
      'status', v_tournament.status
    )
  );

  return to_jsonb(v_tournament);
end;
$function$;

comment on function public.create_tournament(text, date, date, text, text, timestamptz, numeric) is
  'Tournament-manager only creation with an optional per-player entrance fee. Starts in draft.';

revoke all on function public.create_tournament(text, date, date, text, text, timestamptz, numeric)
  from public, anon;
grant execute on function public.create_tournament(text, date, date, text, text, timestamptz, numeric)
  to authenticated;

-- ---------------------------------------------------------------------------
-- save_tournament_draw: only fully paid/waived entries may be placed
-- ---------------------------------------------------------------------------
create or replace function public.save_tournament_draw(
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
  v_eligible_count integer;
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

  select count(*)
    into v_eligible_count
    from public.tournament_entries as en
   where en.event_id = v_event.id
     and en.status = 'registered'
     and public.entry_payment_complete(en.id);

  if v_eligible_count < 2 then
    raise exception 'a draw needs at least two fully paid entries' using errcode = '22023';
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
      if not public.entry_payment_complete(v_home_entry) then
        raise exception 'draw match % refers to an entry with unpaid participants', v_key
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
      if not public.entry_payment_complete(v_away_entry) then
        raise exception 'draw match % refers to an entry with unpaid participants', v_key
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
    if v_seen_count <> v_eligible_count * (v_eligible_count - 1)
       or v_distinct_count <> v_eligible_count then
      raise exception 'a round-robin draw must contain every paid pair exactly once'
        using errcode = '22023';
    end if;

    if exists (
      select 1
        from unnest(v_seen_entries) as e
       group by e
      having count(*) <> v_eligible_count - 1
    ) then
      raise exception 'every paid entry must play the same number of round-robin matches'
        using errcode = '22023';
    end if;
  else
    if v_seen_count <> v_eligible_count or v_distinct_count <> v_eligible_count then
      raise exception 'an elimination draw must place every paid entry exactly once'
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
    jsonb_build_object(
      'match_count', jsonb_array_length(p_matches),
      'entry_count', v_eligible_count,
      'registered_count', v_active_count
    )
  );

  return jsonb_build_object(
    'event_id', v_event.id,
    'match_count', jsonb_array_length(p_matches),
    'entry_count', v_eligible_count,
    'registered_count', v_active_count,
    'replaced', v_existing_count > 0
  );
end;
$function$;

comment on function public.save_tournament_draw(uuid, jsonb, boolean) is
  'Persists a draw using only fully paid/waived entries, validates coverage and sources, and locks entries.';

-- ---------------------------------------------------------------------------
-- RLS is enabled here; policies are applied by 014_tournament_registration.sql
-- ---------------------------------------------------------------------------
alter table public.tournament_entry_payments enable row level security;
alter table public.tournament_partner_invitations enable row level security;

-- Public bucket so posters load without a signed URL; uploads are staff-only.
do $bucket$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema is absent; skipping the tournament-posters bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'tournament-posters',
    'tournament-posters',
    true,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end;
$bucket$;

commit;
