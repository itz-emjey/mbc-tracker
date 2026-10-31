-- MBC Arena - RLS policies for ShuttlePower rule versions
--
-- Apply after backend/migrations/006_shuttlepower_rules.sql.
--
-- Rule versions are club-wide configuration: any approved member may read them
-- so the UI can show the provisional/approved state honestly. Nobody gets a
-- write grant, and there is no client-facing RPC at all: enabling an approved
-- formula is a reviewed SQL step, recorded in PLAN.md with the rule it came
-- from. The reconciliation function's authority is enforced inside
-- require_super_admin(), not by the grant alone.

begin;

revoke all on table public.sp_rule_versions from anon, authenticated;

grant select on table public.sp_rule_versions to authenticated;

create policy sp_rule_versions_select_club_members
on public.sp_rule_versions
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

commit;
