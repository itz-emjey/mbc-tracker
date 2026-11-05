-- MBC Arena - RLS policies for friendly doubles (D20)
--
-- Apply after backend/migrations/020_friendly_doubles.sql.
--
-- Reads:
--   * every player in the match can read it, including both doubles partners;
--   * a Super Admin can read every match, so disputes are visible to the club
--     without inventing a resolution process (§7 rule 8 is still open);
--   * no other member sees anyone else's friendly matches.
--
-- Writes: none. There is no INSERT/UPDATE/DELETE grant on the table; every
-- transition crosses an audited RPC in migrations 010 and 020.

begin;

revoke all on table public.friendly_matches from anon, authenticated;

grant select on table public.friendly_matches to authenticated;

drop policy if exists friendly_matches_select_participant_or_admin
  on public.friendly_matches;

create policy friendly_matches_select_participant_or_admin
on public.friendly_matches
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or challenger_id in (
    select p.id from public.players as p
     where p.profile_id = (select auth.uid())
  )
  or opponent_id in (
    select p.id from public.players as p
     where p.profile_id = (select auth.uid())
  )
  or challenger_partner_id in (
    select p.id from public.players as p
     where p.profile_id = (select auth.uid())
  )
  or opponent_partner_id in (
    select p.id from public.players as p
     where p.profile_id = (select auth.uid())
  )
);

commit;
