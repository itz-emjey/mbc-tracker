-- MBC Arena - Migration 010: friendly matches
--
-- Apply after 009_jersey_images.sql. Policies live in
-- backend/policies/010_friendly_matches.sql.
--
-- Scope (Phase 5, backend gate):
--   * singles challenges between two active players with linked accounts;
--   * winner-submits, loser-approves-or-disputes, 24-hour auto-approval;
--   * no ShuttlePower award. The win/loss formula is still unapproved
--     (PLAN.md §7 rule 1), so a confirmed match moves no balance and writes no
--     ledger row. Awarding will be a separate migration once the formula is
--     approved, keyed on the match id so it can never run twice.
--
-- Doubles friendlies wait on §7 rule 7 (one losing partner or both must
-- approve), and dispute resolution waits on §7 rule 8. A disputed match keeps
-- its submitted result and reason; no invented appeals path is built.
--
-- This migration is intentionally not idempotent. It fails loudly if applied
-- twice, like the earlier migrations.

begin;

-- ---------------------------------------------------------------------------
-- friendly_matches
-- ---------------------------------------------------------------------------
create table public.friendly_matches (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references public.players (id) on delete restrict,
  opponent_id uuid not null references public.players (id) on delete restrict,
  note text,
  status text not null default 'pending',
  winner_id uuid references public.players (id) on delete restrict,
  submitted_by uuid references public.profiles (id) on delete set null,
  submitted_at timestamptz,
  auto_approval_due_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null,
  responded_at timestamptz,
  confirmed_at timestamptz,
  dispute_reason text,
  disputed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendly_matches_pair_check check (challenger_id <> opponent_id),
  constraint friendly_matches_note_check
    check (note is null or char_length(note) between 1 and 500),
  constraint friendly_matches_status_check
    check (status in (
      'pending', 'accepted', 'declined', 'cancelled',
      'awaiting_approval', 'confirmed', 'auto_approved', 'disputed'
    )),
  constraint friendly_matches_winner_check
    check (winner_id is null or winner_id in (challenger_id, opponent_id)),
  constraint friendly_matches_result_state_check
    check (
      (winner_id is null) = (submitted_at is null)
      and (winner_id is null or (submitted_by is not null and auto_approval_due_at is not null))
      and (status not in ('awaiting_approval', 'confirmed', 'auto_approved', 'disputed')
        or winner_id is not null)
      and (status not in ('confirmed', 'auto_approved') or confirmed_at is not null)
    ),
  constraint friendly_matches_dispute_state_check
    check (
      (status = 'disputed') = (dispute_reason is not null and disputed_at is not null)
    )
);

comment on table public.friendly_matches is
  'Singles friendly match. Confirmed results do not award SP while the formula is unapproved.';
comment on column public.friendly_matches.status is
  'pending -> accepted -> awaiting_approval -> confirmed | auto_approved | disputed; pending -> declined; pending/accepted -> cancelled.';
comment on column public.friendly_matches.auto_approval_due_at is
  'Server time 24 hours after submission. The scheduled job confirms the result at or after this instant.';

create index friendly_matches_challenger_idx
  on public.friendly_matches (challenger_id, created_at desc);
create index friendly_matches_opponent_idx
  on public.friendly_matches (opponent_id, created_at desc);
create index friendly_matches_auto_approval_idx
  on public.friendly_matches (auto_approval_due_at)
  where status = 'awaiting_approval';

-- One open match per pair, whichever player sent the invitation. A declined,
-- cancelled, disputed, or confirmed match frees the pair to play again.
create unique index friendly_matches_pair_open_key
  on public.friendly_matches (
    (least(challenger_id, opponent_id)),
    (greatest(challenger_id, opponent_id))
  )
  where status in ('pending', 'accepted', 'awaiting_approval');

create trigger friendly_matches_set_updated_at
  before update on public.friendly_matches
  for each row execute function public.set_updated_at();

alter table public.friendly_matches enable row level security;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create function public.current_active_player_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id
    from public.players as p
   where p.profile_id = auth.uid()
     and p.status = 'active'
   limit 1;
$function$;

comment on function public.current_active_player_id() is
  'The signed-in profile''s active player record, or null when there is none.';

revoke all on function public.current_active_player_id() from public;

create function public.require_friendly_player()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_player uuid := public.current_active_player_id();
begin
  if v_player is null then
    raise exception 'an active player record is required' using errcode = '42501';
  end if;

  return v_player;
end;
$function$;

comment on function public.require_friendly_player() is
  'Server-side authority check for friendly match writes: an active linked player.';

revoke all on function public.require_friendly_player() from public;
grant execute on function public.require_friendly_player() to authenticated, service_role;

create function public.find_open_friendly(p_first uuid, p_second uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select m.id
    from public.friendly_matches as m
   where m.status in ('pending', 'accepted', 'awaiting_approval')
     and (
       (m.challenger_id = p_first and m.opponent_id = p_second)
       or (m.challenger_id = p_second and m.opponent_id = p_first)
     )
   limit 1;
$function$;

revoke all on function public.find_open_friendly(uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- create_friendly_challenge
-- ---------------------------------------------------------------------------
create function public.create_friendly_challenge(
  p_opponent_id uuid,
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

  if p_opponent_id = v_challenger.id then
    raise exception 'you cannot challenge yourself' using errcode = '22023';
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

  insert into public.friendly_matches (challenger_id, opponent_id, note, created_by)
  values (v_challenger.id, v_opponent.id, v_note, v_actor)
  returning * into v_match;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'friendly.challenge.created',
    'friendly_matches',
    v_match.id,
    jsonb_build_object(
      'challenger_id', v_match.challenger_id,
      'opponent_id', v_match.opponent_id,
      'status', v_match.status
    )
  );

  return jsonb_build_object('id', v_match.id, 'status', v_match.status);
end;
$function$;

comment on function public.create_friendly_challenge(uuid, text) is
  'Challenges one active, linked player. One open match per pair; audited.';

revoke all on function public.create_friendly_challenge(uuid, text) from public, anon;
grant execute on function public.create_friendly_challenge(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept / decline / cancel
-- ---------------------------------------------------------------------------
create function public.respond_friendly_challenge(
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
  'Accept or decline a pending challenge. Challenged player only.';

revoke all on function public.respond_friendly_challenge(uuid, boolean) from public, anon;
grant execute on function public.respond_friendly_challenge(uuid, boolean) to authenticated;

create function public.cancel_friendly_challenge(p_match_id uuid)
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

  if v_match.challenger_id <> v_player then
    raise exception 'only the challenger can cancel' using errcode = '42501';
  end if;

  if v_match.status in ('awaiting_approval', 'disputed') then
    raise exception 'a submitted result cannot be cancelled' using errcode = '22023';
  end if;

  if v_match.status not in ('pending', 'accepted') then
    raise exception 'this challenge is already %', v_match.status
      using errcode = '22023';
  end if;

  update public.friendly_matches
     set status = 'cancelled',
         responded_by = v_actor,
         responded_at = now()
   where id = v_match.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'friendly.challenge.cancelled',
    'friendly_matches',
    v_match.id,
    jsonb_build_object('status', v_match.status),
    jsonb_build_object('status', 'cancelled')
  );

  return jsonb_build_object('id', v_match.id, 'status', 'cancelled');
end;
$function$;

comment on function public.cancel_friendly_challenge(uuid) is
  'Challenger-only cancellation before a result is submitted.';

revoke all on function public.cancel_friendly_challenge(uuid) from public, anon;
grant execute on function public.cancel_friendly_challenge(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- submit_friendly_result
-- ---------------------------------------------------------------------------
create function public.submit_friendly_result(p_match_id uuid, p_winner_id uuid)
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
begin
  select * into v_match
    from public.friendly_matches as m
   where m.id = p_match_id
     for update;

  if not found then
    raise exception 'match not found' using errcode = 'P0002';
  end if;

  if v_player not in (v_match.challenger_id, v_match.opponent_id) then
    raise exception 'only the players in this match can submit a result'
      using errcode = '42501';
  end if;

  if v_match.status <> 'accepted' then
    raise exception 'only an accepted challenge can take a result'
      using errcode = '22023';
  end if;

  if p_winner_id is null or p_winner_id not in (v_match.challenger_id, v_match.opponent_id) then
    raise exception 'the winner must be one of the two players' using errcode = '22023';
  end if;

  if p_winner_id <> v_player then
    raise exception 'only the winner can submit the result' using errcode = '42501';
  end if;

  v_due := now() + interval '24 hours';

  update public.friendly_matches
     set status = 'awaiting_approval',
         winner_id = p_winner_id,
         submitted_by = v_actor,
         submitted_at = now(),
         auto_approval_due_at = v_due
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
      'winner_id', p_winner_id,
      'auto_approval_due_at', v_due
    )
  );

  return jsonb_build_object('id', v_match.id, 'status', 'awaiting_approval');
end;
$function$;

comment on function public.submit_friendly_result(uuid, uuid) is
  'Winner submits the winner. Starts the 24-hour server-side approval window. No SP moves.';

revoke all on function public.submit_friendly_result(uuid, uuid) from public, anon;
grant execute on function public.submit_friendly_result(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- approve / dispute
-- ---------------------------------------------------------------------------
create function public.approve_friendly_result(p_match_id uuid)
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

  -- Deliberately no SP transaction here: the formula is unapproved.
  return jsonb_build_object('id', v_match.id, 'status', 'confirmed');
end;
$function$;

comment on function public.approve_friendly_result(uuid) is
  'Losing player confirms the submitted result. Winner cannot approve. No SP moves.';

revoke all on function public.approve_friendly_result(uuid) from public, anon;
grant execute on function public.approve_friendly_result(uuid) to authenticated;

create function public.dispute_friendly_result(p_match_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid := public.require_friendly_player();
  v_match public.friendly_matches%rowtype;
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

  if v_player not in (v_match.challenger_id, v_match.opponent_id) then
    raise exception 'only the players in this match can dispute a result'
      using errcode = '42501';
  end if;

  if v_player = v_match.winner_id then
    raise exception 'the winner cannot dispute their own result' using errcode = '42501';
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
    jsonb_build_object('status', 'disputed', 'reason', v_reason)
  );

  return jsonb_build_object('id', v_match.id, 'status', 'disputed');
end;
$function$;

comment on function public.dispute_friendly_result(uuid, text) is
  'Losing player disputes with a reason. No resolution path is built while §7 rule 8 is open.';

revoke all on function public.dispute_friendly_result(uuid, text) from public, anon;
grant execute on function public.dispute_friendly_result(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- auto_approve_friendly_matches
--
-- Safe for the scheduled job: with no JWT (the cron session) it runs; any
-- signed-in caller must be a Super Admin. Replaying it is a no-op because only
-- rows still 'awaiting_approval' past their due time are touched.
-- ---------------------------------------------------------------------------
create function public.auto_approve_friendly_matches()
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

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;

comment on function public.auto_approve_friendly_matches() is
  'Confirms results 24 hours after submission. Idempotent, Super Admin or the scheduler only, no SP.';

revoke all on function public.auto_approve_friendly_matches() from public, anon;
grant execute on function public.auto_approve_friendly_matches() to authenticated, service_role;

-- Schedule the job only where pg_cron is installed (hosted Supabase). The
-- local harness has no cron schema and skips this block.
do $cron$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron')
     and to_regprocedure('cron.schedule(text,text,text)') is not null then
    perform cron.schedule(
      'friendly-matches-auto-approve',
      '*/15 * * * *',
      'select public.auto_approve_friendly_matches()'
    );
  end if;
end;
$cron$;

commit;
