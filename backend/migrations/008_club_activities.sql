-- MBC Arena - Migration 008: jerseys, polls, and announcements (Phase 7)
--
-- Scope (AGENT.md §4.6-4.7, PLAN.md Phase 7):
--   * jersey projects with designs, size options, one active order per player,
--     and a soft-cancel path;
--   * polls with single/multiple choice, optional anonymity and results
--     visibility, a server-checked window, and one submission per player;
--   * announcements with draft -> published -> archived.
--
-- No image upload: the project has no Storage bucket configured, so designs and
-- announcements are text. Adding images later is a new approved decision.
--
-- Every table is SELECT-only to clients; staff writes cross audited RPCs.
--
-- Apply after 007_training.sql, before backend/policies/008_club_activities.sql.
-- This migration is intentionally not idempotent.

begin;

-- ---------------------------------------------------------------------------
-- Internal guard: club staff = trainer or super_admin (jerseys, polls, news).
-- ---------------------------------------------------------------------------
create function public.require_club_staff()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
begin
  if
    v_uid is null
    or not (
      public.has_role(v_uid, 'super_admin')
      or public.has_role(v_uid, 'trainer')
    )
  then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return v_uid;
end;
$function$;

comment on function public.require_club_staff() is
  'Internal guard for jersey, poll, and announcement writes: active trainer or super_admin.';

revoke all on function public.require_club_staff() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- jersey_projects
-- ---------------------------------------------------------------------------
create table public.jersey_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  price numeric(10, 2),
  order_deadline timestamptz,
  status text not null default 'draft',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jersey_projects_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint jersey_projects_description_check
    check (description is null or char_length(description) <= 2000),
  constraint jersey_projects_price_check
    check (price is null or (price >= 0 and price = round(price, 2))),
  constraint jersey_projects_status_check
    check (status in ('draft', 'open', 'closed', 'completed', 'cancelled'))
);

comment on table public.jersey_projects is
  'Jersey project. Drafts are staff-only; open/closed/completed projects are visible to members.';

create index jersey_projects_status_idx on public.jersey_projects (status, created_at desc);

create trigger jersey_projects_set_updated_at
  before update on public.jersey_projects
  for each row execute function public.set_updated_at();

create table public.jersey_designs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.jersey_projects (id) on delete restrict,
  name text not null,
  description text,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  constraint jersey_designs_name_check
    check (name = btrim(name) and char_length(name) between 1 and 120),
  constraint jersey_designs_description_check
    check (description is null or char_length(description) <= 2000),
  constraint jersey_designs_position_check check (position >= 1),
  constraint jersey_designs_project_name_unique unique (project_id, name),
  constraint jersey_designs_id_project_unique unique (id, project_id)
);

create index jersey_designs_project_idx on public.jersey_designs (project_id, position);

create table public.jersey_sizes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.jersey_projects (id) on delete restrict,
  label text not null,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  constraint jersey_sizes_label_check
    check (label = btrim(label) and char_length(label) between 1 and 20),
  constraint jersey_sizes_position_check check (position >= 1),
  constraint jersey_sizes_project_label_unique unique (project_id, label),
  constraint jersey_sizes_id_project_unique unique (id, project_id)
);

create index jersey_sizes_project_idx on public.jersey_sizes (project_id, position);

create table public.jersey_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.jersey_projects (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  design_id uuid not null,
  size_id uuid not null,
  quantity integer not null default 1,
  status text not null default 'submitted',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jersey_orders_quantity_check check (quantity between 1 and 20),
  constraint jersey_orders_status_check check (status in ('submitted', 'cancelled')),
  -- The composite keys make a design or size from another project impossible.
  constraint jersey_orders_design_project_fkey
    foreign key (design_id, project_id)
    references public.jersey_designs (id, project_id)
    on delete restrict,
  constraint jersey_orders_size_project_fkey
    foreign key (size_id, project_id)
    references public.jersey_sizes (id, project_id)
    on delete restrict
);

comment on table public.jersey_orders is
  'One active order per player and project; a cancelled order stays in history.';

create unique index jersey_orders_active_unique
  on public.jersey_orders (project_id, player_id)
  where status = 'submitted';

create index jersey_orders_project_idx on public.jersey_orders (project_id, status);

create trigger jersey_orders_set_updated_at
  before update on public.jersey_orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- polls
-- ---------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  description text,
  mode text not null default 'single',
  is_anonymous boolean not null default false,
  show_results boolean not null default false,
  status text not null default 'draft',
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint polls_question_check
    check (question = btrim(question) and char_length(question) between 1 and 200),
  constraint polls_description_check
    check (description is null or char_length(description) <= 2000),
  constraint polls_mode_check check (mode in ('single', 'multiple')),
  constraint polls_status_check check (status in ('draft', 'open', 'closed')),
  constraint polls_window_check
    check (closes_at is null or opens_at is null or closes_at > opens_at)
);

comment on table public.polls is
  'Club poll. One submission per player; single mode accepts exactly one option.';

create index polls_status_idx on public.polls (status, created_at desc);

create trigger polls_set_updated_at
  before update on public.polls
  for each row execute function public.set_updated_at();

create table public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls (id) on delete restrict,
  label text not null,
  position integer not null default 1,
  created_at timestamptz not null default now(),
  constraint poll_options_label_check
    check (label = btrim(label) and char_length(label) between 1 and 120),
  constraint poll_options_position_check check (position >= 1),
  constraint poll_options_poll_label_unique unique (poll_id, label),
  constraint poll_options_id_poll_unique unique (id, poll_id)
);

create index poll_options_poll_idx on public.poll_options (poll_id, position);

create table public.poll_votes (
  poll_id uuid not null references public.polls (id) on delete restrict,
  option_id uuid not null,
  player_id uuid not null references public.players (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (option_id, player_id),
  constraint poll_votes_option_poll_fkey
    foreign key (option_id, poll_id)
    references public.poll_options (id, poll_id)
    on delete restrict
);

comment on table public.poll_votes is
  'Option-level votes. The RPC replaces a player''s submission, so one response per poll is kept.';

create index poll_votes_poll_player_idx on public.poll_votes (poll_id, player_id);

-- ---------------------------------------------------------------------------
-- announcements
-- ---------------------------------------------------------------------------
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status text not null default 'draft',
  published_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint announcements_title_check
    check (title = btrim(title) and char_length(title) between 1 and 160),
  constraint announcements_body_check
    check (char_length(body) between 1 and 10000),
  constraint announcements_status_check
    check (status in ('draft', 'published', 'archived'))
);

comment on table public.announcements is
  'Club news. Only published announcements are visible to members.';

create index announcements_status_idx on public.announcements (status, published_at desc);

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Jersey RPCs
-- ---------------------------------------------------------------------------
create function public.create_jersey_project(
  p_name text,
  p_description text default null,
  p_price numeric default null,
  p_order_deadline timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_project public.jersey_projects%rowtype;
begin
  v_actor := public.require_club_staff();

  insert into public.jersey_projects (name, description, price, order_deadline, created_by)
  values (p_name, p_description, p_price, p_order_deadline, v_actor)
  returning * into v_project;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'jersey.project.create',
    'jersey_projects',
    v_project.id,
    jsonb_build_object('name', v_project.name, 'status', v_project.status)
  );

  return jsonb_build_object('id', v_project.id, 'status', v_project.status);
end;
$function$;

revoke all on function public.create_jersey_project(text, text, numeric, timestamptz) from public;
grant execute on function public.create_jersey_project(text, text, numeric, timestamptz) to authenticated, service_role;

create function public.set_jersey_project_status(p_project_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_project public.jersey_projects%rowtype;
begin
  v_actor := public.require_club_staff();

  select * into v_project
    from public.jersey_projects
   where id = p_project_id
     for update;

  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  if v_project.status = p_status then
    return jsonb_build_object('id', v_project.id, 'status', p_status, 'changed', false);
  end if;

  if not (
    (v_project.status = 'draft' and p_status in ('open', 'closed', 'cancelled'))
    or (v_project.status = 'open' and p_status in ('closed', 'cancelled'))
    or (v_project.status = 'closed' and p_status in ('completed', 'cancelled'))
  ) then
    raise exception 'status cannot move from % to %', v_project.status, p_status
      using errcode = '22023';
  end if;

  if p_status = 'open' and not exists (
    select 1 from public.jersey_designs where project_id = v_project.id
  ) then
    raise exception 'a project needs at least one design before it opens'
      using errcode = '22023';
  end if;

  if p_status = 'open' and not exists (
    select 1 from public.jersey_sizes where project_id = v_project.id
  ) then
    raise exception 'a project needs at least one size before it opens'
      using errcode = '22023';
  end if;

  update public.jersey_projects set status = p_status where id = v_project.id;

  insert into public.audit_logs (
    actor_id, action, target_table, target_id, before_data, after_data
  )
  values (
    v_actor,
    'jersey.project.status',
    'jersey_projects',
    v_project.id,
    jsonb_build_object('status', v_project.status),
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('id', v_project.id, 'status', p_status, 'changed', true);
end;
$function$;

revoke all on function public.set_jersey_project_status(uuid, text) from public;
grant execute on function public.set_jersey_project_status(uuid, text) to authenticated, service_role;

create function public.add_jersey_design(
  p_project_id uuid,
  p_name text,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_project public.jersey_projects%rowtype;
  v_design public.jersey_designs%rowtype;
begin
  v_actor := public.require_club_staff();

  select * into v_project from public.jersey_projects where id = p_project_id for update;

  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  if v_project.status not in ('draft', 'open') then
    raise exception 'designs cannot be added to a % project', v_project.status
      using errcode = '22023';
  end if;

  insert into public.jersey_designs (project_id, name, description, position)
  values (
    v_project.id,
    p_name,
    p_description,
    coalesce((select max(position) + 1 from public.jersey_designs where project_id = v_project.id), 1)
  )
  returning * into v_design;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'jersey.design.create',
    'jersey_designs',
    v_design.id,
    jsonb_build_object('project_id', v_project.id, 'name', v_design.name)
  );

  return jsonb_build_object('id', v_design.id);
end;
$function$;

revoke all on function public.add_jersey_design(uuid, text, text) from public;
grant execute on function public.add_jersey_design(uuid, text, text) to authenticated, service_role;

create function public.add_jersey_size(p_project_id uuid, p_label text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_project public.jersey_projects%rowtype;
  v_size public.jersey_sizes%rowtype;
begin
  v_actor := public.require_club_staff();

  select * into v_project from public.jersey_projects where id = p_project_id for update;

  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  if v_project.status not in ('draft', 'open') then
    raise exception 'sizes cannot be added to a % project', v_project.status
      using errcode = '22023';
  end if;

  insert into public.jersey_sizes (project_id, label, position)
  values (
    v_project.id,
    p_label,
    coalesce((select max(position) + 1 from public.jersey_sizes where project_id = v_project.id), 1)
  )
  returning * into v_size;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'jersey.size.create',
    'jersey_sizes',
    v_size.id,
    jsonb_build_object('project_id', v_project.id, 'label', v_size.label)
  );

  return jsonb_build_object('id', v_size.id);
end;
$function$;

revoke all on function public.add_jersey_size(uuid, text) from public;
grant execute on function public.add_jersey_size(uuid, text) to authenticated, service_role;

create function public.submit_jersey_order(
  p_project_id uuid,
  p_design_id uuid,
  p_size_id uuid,
  p_quantity integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player_id uuid;
  v_project public.jersey_projects%rowtype;
  v_order public.jersey_orders%rowtype;
begin
  if v_actor is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select p.id into v_player_id
    from public.players as p
   where p.profile_id = v_actor
     and p.status = 'active';

  if not found then
    raise exception 'an active player record is required to order'
      using errcode = '42501';
  end if;

  select * into v_project
    from public.jersey_projects
   where id = p_project_id
     for update;

  if not found then
    raise exception 'project not found' using errcode = 'P0002';
  end if;

  if v_project.status <> 'open' then
    raise exception 'orders are closed for this project' using errcode = '22023';
  end if;

  if v_project.order_deadline is not null and now() > v_project.order_deadline then
    raise exception 'the order deadline has passed' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.jersey_designs
     where id = p_design_id and project_id = v_project.id
  ) then
    raise exception 'unknown design for this project' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.jersey_sizes
     where id = p_size_id and project_id = v_project.id
  ) then
    raise exception 'unknown size for this project' using errcode = '22023';
  end if;

  select * into v_order
    from public.jersey_orders
   where project_id = v_project.id
     and player_id = v_player_id
     and status = 'submitted'
     for update;

  if found then
    update public.jersey_orders
       set design_id = p_design_id,
           size_id = p_size_id,
           quantity = p_quantity
     where id = v_order.id
    returning * into v_order;
  else
    insert into public.jersey_orders (
      project_id, player_id, design_id, size_id, quantity, created_by
    )
    values (v_project.id, v_player_id, p_design_id, p_size_id, p_quantity, v_actor)
    returning * into v_order;
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'jersey.order.submit',
    'jersey_orders',
    v_order.id,
    jsonb_build_object(
      'project_id', v_order.project_id,
      'player_id', v_order.player_id,
      'design_id', v_order.design_id,
      'size_id', v_order.size_id,
      'quantity', v_order.quantity
    )
  );

  return jsonb_build_object(
    'id', v_order.id,
    'design_id', v_order.design_id,
    'size_id', v_order.size_id,
    'quantity', v_order.quantity,
    'status', v_order.status
  );
end;
$function$;

revoke all on function public.submit_jersey_order(uuid, uuid, uuid, integer) from public;
grant execute on function public.submit_jersey_order(uuid, uuid, uuid, integer) to authenticated, service_role;

create function public.cancel_jersey_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_order public.jersey_orders%rowtype;
  v_staff boolean;
begin
  if v_actor is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_order from public.jersey_orders where id = p_order_id for update;

  if not found then
    raise exception 'order not found' using errcode = 'P0002';
  end if;

  v_staff := public.has_role(v_actor, 'super_admin') or public.has_role(v_actor, 'trainer');

  if not v_staff and not exists (
    select 1 from public.players
     where id = v_order.player_id and profile_id = v_actor
  ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_order.status = 'cancelled' then
    return jsonb_build_object('id', v_order.id, 'status', 'cancelled', 'changed', false);
  end if;

  update public.jersey_orders set status = 'cancelled' where id = v_order.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'jersey.order.cancel',
    'jersey_orders',
    v_order.id,
    jsonb_build_object('status', 'submitted'),
    jsonb_build_object('status', 'cancelled')
  );

  return jsonb_build_object('id', v_order.id, 'status', 'cancelled', 'changed', true);
end;
$function$;

revoke all on function public.cancel_jersey_order(uuid) from public;
grant execute on function public.cancel_jersey_order(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Poll RPCs
-- ---------------------------------------------------------------------------
create function public.create_poll(
  p_question text,
  p_options jsonb,
  p_description text default null,
  p_mode text default 'single',
  p_is_anonymous boolean default false,
  p_show_results boolean default false,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_poll public.polls%rowtype;
  v_option_count integer;
begin
  v_actor := public.require_club_staff();

  if jsonb_typeof(p_options) <> 'array' or jsonb_array_length(p_options) < 2 then
    raise exception 'a poll needs at least two options' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_options) as entry(value)
     where jsonb_typeof(entry.value) <> 'string' or btrim(entry.value #>> '{}') = ''
  ) then
    raise exception 'every poll option needs a label' using errcode = '22023';
  end if;

  select count(distinct btrim(entry.value #>> '{}'))
    into v_option_count
    from jsonb_array_elements(p_options) as entry(value);

  if v_option_count <> jsonb_array_length(p_options) then
    raise exception 'poll options must be unique' using errcode = '22023';
  end if;

  insert into public.polls (
    question, description, mode, is_anonymous, show_results, opens_at, closes_at, created_by
  )
  values (
    p_question, p_description, p_mode, p_is_anonymous, p_show_results, p_opens_at, p_closes_at, v_actor
  )
  returning * into v_poll;

  insert into public.poll_options (poll_id, label, position)
  select v_poll.id, btrim(entry.value #>> '{}'), entry.ord::integer
    from jsonb_array_elements(p_options) with ordinality as entry(value, ord);

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'poll.create',
    'polls',
    v_poll.id,
    jsonb_build_object('question', v_poll.question, 'mode', v_poll.mode)
  );

  return jsonb_build_object('id', v_poll.id, 'status', v_poll.status);
end;
$function$;

revoke all on function public.create_poll(text, jsonb, text, text, boolean, boolean, timestamptz, timestamptz) from public;
grant execute on function public.create_poll(text, jsonb, text, text, boolean, boolean, timestamptz, timestamptz) to authenticated, service_role;

create function public.set_poll_status(p_poll_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_poll public.polls%rowtype;
begin
  v_actor := public.require_club_staff();

  select * into v_poll from public.polls where id = p_poll_id for update;

  if not found then
    raise exception 'poll not found' using errcode = 'P0002';
  end if;

  if v_poll.status = p_status then
    return jsonb_build_object('id', v_poll.id, 'status', p_status, 'changed', false);
  end if;

  if not (
    (v_poll.status = 'draft' and p_status = 'open')
    or (v_poll.status = 'open' and p_status = 'closed')
  ) then
    raise exception 'status cannot move from % to %', v_poll.status, p_status
      using errcode = '22023';
  end if;

  update public.polls set status = p_status where id = v_poll.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'poll.status',
    'polls',
    v_poll.id,
    jsonb_build_object('status', v_poll.status),
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('id', v_poll.id, 'status', p_status, 'changed', true);
end;
$function$;

revoke all on function public.set_poll_status(uuid, text) from public;
grant execute on function public.set_poll_status(uuid, text) to authenticated, service_role;

create function public.cast_poll_vote(p_poll_id uuid, p_option_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player_id uuid;
  v_poll public.polls%rowtype;
  v_count integer;
begin
  if v_actor is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select p.id into v_player_id
    from public.players as p
   where p.profile_id = v_actor
     and p.status = 'active';

  if not found then
    raise exception 'an active player record is required to vote'
      using errcode = '42501';
  end if;

  select * into v_poll from public.polls where id = p_poll_id for update;

  if not found then
    raise exception 'poll not found' using errcode = 'P0002';
  end if;

  if v_poll.status <> 'open' then
    raise exception 'this poll is not open' using errcode = '22023';
  end if;

  if v_poll.opens_at is not null and now() < v_poll.opens_at then
    raise exception 'this poll has not opened yet' using errcode = '22023';
  end if;

  if v_poll.closes_at is not null and now() >= v_poll.closes_at then
    raise exception 'this poll has closed' using errcode = '22023';
  end if;

  v_count := coalesce(array_length(p_option_ids, 1), 0);

  if v_count = 0 then
    raise exception 'choose at least one option' using errcode = '22023';
  end if;

  if v_poll.mode = 'single' and v_count <> 1 then
    raise exception 'this poll accepts exactly one option' using errcode = '22023';
  end if;

  if (
    select count(distinct selected.option_id)
      from unnest(p_option_ids) as selected(option_id)
  ) <> v_count then
    raise exception 'a poll option cannot be selected twice' using errcode = '22023';
  end if;

  if (
    select count(*) from public.poll_options
     where poll_id = v_poll.id and id = any (p_option_ids)
  ) <> v_count then
    raise exception 'unknown option for this poll' using errcode = '22023';
  end if;

  delete from public.poll_votes
   where poll_id = v_poll.id and player_id = v_player_id;

  insert into public.poll_votes (poll_id, option_id, player_id)
  select v_poll.id, selected.option_id, v_player_id
    from unnest(p_option_ids) as selected(option_id);

  return jsonb_build_object('poll_id', v_poll.id, 'option_ids', p_option_ids);
end;
$function$;

revoke all on function public.cast_poll_vote(uuid, uuid[]) from public;
grant execute on function public.cast_poll_vote(uuid, uuid[]) to authenticated, service_role;

create function public.poll_results(p_poll_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_poll public.polls%rowtype;
  v_staff boolean;
  v_visible boolean;
  v_options jsonb;
  v_my_votes jsonb;
begin
  if v_actor is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_staff := public.has_role(v_actor, 'super_admin') or public.has_role(v_actor, 'trainer');

  select * into v_poll from public.polls where id = p_poll_id;

  if not found then
    raise exception 'poll not found' using errcode = 'P0002';
  end if;

  if v_poll.status = 'draft' and not v_staff then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_visible := v_staff or v_poll.show_results or v_poll.status = 'closed';

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'label', o.label,
        'position', o.position,
        'count', case
          when v_visible then (
            select count(*)::integer from public.poll_votes as v where v.option_id = o.id
          )
          else null
        end
      )
      order by o.position
    ),
    '[]'::jsonb
  )
  into v_options
  from public.poll_options as o
  where o.poll_id = v_poll.id;

  select coalesce(jsonb_agg(v.option_id order by v.option_id), '[]'::jsonb)
    into v_my_votes
    from public.poll_votes as v
    join public.players as p on p.id = v.player_id
   where v.poll_id = v_poll.id
     and p.profile_id = v_actor;

  return jsonb_build_object(
    'poll_id', v_poll.id,
    'status', v_poll.status,
    'mode', v_poll.mode,
    'is_anonymous', v_poll.is_anonymous,
    'results_visible', v_visible,
    'options', v_options,
    'my_option_ids', v_my_votes
  );
end;
$function$;

revoke all on function public.poll_results(uuid) from public;
grant execute on function public.poll_results(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Announcement RPCs
-- ---------------------------------------------------------------------------
create function public.create_announcement(p_title text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_announcement public.announcements%rowtype;
begin
  v_actor := public.require_club_staff();

  insert into public.announcements (title, body, created_by)
  values (p_title, p_body, v_actor)
  returning * into v_announcement;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'announcement.create',
    'announcements',
    v_announcement.id,
    jsonb_build_object('title', v_announcement.title, 'status', v_announcement.status)
  );

  return jsonb_build_object('id', v_announcement.id, 'status', v_announcement.status);
end;
$function$;

revoke all on function public.create_announcement(text, text) from public;
grant execute on function public.create_announcement(text, text) to authenticated, service_role;

create function public.set_announcement_status(p_announcement_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_announcement public.announcements%rowtype;
begin
  v_actor := public.require_club_staff();

  select * into v_announcement
    from public.announcements
   where id = p_announcement_id
     for update;

  if not found then
    raise exception 'announcement not found' using errcode = 'P0002';
  end if;

  if v_announcement.status = p_status then
    return jsonb_build_object('id', v_announcement.id, 'status', p_status, 'changed', false);
  end if;

  if not (
    (v_announcement.status = 'draft' and p_status in ('published', 'archived'))
    or (v_announcement.status = 'published' and p_status = 'archived')
  ) then
    raise exception 'status cannot move from % to %', v_announcement.status, p_status
      using errcode = '22023';
  end if;

  update public.announcements
     set status = p_status,
         published_at = case
           when p_status = 'published' then coalesce(published_at, now())
           else published_at
         end
   where id = v_announcement.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'announcement.status',
    'announcements',
    v_announcement.id,
    jsonb_build_object('status', v_announcement.status),
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('id', v_announcement.id, 'status', p_status, 'changed', true);
end;
$function$;

revoke all on function public.set_announcement_status(uuid, text) from public;
grant execute on function public.set_announcement_status(uuid, text) to authenticated, service_role;

alter table public.jersey_projects enable row level security;
alter table public.jersey_designs enable row level security;
alter table public.jersey_sizes enable row level security;
alter table public.jersey_orders enable row level security;
alter table public.polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;
alter table public.announcements enable row level security;

commit;
