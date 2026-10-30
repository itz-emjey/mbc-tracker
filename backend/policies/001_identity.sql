-- MBC Arena — RLS policies for identity tables
--
-- Apply after backend/migrations/001_identity.sql.
-- Least privilege: anon has no table access at all; authenticated receives
-- only the column privileges listed here. Every table has RLS enabled by the
-- migration, so a missing policy denies access.

begin;

revoke all on table
  public.profiles,
  public.players,
  public.roles,
  public.user_roles,
  public.registration_requests
from anon, authenticated;

grant select on table
  public.profiles,
  public.players,
  public.roles,
  public.user_roles,
  public.registration_requests
to authenticated;

-- A user may create their own pending profile and edit only their display name.
grant insert (id, full_name) on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

-- Staff may create/update player records but cannot link an account directly;
-- profile_id is intentionally absent from these grants and is set by RPC.
grant insert (full_name, gender, status, joined_on) on public.players to authenticated;
grant update (full_name, gender, status, joined_on) on public.players to authenticated;

-- roles ---------------------------------------------------------------------
create policy roles_select_authenticated
on public.roles
for select
to authenticated
using (true);

-- profiles ------------------------------------------------------------------
create policy profiles_select_own_or_super_admin
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or public.has_role((select auth.uid()), 'super_admin')
);

create policy profiles_insert_self_pending
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
  and status = 'pending'
);

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- players -------------------------------------------------------------------
create policy players_select_club_members
on public.players
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

create policy players_insert_staff
on public.players
for insert
to authenticated
with check (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
);

create policy players_update_staff
on public.players
for update
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
)
with check (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
);

-- user_roles ----------------------------------------------------------------
create policy user_roles_select_own_or_super_admin
on public.user_roles
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'super_admin')
);

-- registration_requests -----------------------------------------------------
create policy registration_requests_select_own_or_super_admin
on public.registration_requests
for select
to authenticated
using (
  profile_id = (select auth.uid())
  or public.has_role((select auth.uid()), 'super_admin')
);

commit;
