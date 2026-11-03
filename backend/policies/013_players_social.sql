-- MBC Arena - RLS policies for player IDs, friendships, and notifications
--
-- Apply after backend/migrations/013_players_friends_notifications.sql.
--
-- Friendships are visible only to the two players involved. Notifications are
-- visible only to their recipient. Both tables are SELECT-only for clients:
-- every mutation crosses an RPC.

begin;

revoke all on table public.player_friendships, public.notifications
from anon, authenticated;

grant select on table public.player_friendships, public.notifications
to authenticated;

create policy player_friendships_select_participant
on public.player_friendships
for select
to authenticated
using (
  requester_player_id = public.current_player_id()
  or addressee_player_id = public.current_player_id()
);

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (profile_id = (select auth.uid()));

commit;
