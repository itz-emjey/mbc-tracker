-- MBC Arena — RLS policies for seasons (migration 012)
--
-- Apply after backend/migrations/012_seasons.sql.
--
-- Every seasonal table is read-only to clients: balances and published snapshots
-- feed the seasonal leaderboard (S15), while deduction batches and transition
-- checkpoints are Super Admin-only. There is no client write grant anywhere, and
-- every write crosses an audited RPC.

begin;

revoke all on table public.seasons,
  public.season_balances,
  public.season_player_results,
  public.season_deduction_batches,
  public.season_deduction_entries,
  public.season_transition_steps
from anon, authenticated;

grant select on table public.seasons,
  public.season_balances,
  public.season_player_results
to authenticated;

grant select on table public.season_deduction_batches,
  public.season_deduction_entries,
  public.season_transition_steps
to authenticated;

-- Season metadata, live seasonal balances, and frozen snapshots: every active
-- member may read them (S15 publishes the seasonal leaderboard).
create policy seasons_select_members
on public.seasons
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

create policy season_balances_select_members
on public.season_balances
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

create policy season_player_results_select_members
on public.season_player_results
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

-- Deduction batches and transition checkpoints stay with the Super Admin, who
-- approves or rejects a batch (S9) and recovers a failed transition (S20).
create policy season_deduction_batches_select_super_admin
on public.season_deduction_batches
for select
to authenticated
using (public.has_role((select auth.uid()), 'super_admin'));

create policy season_deduction_entries_select_super_admin
on public.season_deduction_entries
for select
to authenticated
using (public.has_role((select auth.uid()), 'super_admin'));

create policy season_transition_steps_select_super_admin
on public.season_transition_steps
for select
to authenticated
using (public.has_role((select auth.uid()), 'super_admin'));

commit;
