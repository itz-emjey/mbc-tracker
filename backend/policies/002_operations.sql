-- MBC Arena — RLS policies for operations tables
--
-- Apply after backend/migrations/001_identity.sql and 001_identity policies.

begin;

revoke all on table public.audit_logs, public.app_settings from anon, authenticated;

grant select on table public.audit_logs, public.app_settings to authenticated;

create policy audit_logs_select_super_admin
on public.audit_logs
for select
to authenticated
using (public.has_role((select auth.uid()), 'super_admin'));

create policy app_settings_select_club_members
on public.app_settings
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

commit;
