-- MBC Arena — RLS policies for placement and the published SP read path (migration 019)
--
-- Apply after backend/migrations/019_placement_and_unplayed_sp.sql.
--
-- D17 moves every client SP read onto the published views:
--
--   * `sp_accounts` and `sp_transactions` are no longer directly readable by a
--     client. The previous SELECT grants and policies (policies/003) are
--     superseded here; a provisional balance is visible only through the
--     Super Admin audit view.
--   * `published_sp_balances`, `published_sp_leaderboard`, and
--     `published_sp_transactions` expose Rated players only.
--   * `placement_progress` exposes progress (credits/required), never the
--     provisional SP value.
--   * `placement_audit` is Super Admin only.
--   * `placement_credits` and `placement_qualifications` stay closed to clients;
--     they are written and read by privileged RPCs and views.

begin;

revoke all on table public.sp_accounts, public.sp_transactions from anon, authenticated;
revoke all on table public.placement_credits, public.placement_qualifications
  from anon, authenticated;

-- Supersede the direct-read policies from policies/003.
drop policy if exists sp_accounts_select_club_members on public.sp_accounts;
drop policy if exists sp_transactions_select_own_or_super_admin on public.sp_transactions;

revoke all on table
  public.published_sp_balances,
  public.published_sp_leaderboard,
  public.published_sp_transactions,
  public.placement_progress,
  public.placement_audit
  from anon;

grant select on table
  public.published_sp_balances,
  public.published_sp_leaderboard,
  public.published_sp_transactions,
  public.placement_progress,
  public.placement_audit
  to authenticated;

commit;
