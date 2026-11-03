-- MBC Arena - RLS policies for tournament registration and payments
--
-- Apply after backend/migrations/014_tournament_registration.sql.
--
-- Payment rows are visible to tournament staff, the payer, and teammates on the
-- same entry. Partner invitations are visible to the two players and staff.
-- Neither table accepts client writes.

begin;

revoke all on table
  public.tournament_entry_payments,
  public.tournament_partner_invitations
from anon, authenticated;

grant select on table
  public.tournament_entry_payments,
  public.tournament_partner_invitations
to authenticated;

create policy tournament_entry_payments_select_visible
on public.tournament_entry_payments
for select
to authenticated
using (
  public.is_tournament_staff((select auth.uid()))
  or exists (
    select 1
      from public.players as p
     where p.id = tournament_entry_payments.player_id
       and p.profile_id = (select auth.uid())
  )
  or exists (
    select 1
      from public.tournament_entries as en
      join public.team_members as tm on tm.team_id = en.team_id
      join public.players as p on p.id = tm.player_id
     where en.id = tournament_entry_payments.entry_id
       and p.profile_id = (select auth.uid())
  )
);

create policy tournament_partner_invitations_select_visible
on public.tournament_partner_invitations
for select
to authenticated
using (
  public.is_tournament_staff((select auth.uid()))
  or exists (
    select 1
      from public.players as p
     where p.profile_id = (select auth.uid())
       and p.id in (
         tournament_partner_invitations.inviter_player_id,
         tournament_partner_invitations.partner_player_id
       )
  )
);

-- Public poster bucket so members load images without a signed URL. Only
-- tournament staff may upload, replace, or delete an object.
do $policy$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage schema is absent; skipping tournament poster policies';
    return;
  end if;

  execute $sql$
    create policy tournament_posters_read
    on storage.objects
    for select
    to authenticated
    using (bucket_id = 'tournament-posters')
  $sql$;

  execute $sql$
    create policy tournament_posters_insert
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'tournament-posters'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'tournament_manager')
      )
    )
  $sql$;

  execute $sql$
    create policy tournament_posters_update
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'tournament-posters'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'tournament_manager')
      )
    )
    with check (
      bucket_id = 'tournament-posters'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'tournament_manager')
      )
    )
  $sql$;

  execute $sql$
    create policy tournament_posters_delete
    on storage.objects
    for delete
    to authenticated
    using (
      bucket_id = 'tournament-posters'
      and (
        public.has_role((select auth.uid()), 'super_admin')
        or public.has_role((select auth.uid()), 'tournament_manager')
      )
    )
  $sql$;
end;
$policy$;

commit;
