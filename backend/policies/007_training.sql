-- MBC Arena - RLS policies for training and payments
--
-- Apply after backend/migrations/007_training.sql.
--
-- Reads: every active club member sees the session schedule and the club-wide
-- fee periods (they need to know what is owed). Attendance and payment rows are
-- visible to training staff and to the player they belong to.
--
-- Writes: none. There is no INSERT/UPDATE/DELETE grant on any of these tables;
-- sessions, attendance, fee periods, payments, and voids cross the audited
-- RPCs in migration 007.

begin;

revoke all on table
  public.training_sessions,
  public.training_attendance,
  public.training_fee_periods,
  public.training_payments
from anon, authenticated;

grant select on table
  public.training_sessions,
  public.training_attendance,
  public.training_fee_periods,
  public.training_payments
to authenticated;

create policy training_sessions_select_club_members
on public.training_sessions
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

create policy training_attendance_select_staff_or_own
on public.training_attendance
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or player_id in (
    select p.id
    from public.players as p
    where p.profile_id = (select auth.uid())
  )
);

create policy training_fee_periods_select_club_members
on public.training_fee_periods
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'tournament_manager')
  or public.has_role((select auth.uid()), 'trainer')
  or public.has_role((select auth.uid()), 'player')
);

create policy training_payments_select_staff_or_own
on public.training_payments
for select
to authenticated
using (
  public.has_role((select auth.uid()), 'super_admin')
  or public.has_role((select auth.uid()), 'trainer')
  or player_id in (
    select p.id
    from public.players as p
    where p.profile_id = (select auth.uid())
  )
);

commit;
