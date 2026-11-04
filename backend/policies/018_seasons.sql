-- MBC Arena — RLS policies for the seasonal implementation (migration 018)
--
-- Apply after backend/migrations/018_seasonal_implementation.sql.
--
-- `season_transitions` is the S20 recovery record. It is read-only to clients
-- and visible only to a Super Admin, who can inspect a failed transition and
-- re-run it through the audited `run_season_transition(true)` RPC.

begin;

revoke all on table public.season_transitions from anon, authenticated;

grant select on table public.season_transitions to authenticated;

create policy season_transitions_select_super_admin
on public.season_transitions
for select
to authenticated
using (public.has_role((select auth.uid()), 'super_admin'));

commit;
