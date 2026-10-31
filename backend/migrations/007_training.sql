-- MBC Arena - Migration 007: training sessions, attendance, fees, and payments (Phase 6)
--
-- Scope (PLAN.md §6 Phase 6):
--   * training sessions with a forward-only lifecycle;
--   * attendance, one row per session and player;
--   * monthly-ish fee periods and manually recorded payments;
--   * payments are never edited or deleted: a correction voids the row with a
--     reason and records a new one, so history survives.
--
-- Every table is SELECT-only to clients. Session creation, attendance, fee
-- periods, payments, and voids cross audited RPCs, because money and attendance
-- records are club records, not UI state.
--
-- Apply after 006_shuttlepower_rules.sql, before backend/policies/007_training.sql.
-- This migration is intentionally not idempotent.

begin;

-- ---------------------------------------------------------------------------
-- training_sessions
-- ---------------------------------------------------------------------------
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  venue text,
  notes text,
  status text not null default 'scheduled',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_sessions_title_check
    check (title = btrim(title) and char_length(title) between 1 and 120),
  constraint training_sessions_times_check
    check (ends_at > starts_at),
  constraint training_sessions_venue_check
    check (
      venue is null
      or (venue = btrim(venue) and char_length(venue) between 1 and 120)
    ),
  constraint training_sessions_notes_check
    check (notes is null or char_length(notes) <= 2000),
  constraint training_sessions_status_check
    check (status in ('scheduled', 'completed', 'cancelled'))
);

comment on table public.training_sessions is
  'Club training sessions. Status moves scheduled -> completed or cancelled through set_training_session_status.';

create index training_sessions_starts_at_idx
  on public.training_sessions (starts_at desc);

create trigger training_sessions_set_updated_at
  before update on public.training_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- training_attendance
-- ---------------------------------------------------------------------------
create table public.training_attendance (
  session_id uuid not null references public.training_sessions (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  status text not null default 'present',
  recorded_by uuid references public.profiles (id) on delete set null,
  recorded_at timestamptz not null default now(),
  primary key (session_id, player_id),
  constraint training_attendance_status_check
    check (status in ('present', 'absent', 'late', 'excused'))
);

comment on table public.training_attendance is
  'One attendance row per session and player. Re-marking a player updates that row through mark_training_attendance.';

create index training_attendance_player_idx
  on public.training_attendance (player_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- training_fee_periods
-- ---------------------------------------------------------------------------
create table public.training_fee_periods (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  starts_on date not null,
  ends_on date not null,
  amount numeric(10, 2) not null,
  due_on date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint training_fee_periods_label_unique unique (label),
  constraint training_fee_periods_label_check
    check (label = btrim(label) and char_length(label) between 1 and 40),
  constraint training_fee_periods_dates_check
    check (ends_on >= starts_on),
  constraint training_fee_periods_due_check
    check (due_on is null or due_on >= starts_on),
  constraint training_fee_periods_amount_check
    check (amount > 0 and amount = round(amount, 2))
);

comment on table public.training_fee_periods is
  'A club-wide fee period (for example a month) with the amount each player owes.';

create trigger training_fee_periods_set_updated_at
  before update on public.training_fee_periods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- training_payments (soft-void, never delete)
-- ---------------------------------------------------------------------------
create table public.training_payments (
  id uuid primary key default gen_random_uuid(),
  fee_period_id uuid not null references public.training_fee_periods (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  amount numeric(12, 2) not null,
  paid_on date not null default current_date,
  method text not null default 'cash',
  status text not null default 'recorded',
  recorded_by uuid references public.profiles (id) on delete set null,
  voided_by uuid references public.profiles (id) on delete set null,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  constraint training_payments_amount_check
    check (amount > 0 and amount = round(amount, 2)),
  constraint training_payments_method_check
    check (method in ('cash', 'bank_transfer', 'gcash', 'other')),
  constraint training_payments_status_check
    check (status in ('recorded', 'voided')),
  constraint training_payments_void_check
    check (
      (
        status = 'recorded'
        and voided_by is null
        and voided_at is null
        and void_reason is null
      )
      or
      (
        status = 'voided'
        and voided_by is not null
        and voided_at is not null
        and char_length(btrim(coalesce(void_reason, ''))) between 3 and 500
      )
    )
);

comment on table public.training_payments is
  'Manual payment rows. Never edited or deleted: a mistake is voided with a reason and recorded again.';

create index training_payments_period_player_idx
  on public.training_payments (fee_period_id, player_id, status);

create index training_payments_player_idx
  on public.training_payments (player_id, paid_on desc);

create function public.prevent_training_payment_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'training_payments rows are never deleted';
end;
$function$;

revoke all on function public.prevent_training_payment_mutation() from public;

create trigger training_payments_no_delete
  before delete on public.training_payments
  for each row execute function public.prevent_training_payment_mutation();

create trigger training_payments_no_truncate
  before truncate on public.training_payments
  for each statement execute function public.prevent_training_payment_mutation();

-- ---------------------------------------------------------------------------
-- Internal guard: training staff = trainer or super_admin.
-- ---------------------------------------------------------------------------
create function public.require_training_staff()
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

comment on function public.require_training_staff() is
  'Internal guard for training and payment writes: the caller must be an active trainer or super_admin.';

revoke all on function public.require_training_staff() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_training_session
-- ---------------------------------------------------------------------------
create function public.create_training_session(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_venue text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_session public.training_sessions%rowtype;
begin
  v_actor := public.require_training_staff();

  insert into public.training_sessions (title, starts_at, ends_at, venue, notes, created_by)
  values (p_title, p_starts_at, p_ends_at, p_venue, p_notes, v_actor)
  returning * into v_session;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'training.session.create',
    'training_sessions',
    v_session.id,
    jsonb_build_object(
      'title', v_session.title,
      'starts_at', v_session.starts_at,
      'ends_at', v_session.ends_at,
      'status', v_session.status
    )
  );

  return jsonb_build_object(
    'id', v_session.id,
    'title', v_session.title,
    'starts_at', v_session.starts_at,
    'ends_at', v_session.ends_at,
    'status', v_session.status
  );
end;
$function$;

comment on function public.create_training_session(text, timestamptz, timestamptz, text, text) is
  'Training staff only. Creates a scheduled session and audits it.';

revoke all on function public.create_training_session(text, timestamptz, timestamptz, text, text) from public;
grant execute on function public.create_training_session(text, timestamptz, timestamptz, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_training_session_status: scheduled -> completed | cancelled.
-- ---------------------------------------------------------------------------
create function public.set_training_session_status(p_session_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_session public.training_sessions%rowtype;
begin
  v_actor := public.require_training_staff();

  if p_status not in ('completed', 'cancelled') then
    raise exception 'a session can only be completed or cancelled' using errcode = '22023';
  end if;

  select * into v_session
    from public.training_sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if v_session.status = p_status then
    return jsonb_build_object('id', v_session.id, 'status', v_session.status, 'changed', false);
  end if;

  if v_session.status <> 'scheduled' then
    raise exception 'session is already %', v_session.status using errcode = '22023';
  end if;

  update public.training_sessions
     set status = p_status
   where id = v_session.id;

  insert into public.audit_logs (
    actor_id, action, target_table, target_id, before_data, after_data
  )
  values (
    v_actor,
    'training.session.status',
    'training_sessions',
    v_session.id,
    jsonb_build_object('status', v_session.status),
    jsonb_build_object('status', p_status)
  );

  return jsonb_build_object('id', v_session.id, 'status', p_status, 'changed', true);
end;
$function$;

comment on function public.set_training_session_status(uuid, text) is
  'Training staff only. Completes or cancels a scheduled session; the change is audited.';

revoke all on function public.set_training_session_status(uuid, text) from public;
grant execute on function public.set_training_session_status(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- mark_training_attendance: upsert many rows in one audited call.
-- p_entries: [{"player_id": "<uuid>", "status": "present"}]
-- ---------------------------------------------------------------------------
create function public.mark_training_attendance(p_session_id uuid, p_entries jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_session public.training_sessions%rowtype;
  v_count integer;
begin
  v_actor := public.require_training_staff();

  if jsonb_typeof(p_entries) <> 'array' or jsonb_array_length(p_entries) = 0 then
    raise exception 'attendance needs at least one player' using errcode = '22023';
  end if;

  select * into v_session
    from public.training_sessions
   where id = p_session_id
     for update;

  if not found then
    raise exception 'session not found' using errcode = 'P0002';
  end if;

  if v_session.status = 'cancelled' then
    raise exception 'a cancelled session cannot take attendance' using errcode = '22023';
  end if;

  if exists (
    select 1
      from jsonb_array_elements(p_entries) as entry
     where entry->>'status' is null
        or entry->>'status' not in ('present', 'absent', 'late', 'excused')
        or entry->>'player_id' is null
  ) then
    raise exception 'each attendance entry needs a player and a valid status'
      using errcode = '22023';
  end if;

  if (
    select count(distinct entry->>'player_id')
      from jsonb_array_elements(p_entries) as entry
  ) <> jsonb_array_length(p_entries) then
    raise exception 'a player appears twice in one attendance list' using errcode = '22023';
  end if;

  if (
    select count(*)
      from public.players
     where id in (
       select (entry->>'player_id')::uuid
         from jsonb_array_elements(p_entries) as entry
     )
  ) <> jsonb_array_length(p_entries) then
    raise exception 'unknown player' using errcode = '22023';
  end if;

  insert into public.training_attendance (session_id, player_id, status, recorded_by)
  select
    p_session_id,
    (entry->>'player_id')::uuid,
    entry->>'status',
    v_actor
   from jsonb_array_elements(p_entries) as entry
  on conflict (session_id, player_id)
  do update set
    status = excluded.status,
    recorded_by = excluded.recorded_by,
    recorded_at = now();

  get diagnostics v_count = row_count;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'training.attendance.mark',
    'training_sessions',
    p_session_id,
    jsonb_build_object('entries', p_entries)
  );

  return jsonb_build_object('session_id', p_session_id, 'recorded', v_count);
end;
$function$;

comment on function public.mark_training_attendance(uuid, jsonb) is
  'Training staff only. Upserts attendance for a session and audits the marked set.';

revoke all on function public.mark_training_attendance(uuid, jsonb) from public;
grant execute on function public.mark_training_attendance(uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- create_training_fee_period
-- ---------------------------------------------------------------------------
create function public.create_training_fee_period(
  p_label text,
  p_starts_on date,
  p_ends_on date,
  p_amount numeric,
  p_due_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_period public.training_fee_periods%rowtype;
begin
  v_actor := public.require_training_staff();

  insert into public.training_fee_periods (
    label, starts_on, ends_on, amount, due_on, created_by
  )
  values (p_label, p_starts_on, p_ends_on, p_amount, p_due_on, v_actor)
  returning * into v_period;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'training.fee_period.create',
    'training_fee_periods',
    v_period.id,
    jsonb_build_object(
      'label', v_period.label,
      'amount', v_period.amount,
      'starts_on', v_period.starts_on,
      'ends_on', v_period.ends_on
    )
  );

  return jsonb_build_object(
    'id', v_period.id,
    'label', v_period.label,
    'amount', v_period.amount,
    'due_on', v_period.due_on
  );
end;
$function$;

comment on function public.create_training_fee_period(text, date, date, numeric, date) is
  'Training staff only. Creates a fee period; labels are unique.';

revoke all on function public.create_training_fee_period(text, date, date, numeric, date) from public;
grant execute on function public.create_training_fee_period(text, date, date, numeric, date) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- record_training_payment: partial payments allowed, overpayment refused.
-- ---------------------------------------------------------------------------
create function public.record_training_payment(
  p_fee_period_id uuid,
  p_player_id uuid,
  p_amount numeric,
  p_paid_on date default null,
  p_method text default 'cash'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_period public.training_fee_periods%rowtype;
  v_paid numeric;
  v_payment public.training_payments%rowtype;
begin
  v_actor := public.require_training_staff();

  if p_amount is null or p_amount <= 0 or p_amount <> round(p_amount, 2) then
    raise exception 'payment amount must be a positive amount of money'
      using errcode = '22023';
  end if;

  select * into v_period
    from public.training_fee_periods
   where id = p_fee_period_id
     for update;

  if not found then
    raise exception 'fee period not found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'unknown player' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0)
    into v_paid
    from public.training_payments
   where fee_period_id = v_period.id
     and player_id = p_player_id
     and status = 'recorded';

  if v_paid + p_amount > v_period.amount then
    raise exception 'payment exceeds the remaining balance for this period'
      using errcode = '22023';
  end if;

  insert into public.training_payments (
    fee_period_id, player_id, amount, paid_on, method, recorded_by
  )
  values (
    v_period.id,
    p_player_id,
    p_amount,
    coalesce(p_paid_on, current_date),
    coalesce(p_method, 'cash'),
    v_actor
  )
  returning * into v_payment;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'training.payment.record',
    'training_payments',
    v_payment.id,
    jsonb_build_object(
      'fee_period_id', v_payment.fee_period_id,
      'player_id', v_payment.player_id,
      'amount', v_payment.amount,
      'method', v_payment.method
    )
  );

  return jsonb_build_object(
    'id', v_payment.id,
    'fee_period_id', v_payment.fee_period_id,
    'player_id', v_payment.player_id,
    'amount', v_payment.amount,
    'total_paid', v_paid + p_amount,
    'remaining', v_period.amount - (v_paid + p_amount)
  );
end;
$function$;

comment on function public.record_training_payment(uuid, uuid, numeric, date, text) is
  'Training staff only. Records a manual payment, allows partials, refuses overpayment, and audits it.';

revoke all on function public.record_training_payment(uuid, uuid, numeric, date, text) from public;
grant execute on function public.record_training_payment(uuid, uuid, numeric, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- void_training_payment: soft void with a reason; the row is kept.
-- ---------------------------------------------------------------------------
create function public.void_training_payment(p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid;
  v_payment public.training_payments%rowtype;
begin
  v_actor := public.require_training_staff();

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'a void reason is required' using errcode = '22023';
  end if;

  select * into v_payment
    from public.training_payments
   where id = p_payment_id
     for update;

  if not found then
    raise exception 'payment not found' using errcode = 'P0002';
  end if;

  if v_payment.status = 'voided' then
    raise exception 'payment is already voided' using errcode = '22023';
  end if;

  update public.training_payments
     set status = 'voided',
         voided_by = v_actor,
         voided_at = now(),
         void_reason = btrim(p_reason)
   where id = v_payment.id;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'training.payment.void',
    'training_payments',
    v_payment.id,
    jsonb_build_object('status', 'recorded', 'amount', v_payment.amount),
    jsonb_build_object('status', 'voided', 'reason', btrim(p_reason))
  );

  return jsonb_build_object('id', v_payment.id, 'status', 'voided');
end;
$function$;

comment on function public.void_training_payment(uuid, text) is
  'Training staff only. Voids a payment with a required reason; the row and its history are kept.';

revoke all on function public.void_training_payment(uuid, text) from public;
grant execute on function public.void_training_payment(uuid, text) to authenticated, service_role;

alter table public.training_sessions enable row level security;
alter table public.training_attendance enable row level security;
alter table public.training_fee_periods enable row level security;
alter table public.training_payments enable row level security;

commit;
