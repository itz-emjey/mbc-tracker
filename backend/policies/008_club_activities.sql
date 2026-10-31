-- MBC Arena - RLS policies for jerseys, polls, and announcements
--
-- Apply after backend/migrations/008_club_activities.sql.
--
-- Reads:
--   * draft jersey projects and draft polls are staff-only; members see the
--     rest of the project/poll and its designs, sizes, and options;
--   * a jersey order is visible to staff and to the ordering player;
--   * a poll vote is visible to staff and to the player who cast it (the
--     anonymous poll setting is about tallies and identity: tallies cross the
--     poll_results RPC, which never returns voter ids);
--   * announcements are visible to members only once published.
--
-- Writes: none. There is no INSERT/UPDATE/DELETE grant on any of these tables;
-- projects, designs, sizes, orders, polls, votes, and announcements all cross
-- the audited RPCs in migration 008.

begin;

revoke all on table
  public.jersey_projects,
  public.jersey_designs,
  public.jersey_sizes,
  public.jersey_orders,
  public.polls,
  public.poll_options,
  public.poll_votes,
  public.announcements
from anon, authenticated;

grant select on table
  public.jersey_projects,
  public.jersey_designs,
  public.jersey_sizes,
  public.jersey_orders,
  public.polls,
  public.poll_options,
  public.poll_votes,
  public.announcements
to authenticated;

create policy jersey_projects_select_visible
on public.jersey_projects
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or status <> 'draft'
);

create policy jersey_designs_select_visible
on public.jersey_designs
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or exists (
    select 1 from public.jersey_projects as p
     where p.id = project_id
       and p.status <> 'draft'
  )
);

create policy jersey_sizes_select_visible
on public.jersey_sizes
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or exists (
    select 1 from public.jersey_projects as p
     where p.id = project_id
       and p.status <> 'draft'
  )
);

create policy jersey_orders_select_staff_or_own
on public.jersey_orders
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or player_id in (
    select p.id from public.players as p
     where p.profile_id = (select auth.uid())
  )
);

create policy polls_select_visible
on public.polls
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or status <> 'draft'
);

create policy poll_options_select_visible
on public.poll_options
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or exists (
    select 1 from public.polls as p
     where p.id = poll_id
       and p.status <> 'draft'
  )
);

create policy poll_votes_select_staff_or_own
on public.poll_votes
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or player_id in (
    select p.id from public.players as p
     where p.profile_id = (select auth.uid())
  )
);

create policy announcements_select_published_or_staff
on public.announcements
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or status = 'published'
);

commit;
