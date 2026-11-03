-- MBC Arena - Migration 015: payment receipts and staff review
--
-- Apply after backend/migrations/014_tournament_registration.sql.
--
-- A member pays by GCash (or another method) and uploads proof. Staff review the
-- receipt and either accept it — which records/applies the payment exactly once
-- — or reject it with a reason. Receipts are their own rows, so training,
-- tournament entrance fees, and jersey orders share one auditable workflow.
--
-- Money never changes without a reviewer: every receipt is `pending` until a
-- trainer, tournament manager, or Super Admin accepts it.

begin;

-- ---------------------------------------------------------------------------
-- jersey_order_payments: one fee row per jersey order
-- ---------------------------------------------------------------------------
-- Jersey orders now carry money. The row is created from the project price at
-- order time, so a later price change does not rewrite what a member owes.
create table public.jersey_order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.jersey_orders (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  amount numeric(12, 2) not null default 0,
  status text not null default 'unpaid',
  marked_by uuid references public.profiles (id) on delete set null,
  marked_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jersey_order_payments_order_key unique (order_id),
  constraint jersey_order_payments_amount_check
    check (amount >= 0 and amount <= 1000000 and amount = round(amount, 2)),
  constraint jersey_order_payments_status_check
    check (status in ('unpaid', 'paid', 'waived')),
  constraint jersey_order_payments_note_check
    check (note is null or char_length(note) <= 500),
  constraint jersey_order_payments_marked_check
    check (
      (status = 'unpaid' and marked_at is null)
      or (status in ('paid', 'waived') and marked_at is not null)
    )
);

comment on table public.jersey_order_payments is
  'One payment row per jersey order. Staff mark paid/waived; a receipt can also settle it.';

create index jersey_order_payments_player_idx
  on public.jersey_order_payments (player_id, status);

create trigger jersey_order_payments_set_updated_at
  before update on public.jersey_order_payments
  for each row execute function public.set_updated_at();

-- Existing orders get a row immediately. A zero-priced project is already
-- settled, so it starts waived instead of asking for proof of a zero payment.
insert into public.jersey_order_payments (order_id, player_id, amount, status, marked_at)
select
  o.id,
  o.player_id,
  round(coalesce(p.price, 0) * o.quantity, 2),
  case when round(coalesce(p.price, 0) * o.quantity, 2) = 0 then 'waived' else 'unpaid' end,
  case when round(coalesce(p.price, 0) * o.quantity, 2) = 0 then now() else null end
from public.jersey_orders as o
join public.jersey_projects as p on p.id = o.project_id;

create function public.sync_jersey_order_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_price numeric(10, 2);
  v_amount numeric(12, 2);
begin
  select p.price
    into v_price
    from public.jersey_projects as p
   where p.id = new.project_id;

  v_amount := round(coalesce(v_price, 0) * new.quantity, 2);

  if tg_op = 'INSERT' then
    insert into public.jersey_order_payments (order_id, player_id, amount, status, marked_at)
    values (
      new.id,
      new.player_id,
      v_amount,
      case when v_amount = 0 then 'waived' else 'unpaid' end,
      case when v_amount = 0 then now() else null end
    );
  else
    update public.jersey_order_payments
       set amount = v_amount,
           status = case
             when status = 'unpaid' and v_amount = 0 then 'waived'
             when status = 'paid' and v_amount <> amount then 'unpaid'
             else status
           end,
           marked_by = case
             when status = 'paid' and v_amount <> amount then null
             else marked_by
           end,
           marked_at = case
             when status = 'unpaid' and v_amount = 0 then now()
             when status = 'paid' and v_amount <> amount then null
             else marked_at
           end
     where order_id = new.id;
  end if;

  return new;
end;
$function$;

revoke all on function public.sync_jersey_order_payment() from public, anon, authenticated, service_role;

create trigger jersey_orders_payment_insert
  after insert on public.jersey_orders
  for each row execute function public.sync_jersey_order_payment();

create trigger jersey_orders_payment_update
  after update of quantity, project_id on public.jersey_orders
  for each row execute function public.sync_jersey_order_payment();

-- ---------------------------------------------------------------------------
-- payment_receipts: member-submitted proof, reviewed by staff
-- ---------------------------------------------------------------------------
create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete restrict,
  fee_period_id uuid references public.training_fee_periods (id) on delete restrict,
  entry_payment_id uuid references public.tournament_entry_payments (id) on delete restrict,
  jersey_payment_id uuid references public.jersey_order_payments (id) on delete restrict,
  amount numeric(12, 2) not null,
  method text not null default 'gcash',
  reference_no text,
  paid_on date not null default current_date,
  receipt_path text not null,
  target_label text not null,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_receipts_purpose_check
    check (purpose in ('training', 'tournament', 'jersey')),
  constraint payment_receipts_target_check
    check (
      (purpose = 'training'
        and fee_period_id is not null
        and entry_payment_id is null
        and jersey_payment_id is null)
      or (purpose = 'tournament'
        and fee_period_id is null
        and entry_payment_id is not null
        and jersey_payment_id is null)
      or (purpose = 'jersey'
        and fee_period_id is null
        and entry_payment_id is null
        and jersey_payment_id is not null)
    ),
  constraint payment_receipts_amount_check
    check (amount > 0 and amount <= 1000000 and amount = round(amount, 2)),
  constraint payment_receipts_method_check
    check (method in ('cash', 'bank_transfer', 'gcash', 'other')),
  constraint payment_receipts_reference_check
    check (reference_no is null or char_length(btrim(reference_no)) between 1 and 120),
  constraint payment_receipts_path_check
    check (
      char_length(receipt_path) between 1 and 400
      and receipt_path ~ '^receipts/(training|tournament|jersey)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|pdf)$'
    ),
  constraint payment_receipts_label_check
    check (target_label = btrim(target_label) and char_length(target_label) between 1 and 200),
  constraint payment_receipts_status_check
    check (status in ('pending', 'approved', 'rejected')),
  constraint payment_receipts_note_check
    check (review_note is null or char_length(review_note) <= 500),
  constraint payment_receipts_reviewed_check
    check (
      (status = 'pending' and reviewed_by is null and reviewed_at is null)
      or (status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    )
);

comment on table public.payment_receipts is
  'Member payment proof. Pending rows never count as money; an approval applies the payment once.';

create index payment_receipts_submitter_idx
  on public.payment_receipts (submitted_by, created_at desc);

create index payment_receipts_status_idx
  on public.payment_receipts (purpose, status, created_at desc);

-- One open receipt per target, so a member cannot spam the queue. A rejected
-- receipt frees the target for another attempt.
create unique index payment_receipts_pending_training_key
  on public.payment_receipts (fee_period_id, player_id)
  where status = 'pending' and purpose = 'training';

create unique index payment_receipts_pending_tournament_key
  on public.payment_receipts (entry_payment_id)
  where status = 'pending' and purpose = 'tournament';

create unique index payment_receipts_pending_jersey_key
  on public.payment_receipts (jersey_payment_id)
  where status = 'pending' and purpose = 'jersey';

create trigger payment_receipts_set_updated_at
  before update on public.payment_receipts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notification vocabulary
-- ---------------------------------------------------------------------------
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
      'payment_receipt_rejected'
    )
  );

-- ---------------------------------------------------------------------------
-- set_jersey_order_payment: staff mark a jersey fee paid/waived/unpaid
-- ---------------------------------------------------------------------------
create function public.set_jersey_order_payment(
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
  v_actor uuid := auth.uid();
  v_payment public.jersey_order_payments%rowtype;
  v_project_name text;
  v_profile_id uuid;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if v_actor is null
     or not (
       public.has_role(v_actor, 'super_admin')
       or public.has_role(v_actor, 'trainer')
     ) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_status not in ('unpaid', 'paid', 'waived') then
    raise exception 'unknown payment status' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'the payment note is too long' using errcode = '22023';
  end if;

  select * into v_payment
    from public.jersey_order_payments
   where id = p_payment_id
     for update;

  if not found then
    raise exception 'jersey payment not found' using errcode = 'P0002';
  end if;

  update public.jersey_order_payments
     set status = p_status,
         marked_by = case when p_status = 'unpaid' then null else v_actor end,
         marked_at = case when p_status = 'unpaid' then null else now() end,
         note = v_note
   where id = v_payment.id
  returning * into v_payment;

  select p.name into v_project_name
    from public.jersey_orders as o
    join public.jersey_projects as p on p.id = o.project_id
   where o.id = v_payment.order_id;

  if p_status = 'paid' then
    select p.profile_id into v_profile_id
      from public.players as p
     where p.id = v_payment.player_id;

    perform public.notify_profile(
      v_profile_id,
      'payment_receipt_approved',
      'Jersey payment confirmed',
      'Your payment for ' || coalesce(v_project_name, 'a jersey order') || ' is confirmed.',
      '/jerseys',
      null,
      v_actor
    );
  end if;

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    'jersey.payment',
    'jersey_order_payments',
    v_payment.id,
    jsonb_build_object('status', v_payment.status),
    jsonb_build_object('status', p_status, 'note', v_note)
  );

  return jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_payment.order_id,
    'status', v_payment.status
  );
end;
$function$;

comment on function public.set_jersey_order_payment(uuid, text, text) is
  'Training staff mark one jersey order paid, unpaid, or waived. Paid notifies the player.';

revoke all on function public.set_jersey_order_payment(uuid, text, text) from public;
grant execute on function public.set_jersey_order_payment(uuid, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- submit_payment_receipt: an active player uploads proof for their own target
-- ---------------------------------------------------------------------------
create function public.submit_payment_receipt(
  p_purpose text,
  p_target_id uuid,
  p_amount numeric,
  p_method text,
  p_reference_no text,
  p_paid_on date,
  p_receipt_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_player uuid;
  v_amount numeric(12, 2) := round(coalesce(p_amount, 0), 2);
  v_method text := coalesce(nullif(btrim(coalesce(p_method, '')), ''), 'gcash');
  v_reference text := nullif(btrim(coalesce(p_reference_no, '')), '');
  v_path text := nullif(btrim(coalesce(p_receipt_path, '')), '');
  v_paid_on date := coalesce(p_paid_on, current_date);
  v_due numeric(12, 2);
  v_label text;
  v_period public.training_fee_periods%rowtype;
  v_entry_payment public.tournament_entry_payments%rowtype;
  v_jersey_payment public.jersey_order_payments%rowtype;
  v_jersey_order public.jersey_orders%rowtype;
  v_receipt public.payment_receipts%rowtype;
begin
  if v_actor is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  v_player := public.current_active_player_id();

  if v_player is null then
    raise exception 'an active player record is required to submit a receipt'
      using errcode = '42501';
  end if;

  if p_purpose not in ('training', 'tournament', 'jersey') then
    raise exception 'unknown receipt purpose' using errcode = '22023';
  end if;

  if v_amount <= 0 or v_amount <> round(v_amount, 2) then
    raise exception 'the receipt amount must be a positive amount of money'
      using errcode = '22023';
  end if;

  if v_method not in ('cash', 'bank_transfer', 'gcash', 'other') then
    raise exception 'unknown payment method' using errcode = '22023';
  end if;

  if v_reference is not null and char_length(v_reference) > 120 then
    raise exception 'the reference number is too long' using errcode = '22023';
  end if;

  if v_paid_on > current_date then
    raise exception 'the payment date cannot be in the future' using errcode = '22023';
  end if;

  -- Anchored path: receipts/<purpose>/<uploader profile>/<file>.<ext>. The
  -- uploader folder must be the caller, so a receipt cannot point at another
  -- member's upload.
  if v_path is null or v_path !~ '^receipts/(training|tournament|jersey)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp|pdf)$' then
    raise exception 'the receipt path must be a receipts/<purpose>/<profile>/<file> object ending in .png, .jpg, .jpeg, .webp, or .pdf'
      using errcode = '22023';
  end if;

  if split_part(v_path, '/', 2) <> p_purpose
     or split_part(v_path, '/', 3) <> v_actor::text then
    raise exception 'the receipt path does not belong to this member and purpose'
      using errcode = '22023';
  end if;

  if p_purpose = 'training' then
    select * into v_period
      from public.training_fee_periods
     where id = p_target_id
       for update;

    if not found then
      raise exception 'fee period not found' using errcode = 'P0002';
    end if;

    select coalesce(sum(amount), 0)
      into v_due
      from public.training_payments
     where fee_period_id = v_period.id
       and player_id = v_player
       and status = 'recorded';

    v_due := round(v_period.amount - v_due, 2);

    if v_due <= 0 then
      raise exception 'this fee period is already settled' using errcode = '22023';
    end if;

    if v_amount > v_due then
      raise exception 'the receipt is more than the remaining balance of %', v_due
        using errcode = '22023';
    end if;

    v_label := v_period.label;
  elsif p_purpose = 'tournament' then
    select * into v_entry_payment
      from public.tournament_entry_payments
     where id = p_target_id
       for update;

    if not found then
      raise exception 'entrance fee not found' using errcode = 'P0002';
    end if;

    if v_entry_payment.status <> 'unpaid' then
      raise exception 'this entrance fee is already settled' using errcode = '22023';
    end if;

    if v_amount <> v_entry_payment.amount then
      raise exception 'the receipt must match the entrance fee of %', v_entry_payment.amount
        using errcode = '22023';
    end if;

    if v_entry_payment.player_id is distinct from v_player then
      raise exception 'this is not your entrance fee' using errcode = '42501';
    end if;

    select t.name into v_label
      from public.tournament_entries as en
      join public.tournament_events as ev on ev.id = en.event_id
      join public.tournaments as t on t.id = ev.tournament_id
     where en.id = v_entry_payment.entry_id;
  else
    select * into v_jersey_payment
      from public.jersey_order_payments
     where id = p_target_id
       for update;

    if not found then
      raise exception 'jersey payment not found' using errcode = 'P0002';
    end if;

    select * into v_jersey_order
      from public.jersey_orders
     where id = v_jersey_payment.order_id;

    if v_jersey_payment.player_id <> v_player then
      raise exception 'this is not your jersey order' using errcode = '42501';
    end if;

    if v_jersey_order.status <> 'submitted' then
      raise exception 'this jersey order is cancelled' using errcode = '22023';
    end if;

    if v_jersey_payment.status <> 'unpaid' then
      raise exception 'this jersey payment is already settled' using errcode = '22023';
    end if;

    if v_amount <> v_jersey_payment.amount then
      raise exception 'the receipt must match the jersey total of %', v_jersey_payment.amount
        using errcode = '22023';
    end if;

    select p.name into v_label
      from public.jersey_projects as p
     where p.id = v_jersey_order.project_id;
  end if;

  insert into public.payment_receipts (
    purpose,
    submitted_by,
    player_id,
    fee_period_id,
    entry_payment_id,
    jersey_payment_id,
    amount,
    method,
    reference_no,
    paid_on,
    receipt_path,
    target_label
  )
  values (
    p_purpose,
    v_actor,
    v_player,
    case when p_purpose = 'training' then v_period.id else null end,
    case when p_purpose = 'tournament' then v_entry_payment.id else null end,
    case when p_purpose = 'jersey' then v_jersey_payment.id else null end,
    v_amount,
    v_method,
    v_reference,
    v_paid_on,
    v_path,
    v_label
  )
  returning * into v_receipt;

  insert into public.audit_logs (actor_id, action, target_table, target_id, after_data)
  values (
    v_actor,
    'payment.receipt.submit',
    'payment_receipts',
    v_receipt.id,
    jsonb_build_object(
      'purpose', v_receipt.purpose,
      'amount', v_receipt.amount,
      'method', v_receipt.method
    )
  );

  return jsonb_build_object(
    'receipt_id', v_receipt.id,
    'status', v_receipt.status
  );
end;
$function$;

comment on function public.submit_payment_receipt(text, uuid, numeric, text, text, date, text) is
  'An active player submits proof for their own fee period, entrance fee, or jersey order. The target stays unpaid until staff accept it.';

revoke all on function public.submit_payment_receipt(text, uuid, numeric, text, text, date, text) from public;
grant execute on function public.submit_payment_receipt(text, uuid, numeric, text, text, date, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- review_payment_receipt: staff accept (apply the payment) or reject
-- ---------------------------------------------------------------------------
create function public.review_payment_receipt(
  p_receipt_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_receipt public.payment_receipts%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_period public.training_fee_periods%rowtype;
  v_paid numeric(12, 2);
  v_due numeric(12, 2);
  v_payment public.tournament_entry_payments%rowtype;
  v_jersey public.jersey_order_payments%rowtype;
  v_tournament_id uuid;
  v_link text;
  v_title text;
  v_body text;
  v_notification_type text;
begin
  if v_actor is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select * into v_receipt
    from public.payment_receipts
   where id = p_receipt_id
     for update;

  if not found then
    raise exception 'receipt not found' using errcode = 'P0002';
  end if;

  if v_receipt.status <> 'pending' then
    raise exception 'this receipt has already been reviewed' using errcode = '22023';
  end if;

  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'the review note is too long' using errcode = '22023';
  end if;

  if not p_approve and (v_note is null or char_length(v_note) < 3) then
    raise exception 'a rejection needs a reason of at least three characters'
      using errcode = '22023';
  end if;

  if v_receipt.purpose in ('training', 'jersey') then
    if not (
      public.has_role(v_actor, 'super_admin')
      or public.has_role(v_actor, 'trainer')
    ) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  else
    if not public.is_tournament_staff(v_actor) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  end if;

  if p_approve then
    if v_receipt.purpose = 'training' then
      select * into v_period
        from public.training_fee_periods
       where id = v_receipt.fee_period_id
         for update;

      select coalesce(sum(amount), 0)
        into v_paid
        from public.training_payments
       where fee_period_id = v_period.id
         and player_id = v_receipt.player_id
         and status = 'recorded';

      v_due := round(v_period.amount - v_paid, 2);

      if v_receipt.amount > v_due then
        raise exception 'this receipt now exceeds the remaining balance of %', v_due
          using errcode = '22023';
      end if;

      insert into public.training_payments (
        fee_period_id, player_id, amount, paid_on, method, recorded_by
      )
      values (
        v_period.id,
        v_receipt.player_id,
        v_receipt.amount,
        v_receipt.paid_on,
        v_receipt.method,
        v_actor
      );

      v_link := '/payments';
    elsif v_receipt.purpose = 'tournament' then
      select * into v_payment
        from public.tournament_entry_payments
       where id = v_receipt.entry_payment_id
         for update;

      if v_payment.status <> 'unpaid' then
        raise exception 'this entrance fee is already settled' using errcode = '22023';
      end if;

      if v_receipt.amount <> v_payment.amount then
        raise exception 'the entrance fee changed; ask the player to resubmit the receipt'
          using errcode = '22023';
      end if;

      update public.tournament_entry_payments
         set status = 'paid',
             marked_by = v_actor,
             marked_at = now(),
             note = coalesce(v_note, note)
       where id = v_payment.id
      returning * into v_payment;

      select t.id into v_tournament_id
        from public.tournament_entries as en
        join public.tournament_events as ev on ev.id = en.event_id
        join public.tournaments as t on t.id = ev.tournament_id
       where en.id = v_payment.entry_id;

      v_link := '/tournaments/' || coalesce(v_tournament_id::text, '');

      if v_payment.player_id is not null then
        perform public.notify_profile(
          (select p.profile_id from public.players as p where p.id = v_payment.player_id),
          'entry_payment_paid',
          'Entrance fee confirmed',
          'Your payment is confirmed. You are eligible for the draw.',
          v_link,
          v_tournament_id,
          v_actor
        );
      end if;
    else
      select * into v_jersey
        from public.jersey_order_payments
       where id = v_receipt.jersey_payment_id
         for update;

      if v_jersey.status <> 'unpaid' then
        raise exception 'this jersey payment is already settled' using errcode = '22023';
      end if;

      if v_receipt.amount <> v_jersey.amount then
        raise exception 'the jersey total changed; ask the player to resubmit the receipt'
          using errcode = '22023';
      end if;

      update public.jersey_order_payments
         set status = 'paid',
             marked_by = v_actor,
             marked_at = now(),
             note = coalesce(v_note, note)
       where id = v_jersey.id
      returning * into v_jersey;

      v_link := '/jerseys';
    end if;

    update public.payment_receipts
       set status = 'approved',
           reviewed_by = v_actor,
           reviewed_at = now(),
           review_note = v_note
     where id = v_receipt.id
    returning * into v_receipt;

    v_title := 'Payment receipt approved';
    v_body := 'Your payment of ' || v_receipt.amount::text || ' was accepted.';
    v_notification_type := 'payment_receipt_approved';
  else
    update public.payment_receipts
       set status = 'rejected',
           reviewed_by = v_actor,
           reviewed_at = now(),
           review_note = v_note
     where id = v_receipt.id
    returning * into v_receipt;

    v_link := case v_receipt.purpose
      when 'training' then '/payments'
      when 'jersey' then '/jerseys'
      else '/tournaments'
    end;
    v_title := 'Payment receipt needs attention';
    v_body := 'Your receipt was not accepted: ' || v_note;
    v_notification_type := 'payment_receipt_rejected';
  end if;

  perform public.notify_profile(
    v_receipt.submitted_by,
    v_notification_type,
    v_title,
    left(v_body, 500),
    v_link,
    null,
    v_actor
  );

  insert into public.audit_logs (actor_id, action, target_table, target_id, before_data, after_data)
  values (
    v_actor,
    case when p_approve then 'payment.receipt.approve' else 'payment.receipt.reject' end,
    'payment_receipts',
    v_receipt.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', v_receipt.status, 'note', v_note)
  );

  return jsonb_build_object(
    'receipt_id', v_receipt.id,
    'status', v_receipt.status,
    'purpose', v_receipt.purpose
  );
end;
$function$;

comment on function public.review_payment_receipt(uuid, boolean, text) is
  'Trainers review training/jersey receipts; tournament staff review entrance fees. Approval applies the payment exactly once.';

revoke all on function public.review_payment_receipt(uuid, boolean, text) from public;
grant execute on function public.review_payment_receipt(uuid, boolean, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Storage bucket: private proof-of-payment files
-- ---------------------------------------------------------------------------
do $bucket$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema is absent; skipping the payment-receipts bucket';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'payment-receipts',
    'payment-receipts',
    false,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
end;
$bucket$;

alter table public.jersey_order_payments enable row level security;
alter table public.payment_receipts enable row level security;

commit;
