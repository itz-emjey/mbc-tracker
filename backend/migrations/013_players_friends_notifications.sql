-- MBC Arena - Migration 013: player IDs, friendships, and in-app notifications
--
-- Apply after 012_seasons.sql. Policies live in backend/policies/013_players_social.sql.
--
-- Scope:
--   * a stable, human-readable player code used to find and add friends;
--   * friend requests with an explicit accept/decline step;
--   * an in-app notification inbox, and the publish fan-out that fills it.
--
-- Design notes:
--   * player_code is generated from the player UUID, so it is immutable and
--     cannot collide with a manually chosen value;
--   * friendships are readable only by the two players and every write crosses
--     an audited RPC;
--   * notifications are readable only by their recipient. Clients hold SELECT
--     only; read state and every notification insert are RPC/definer work.
--
-- This migration is intentionally not idempotent. It fails loudly if applied
-- twice, like the earlier migrations.

begin;

-- ---------------------------------------------------------------------------
-- player_code: a stable, human-readable public identifier
-- ---------------------------------------------------------------------------
alter table public.players
  add column player_code text
  generated always as (
    'MBC-' || upper(
      substr(replace(id::text, '-', ''), 1, 4)
      || right(replace(id::text, '-', ''), 4)
    )
  ) stored;

alter table public.players
  add constraint players_player_code_key unique (player_code);

comment on column public.players.player_code is
  'Immutable player ID shown in the directory and used to send friend requests, e.g. MBC-1A2B3C4D.';

-- ---------------------------------------------------------------------------
-- player_friendships: one row per unordered pair
-- ---------------------------------------------------------------------------
create table public.player_friendships (
  id uuid primary key default gen_random_uuid(),
  requester_player_id uuid not null references public.players (id) on delete cascade,
  addressee_player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_friendships_pair_check
    check (requester_player_id <> addressee_player_id),
  constraint player_friendships_status_check
    check (status in ('pending', 'accepted', 'declined', 'removed')),
  constraint player_friendships_responded_check
    check (
      (status = 'pending' and responded_at is null)
      or (status in ('accepted', 'declined', 'removed') and responded_at is not null)
    )
);

comment on table public.player_friendships is
  'Friend request between two player records. Accepted friends appear in partner choices.';

create unique index player_friendships_pair_key
  on public.player_friendships (
    least(requester_player_id, addressee_player_id),
    greatest(requester_player_id, addressee_player_id)
  );

create index player_friendships_requester_idx
  on public.player_friendships (requester_player_id, status);

create index player_friendships_addressee_idx
  on public.player_friendships (addressee_player_id, status);

create trigger player_friendships_set_updated_at
  before update on public.player_friendships
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- notifications: one inbox row per recipient
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link_path text,
  tournament_id uuid references public.tournaments (id) on delete set null,
  actor_profile_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_type_check
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
        'friend_removed'
      )
    ),
  constraint notifications_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160),
  constraint notifications_body_check
    check (body is null or char_length(body) <= 500),
  constraint notifications_link_check
    check (link_path is null or (link_path like '/%' and char_length(link_path) <= 400))
);

comment on table public.notifications is
  'In-app notification. Recipients read and mark their own rows; inserts happen through definer RPCs.';
comment on column public.notifications.read_at is
  'Null while unread. Marked through mark_notification_read or mark_all_notifications_read.';

create index notifications_profile_created_idx
  on public.notifications (profile_id, created_at desc);

create index notifications_profile_unread_idx
  on public.notifications (profile_id)
  where read_at is null;

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------
create function public.current_player_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id
    from public.players as p
   where p.profile_id = auth.uid()
   limit 1;
$function$;

comment on function public.current_player_id() is
  'The signed-in profile''s player record, linked or not, or null.';

revoke all on function public.current_player_id() from public;
grant execute on function public.current_player_id() to authenticated, service_role;

create function public.is_friend(p_first uuid, p_second uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
      from public.player_friendships as f
     where f.status = 'accepted'
       and (
         (f.requester_player_id = p_first and f.addressee_player_id = p_second)
         or (f.requester_player_id = p_second and f.addressee_player_id = p_first)
       )
  );
$function$;

comment on function public.is_friend(uuid, uuid) is
  'True when the two player records have an accepted friendship.';

revoke all on function public.is_friend(uuid, uuid) from public;
grant execute on function public.is_friend(uuid, uuid) to authenticated, service_role;

create function public.notify_profile(
  p_profile_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_link_path text default null,
  p_tournament_id uuid default null,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_profile_id is null then
    return;
  end if;

  insert into public.notifications (
    profile_id,
    type,
    title,
    body,
    link_path,
    tournament_id,
    actor_profile_id
  )
  values (
    p_profile_id,
    p_type,
    p_title,
    p_body,
    p_link_path,
    p_tournament_id,
    p_actor_id
  );
end;
$function$;

comment on function public.notify_profile(uuid, text, text, text, text, uuid, uuid) is
  'Internal notification insert. Execute is granted to no client role.';

revoke all on function public.notify_profile(uuid, text, text, text, text, uuid, uuid) from public;

create function public.notify_club_members(
  p_type text,
  p_title text,
  p_body text default null,
  p_link_path text default null,
  p_tournament_id uuid default null,
  p_actor_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  insert into public.notifications (
    profile_id,
    type,
    title,
    body,
    link_path,
    tournament_id,
    actor_profile_id
  )
  select
      p.id,
      p_type,
      p_title,
      p_body,
      p_link_path,
      p_tournament_id,
      p_actor_id
    from public.profiles as p
   where p.status = 'active'
     and (p_actor_id is null or p.id <> p_actor_id)
     and exists (
       select 1 from public.user_roles as ur where ur.profile_id = p.id
     );

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

comment on function public.notify_club_members(text, text, text, text, uuid, uuid) is
  'Internal fan-out to every active club member except the actor. Execute is not granted to clients.';

revoke all on function public.notify_club_members(text, text, text, text, uuid, uuid) from public;

-- ---------------------------------------------------------------------------
-- friend requests
-- ---------------------------------------------------------------------------
create function public.send_player_friend_request(p_player_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_player uuid;
  v_code text := upper(btrim(coalesce(p_player_code, '')));
  v_target public.players%rowtype;
  v_friendship public.player_friendships%rowtype;
begin
  v_actor := auth.uid();
  v_player := public.require_friendly_player();

  if v_code = '' then
    raise exception 'a player ID is required' using errcode = '22023';
  end if;

  select *
    into v_target
    from public.players as p
   where upper(p.player_code) = v_code
     for update;

  if not found then
    raise exception 'no player has that ID' using errcode = 'P0002';
  end if;

  if v_target.id = v_player then
    raise exception 'you cannot add yourself as a friend' using errcode = '22023';
  end if;

  if v_target.status <> 'active' then
    raise exception 'that player record is not active' using errcode = '22023';
  end if;

  if v_target.profile_id is null then
    raise exception 'that player has no club account yet' using errcode = '22023';
  end if;

  select *
    into v_friendship
    from public.player_friendships as f
   where (f.requester_player_id = v_player and f.addressee_player_id = v_target.id)
      or (f.requester_player_id = v_target.id and f.addressee_player_id = v_player)
     for update;

  if found then
    if v_friendship.status = 'accepted' then
      return jsonb_build_object(
        'friendship_id', v_friendship.id,
        'status', v_friendship.status,
        'changed', false,
        'already_friends', true
      );
    end if;

    if v_friendship.status = 'pending' then
      return jsonb_build_object(
        'friendship_id', v_friendship.id,
        'status', v_friendship.status,
        'changed', false,
        'already_friends', false
      );
    end if;

    update public.player_friendships
       set requester_player_id = v_player,
           addressee_player_id = v_target.id,
           status = 'pending',
           requested_at = now(),
           responded_at = null
     where id = v_friendship.id
    returning * into v_friendship;

    perform public.notify_profile(
      v_target.profile_id,
      'friend_request',
      'New friend request',
      'Add them as a friend so you can pick each other as doubles partners.',
      '/profile',
      null,
      v_actor
    );

    return jsonb_build_object(
      'friendship_id', v_friendship.id,
      'status', v_friendship.status,
      'changed', true,
      'already_friends', false
    );
  end if;

  insert into public.player_friendships (requester_player_id, addressee_player_id)
  values (v_player, v_target.id)
  returning * into v_friendship;

  perform public.notify_profile(
    v_target.profile_id,
    'friend_request',
    'New friend request',
    'Add them as a friend so you can pick each other as doubles partners.',
    '/profile',
    null,
    v_actor
  );

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'player.friend_requested',
    'player_friendships',
    v_friendship.id,
    jsonb_build_object('requester_player_id', v_player, 'addressee_player_id', v_target.id)
  );

  return jsonb_build_object(
    'friendship_id', v_friendship.id,
    'status', v_friendship.status,
    'changed', true,
    'already_friends', false
  );
end;
$function$;

comment on function public.send_player_friend_request(text) is
  'Sends one friend request by player ID. Repeated calls return the existing state.';

revoke all on function public.send_player_friend_request(text) from public, anon;
grant execute on function public.send_player_friend_request(text) to authenticated;

create function public.respond_player_friend_request(p_friendship_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_player uuid;
  v_friendship public.player_friendships%rowtype;
  v_other public.players%rowtype;
  v_status text;
begin
  v_actor := auth.uid();
  v_player := public.require_friendly_player();

  select *
    into v_friendship
    from public.player_friendships as f
   where f.id = p_friendship_id
     for update;

  if not found then
    raise exception 'friend request not found' using errcode = 'P0002';
  end if;

  if v_friendship.addressee_player_id <> v_player then
    raise exception 'only the recipient can answer this request' using errcode = '42501';
  end if;

  if v_friendship.status <> 'pending' then
    return jsonb_build_object(
      'friendship_id', v_friendship.id,
      'status', v_friendship.status,
      'changed', false
    );
  end if;

  v_status := case when p_accept then 'accepted' else 'declined' end;

  update public.player_friendships
     set status = v_status,
         responded_at = now()
   where id = v_friendship.id
  returning * into v_friendship;

  select * into v_other
    from public.players as p
   where p.id = v_friendship.requester_player_id;

  perform public.notify_profile(
    v_other.profile_id,
    case when p_accept then 'friend_request_accepted' else 'friend_removed' end,
    case when p_accept then 'Friend request accepted' else 'Friend request declined' end,
    case when p_accept
      then 'You can now choose each other as doubles partners.'
      else 'The other player declined the friend request.'
    end,
    '/profile',
    null,
    v_actor
  );

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'player.friend_request_responded',
    'player_friendships',
    v_friendship.id,
    jsonb_build_object('status', v_friendship.status)
  );

  return jsonb_build_object(
    'friendship_id', v_friendship.id,
    'status', v_friendship.status,
    'changed', true
  );
end;
$function$;

comment on function public.respond_player_friend_request(uuid, boolean) is
  'Recipient accepts or declines one pending request. Audited and idempotent.';

revoke all on function public.respond_player_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_player_friend_request(uuid, boolean) to authenticated;

create function public.remove_player_friend(p_player_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_player uuid;
  v_friendship public.player_friendships%rowtype;
  v_other public.players%rowtype;
begin
  v_actor := auth.uid();
  v_player := public.require_friendly_player();

  select *
    into v_friendship
    from public.player_friendships as f
   where f.status in ('pending', 'accepted')
     and (
       (f.requester_player_id = v_player and f.addressee_player_id = p_player_id)
       or (f.requester_player_id = p_player_id and f.addressee_player_id = v_player)
     )
     for update;

  if not found then
    return jsonb_build_object('removed', false);
  end if;

  update public.player_friendships
     set status = 'removed',
         responded_at = now()
   where id = v_friendship.id;

  select * into v_other
    from public.players as p
   where p.id = p_player_id;

  perform public.notify_profile(
    v_other.profile_id,
    'friend_removed',
    'Friend removed',
    'They were removed from your friends list.',
    '/profile',
    null,
    v_actor
  );

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'player.friend_removed',
    'player_friendships',
    v_friendship.id,
    jsonb_build_object('status', 'removed')
  );

  return jsonb_build_object('removed', true);
end;
$function$;

comment on function public.remove_player_friend(uuid) is
  'Either player can remove a pending or accepted friendship. History is kept.';

revoke all on function public.remove_player_friend(uuid) from public, anon;
grant execute on function public.remove_player_friend(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- notification read state
-- ---------------------------------------------------------------------------
create function public.mark_notification_read(p_notification_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_changed boolean := false;
begin
  if v_uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.notifications
     set read_at = now()
   where id = p_notification_id
     and profile_id = v_uid
     and read_at is null;

  v_changed := found;

  return jsonb_build_object('notification_id', p_notification_id, 'changed', v_changed);
end;
$function$;

comment on function public.mark_notification_read(uuid) is
  'Marks one of the caller''s notifications read. Another recipient''s row changes nothing.';

revoke all on function public.mark_notification_read(uuid) from public, anon;
grant execute on function public.mark_notification_read(uuid) to authenticated;

create function public.mark_all_notifications_read()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_count integer;
begin
  if v_uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.notifications
     set read_at = now()
   where profile_id = v_uid
     and read_at is null;

  get diagnostics v_count = row_count;
  return jsonb_build_object('marked', v_count);
end;
$function$;

comment on function public.mark_all_notifications_read() is
  'Marks every unread notification for the caller read. Returns the count.';

revoke all on function public.mark_all_notifications_read() from public, anon;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ---------------------------------------------------------------------------
-- set_tournament_status: notify the club when a tournament is published
--
-- The lifecycle rules are unchanged from migration 005. Publishing is the one
-- transition that creates a player-facing notification for every active member.
-- ---------------------------------------------------------------------------
create or replace function public.set_tournament_status(p_tournament_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_tournament public.tournaments%rowtype;
  v_notified integer := 0;
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
      'changed', false,
      'notified', 0
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

  if p_status = 'published' then
    v_notified := public.notify_club_members(
      'tournament_published',
      'New tournament: ' || v_tournament.name,
      'Registration is open. View the details and join an event.',
      '/tournaments/' || v_tournament.id,
      v_tournament.id,
      v_actor
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
    'tournament.status',
    'tournaments',
    v_tournament.id,
    jsonb_build_object('status', v_tournament.status),
    jsonb_build_object('status', p_status, 'notified', v_notified)
  );

  return jsonb_build_object(
    'tournament_id', v_tournament.id,
    'status', p_status,
    'changed', true,
    'notified', v_notified
  );
end;
$function$;

comment on function public.set_tournament_status(uuid, text) is
  'Forward-only tournament lifecycle; publishing requires an event and notifies active club members.';

-- ---------------------------------------------------------------------------
-- RLS is enabled here; policies are applied by 013_players_social.sql
-- ---------------------------------------------------------------------------
alter table public.player_friendships enable row level security;
alter table public.notifications enable row level security;

commit;
