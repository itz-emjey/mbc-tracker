-- MBC Arena - RLS policies for payment receipts
--
-- Apply after backend/migrations/015_payment_receipts.sql.
--
-- Reads: a member sees fees and receipts that belong to them. Trainers and
-- Super Admins see training and jersey rows; tournament staff also see entrance
-- fee rows. No table accepts client writes: submission and review cross the
-- audited RPCs.
--
-- The `payment-receipts` bucket is private. Members read only their own uploads;
-- staff read the purposes they review. Signed URLs are minted in the browser.

begin;

revoke all on table
  public.jersey_order_payments,
  public.payment_receipts
from anon, authenticated;

grant select on table
  public.jersey_order_payments,
  public.payment_receipts
to authenticated;

create policy jersey_order_payments_select_staff_or_own
on public.jersey_order_payments
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or player_id in (
    select p.id
    from public.players as p
    where p.profile_id = (select auth.uid())
  )
);

create policy payment_receipts_select_own_or_reviewer
on public.payment_receipts
for select
to authenticated
using (
  submitted_by = (select auth.uid())
  or public.has_role((select auth.uid()), 'super_admin')
  or (
    purpose in ('training', 'jersey')
    and public.has_role((select auth.uid()), 'trainer')
  )
  or (
    purpose = 'tournament'
    and public.is_tournament_staff((select auth.uid()))
  )
);

do $policy$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema is absent; skipping payment receipt policies';
    return;
  end if;

  execute $sql$
    create policy payment_receipts_read
    on storage.objects
    for select
    to authenticated
    using (
      bucket_id = 'payment-receipts'
      and (
        (storage.foldername(name))[3] = (select auth.uid())::text
        or public.has_role((select auth.uid()), 'super_admin')
        or (
          (storage.foldername(name))[1] = 'receipts'
          and (storage.foldername(name))[2] in ('training', 'jersey')
          and public.has_role((select auth.uid()), 'trainer')
        )
        or (
          (storage.foldername(name))[1] = 'receipts'
          and (storage.foldername(name))[2] = 'tournament'
          and public.is_tournament_staff((select auth.uid()))
        )
      )
    )
  $sql$;

  execute $sql$
    create policy payment_receipts_insert
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'payment-receipts'
      and (storage.foldername(name))[1] = 'receipts'
      and (storage.foldername(name))[2] in ('training', 'tournament', 'jersey')
      and (storage.foldername(name))[3] = (select auth.uid())::text
    )
  $sql$;

  execute $sql$
    create policy payment_receipts_delete
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'payment-receipts'
      and (storage.foldername(name))[3] = (select auth.uid())::text
    )
  $sql$;
end;
$policy$;

commit;
