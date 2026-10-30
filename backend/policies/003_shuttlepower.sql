-- MBC Arena — RLS policies for the Phase 1 ShuttlePower bootstrap
--
-- Apply after backend/migrations/002_shuttlepower_bootstrap.sql.
-- Players read SP but never write it: there is no INSERT/UPDATE/DELETE grant
-- and no policy that would permit one. Privileged RPCs (Group G) write with
-- the definer's privileges.

begin;

revoke all on table public.sp_accounts, public.sp_transactions from anon, authenticated;

grant select on table public.sp_accounts, public.sp_transactions to authenticated;

create policy sp_accounts_select_club_members
on public.sp_accounts
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

create policy sp_transactions_select_own_or_super_admin
on public.sp_transactions
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or player_id in (
    select p.id
    from public.players as p
    where p.profile_id = (select auth.uid())
  )
);

commit;
