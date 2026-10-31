-- MBC Arena - RLS policies for tournaments and results
--
-- Apply after backend/migrations/005_tournaments.sql.
--
-- Clients are read-only on every tournament table. Writes are RPC-only so the
-- cap, D10 pairing, draw coverage, and result advancement are enforced in one
-- transaction. Drafts are staff-only; published tournaments are readable by
-- every active club member.

begin;

revoke all on table
  public.tournaments,
  public.tournament_events,
  public.teams,
  public.team_members,
  public.tournament_entries,
  public.matches,
  public.match_games
from anon, authenticated;

grant select on table
  public.tournaments,
  public.tournament_events,
  public.teams,
  public.team_members,
  public.tournament_entries,
  public.matches,
  public.match_games
to authenticated;

create policy tournaments_select_visible
on public.tournaments
for select
to authenticated
using (public.can_view_tournament((select auth.uid()), id));

create policy tournament_events_select_visible
on public.tournament_events
for select
to authenticated
using (public.can_view_tournament((select auth.uid()), tournament_id));

create policy teams_select_visible
on public.teams
for select
to authenticated
using (
  exists (
    select 1
    from public.tournament_events as e
    where e.id = teams.event_id
      and public.can_view_tournament((select auth.uid()), e.tournament_id)
  )
);

create policy team_members_select_visible
on public.team_members
for select
to authenticated
using (
  exists (
    select 1
    from public.teams as t
    join public.tournament_events as e on e.id = t.event_id
    where t.id = team_members.team_id
      and public.can_view_tournament((select auth.uid()), e.tournament_id)
  )
);

create policy tournament_entries_select_visible
on public.tournament_entries
for select
to authenticated
using (
  exists (
    select 1
    from public.tournament_events as e
    where e.id = tournament_entries.event_id
      and public.can_view_tournament((select auth.uid()), e.tournament_id)
  )
);

create policy matches_select_visible
on public.matches
for select
to authenticated
using (
  exists (
    select 1
    from public.tournament_events as e
    where e.id = matches.event_id
      and public.can_view_tournament((select auth.uid()), e.tournament_id)
  )
);

create policy match_games_select_visible
on public.match_games
for select
to authenticated
using (
  exists (
    select 1
    from public.matches as m
    join public.tournament_events as e on e.id = m.event_id
    where m.id = match_games.match_id
      and public.can_view_tournament((select auth.uid()), e.tournament_id)
  )
);

commit;
