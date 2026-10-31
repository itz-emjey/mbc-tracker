-- MBC Arena - RLS/privilege tightening for the Group G auth lifecycle
--
-- Apply after backend/migrations/003_auth_lifecycle.sql.
--
-- Registration is now an RPC (`submit_registration`). Clients no longer need
-- to insert profiles directly, and removing that path prevents orphan profiles
-- or a profile without a matching registration request.
--
-- SELECT/UPDATE policies from 001_identity.sql remain in force. This file only
-- removes the direct INSERT grant and its policy.

begin;

revoke insert on public.profiles from authenticated;

drop policy if exists profiles_insert_self_pending on public.profiles;

commit;
