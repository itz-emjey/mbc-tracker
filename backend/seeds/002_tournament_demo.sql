-- MBC Arena - development seed: sample players and a ready-to-draw tournament
--
-- Apply after migrations 001-014, policies 001-014, and
-- seeds/001_fictional_players.sql. It is safe to run on its own after those
-- migrations, but the demo tournament is attributed to Ada Demo when her
-- profile exists and simply falls back to NULL otherwise.
--
-- This file refuses to run unless the project is explicitly marked as a
-- development project. Mark it once, as the project owner, in the SQL Editor:
--
--   insert into public.app_settings (key, value)
--   values ('club.environment', '"development"'::jsonb)
--   on conflict (key) do update set value = excluded.value;
--
-- It adds eight unlinked sample players and one published tournament with two
-- events:
--
--   * Singles (single elimination): 8 registered entries, every fee paid.
--   * Mixed doubles (single elimination): 4 registered teams, every fee paid.
--
-- Both draws can be generated immediately from the tournament screen. No
-- player account is created for the samples; they exist only so staff can test
-- entries and draw generation. Every id is fixed and every insert is guarded
-- (`on conflict do nothing`, or a not-exists check where a BEFORE INSERT trigger
-- runs before conflict resolution), so re-running this file adds nothing and
-- never overwrites a change made through the app.

-- ---------------------------------------------------------------------------
-- Guard: only an explicitly-marked development project may be seeded.
-- ---------------------------------------------------------------------------
do $seed_guard$
declare
  v_environment text;
begin
  select s.value #>> '{}'
    into v_environment
    from public.app_settings as s
   where s.key = 'club.environment';

  if v_environment is distinct from 'development' then
    raise exception 'refusing to seed: this project is not marked as development'
      using errcode = '42501',
            hint = 'insert into public.app_settings (key, value) values (''club.environment'', ''"development"''::jsonb) on conflict (key) do update set value = excluded.value;';
  end if;
end
$seed_guard$;

-- ---------------------------------------------------------------------------
-- Eight sample players. They have no profile_id, so they cannot sign in and
-- cannot join events themselves; staff register them for the demo.
-- ---------------------------------------------------------------------------
insert into public.players (id, profile_id, full_name, gender, status, joined_on)
values
  ('5eed3000-0000-4000-8000-000000003001', null, 'Mia Santos', 'female', 'active', date '2026-01-10'),
  ('5eed3000-0000-4000-8000-000000003002', null, 'Noah Reyes', 'male', 'active', date '2026-01-10'),
  ('5eed3000-0000-4000-8000-000000003003', null, 'Liza Cruz', 'female', 'active', date '2026-01-17'),
  ('5eed3000-0000-4000-8000-000000003004', null, 'Paolo Garcia', 'male', 'active', date '2026-01-17'),
  ('5eed3000-0000-4000-8000-000000003005', null, 'Bea Mendoza', 'female', 'active', date '2026-02-01'),
  ('5eed3000-0000-4000-8000-000000003006', null, 'Carlo Lim', 'male', 'active', date '2026-02-01'),
  ('5eed3000-0000-4000-8000-000000003007', null, 'Nena Villanueva', 'female', 'active', date '2026-02-08'),
  ('5eed3000-0000-4000-8000-000000003008', null, 'Rico Dela Cruz', 'male', 'active', date '2026-02-08')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- One published tournament with a per-player fee.
-- ---------------------------------------------------------------------------
insert into public.tournaments (
  id,
  name,
  description,
  venue,
  starts_on,
  ends_on,
  registration_deadline,
  status,
  created_by,
  entrance_fee
)
values (
  '5eed4000-0000-4000-8000-000000000001',
  'Sample Open 2026',
  'Development tournament with paid entries, ready for draw generation.',
  'MBC Courts',
  current_date + 14,
  current_date + 15,
  (current_date + 7 + time '18:00')::timestamptz,
  'published',
  (select p.id from public.profiles as p where p.id = '5eed0000-0000-4000-8000-000000000001'),
  150
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Events: eight singles entries and four mixed doubles teams.
-- ---------------------------------------------------------------------------
insert into public.tournament_events (
  id,
  tournament_id,
  discipline,
  format,
  max_entries
)
values
  (
    '5eed4100-0000-4000-8000-000000000001',
    '5eed4000-0000-4000-8000-000000000001',
    'singles',
    'single_elimination',
    16
  ),
  (
    '5eed4100-0000-4000-8000-000000000002',
    '5eed4000-0000-4000-8000-000000000001',
    'mixed_doubles',
    'single_elimination',
    8
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Singles entries, seeded 1-8.
-- ---------------------------------------------------------------------------
insert into public.tournament_entries (id, event_id, player_id, seed, status)
values
  ('5eed4300-0000-4000-8000-000000000001', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003001', 1, 'registered'),
  ('5eed4300-0000-4000-8000-000000000002', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003002', 2, 'registered'),
  ('5eed4300-0000-4000-8000-000000000003', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003003', 3, 'registered'),
  ('5eed4300-0000-4000-8000-000000000004', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003004', 4, 'registered'),
  ('5eed4300-0000-4000-8000-000000000005', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003005', 5, 'registered'),
  ('5eed4300-0000-4000-8000-000000000006', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003006', 6, 'registered'),
  ('5eed4300-0000-4000-8000-000000000007', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003007', 7, 'registered'),
  ('5eed4300-0000-4000-8000-000000000008', '5eed4100-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003008', 8, 'registered')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Mixed doubles teams: one male and one female per team.
-- ---------------------------------------------------------------------------
insert into public.teams (id, event_id, name)
values
  ('5eed4200-0000-4000-8000-000000000001', '5eed4100-0000-4000-8000-000000000002', 'Santos / Reyes'),
  ('5eed4200-0000-4000-8000-000000000002', '5eed4100-0000-4000-8000-000000000002', 'Cruz / Garcia'),
  ('5eed4200-0000-4000-8000-000000000003', '5eed4100-0000-4000-8000-000000000002', 'Mendoza / Lim'),
  ('5eed4200-0000-4000-8000-000000000004', '5eed4100-0000-4000-8000-000000000002', 'Villanueva / Dela Cruz')
on conflict (id) do nothing;

insert into public.team_members (id, team_id, player_id)
select seed.id::uuid, seed.team_id::uuid, seed.player_id::uuid
  from (values
  ('5eed4500-0000-4000-8000-000000000001', '5eed4200-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003001'),
  ('5eed4500-0000-4000-8000-000000000002', '5eed4200-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003002'),
  ('5eed4500-0000-4000-8000-000000000003', '5eed4200-0000-4000-8000-000000000002', '5eed3000-0000-4000-8000-000000003003'),
  ('5eed4500-0000-4000-8000-000000000004', '5eed4200-0000-4000-8000-000000000002', '5eed3000-0000-4000-8000-000000003004'),
  ('5eed4500-0000-4000-8000-000000000005', '5eed4200-0000-4000-8000-000000000003', '5eed3000-0000-4000-8000-000000003005'),
  ('5eed4500-0000-4000-8000-000000000006', '5eed4200-0000-4000-8000-000000000003', '5eed3000-0000-4000-8000-000000003006'),
  ('5eed4500-0000-4000-8000-000000000007', '5eed4200-0000-4000-8000-000000000004', '5eed3000-0000-4000-8000-000000003007'),
  ('5eed4500-0000-4000-8000-000000000008', '5eed4200-0000-4000-8000-000000000004', '5eed3000-0000-4000-8000-000000003008')
  ) as seed (id, team_id, player_id)
 where not exists (
   select 1 from public.team_members as tm where tm.id = seed.id::uuid
 );

insert into public.tournament_entries (id, event_id, team_id, seed, status)
values
  ('5eed4300-0000-4000-8000-000000000011', '5eed4100-0000-4000-8000-000000000002', '5eed4200-0000-4000-8000-000000000001', 1, 'registered'),
  ('5eed4300-0000-4000-8000-000000000012', '5eed4100-0000-4000-8000-000000000002', '5eed4200-0000-4000-8000-000000000002', 2, 'registered'),
  ('5eed4300-0000-4000-8000-000000000013', '5eed4100-0000-4000-8000-000000000002', '5eed4200-0000-4000-8000-000000000003', 3, 'registered'),
  ('5eed4300-0000-4000-8000-000000000014', '5eed4100-0000-4000-8000-000000000002', '5eed4200-0000-4000-8000-000000000004', 4, 'registered')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Every participant is paid, so both draws include every entry immediately.
-- Change one row to `unpaid` in the app to see the draw exclusion behaviour.
-- ---------------------------------------------------------------------------
insert into public.tournament_entry_payments (
  id,
  entry_id,
  player_id,
  amount,
  status,
  marked_at
)
values
  ('5eed4400-0000-4000-8000-000000000001', '5eed4300-0000-4000-8000-000000000001', '5eed3000-0000-4000-8000-000000003001', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000002', '5eed4300-0000-4000-8000-000000000002', '5eed3000-0000-4000-8000-000000003002', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000003', '5eed4300-0000-4000-8000-000000000003', '5eed3000-0000-4000-8000-000000003003', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000004', '5eed4300-0000-4000-8000-000000000004', '5eed3000-0000-4000-8000-000000003004', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000005', '5eed4300-0000-4000-8000-000000000005', '5eed3000-0000-4000-8000-000000003005', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000006', '5eed4300-0000-4000-8000-000000000006', '5eed3000-0000-4000-8000-000000003006', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000007', '5eed4300-0000-4000-8000-000000000007', '5eed3000-0000-4000-8000-000000003007', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000008', '5eed4300-0000-4000-8000-000000000008', '5eed3000-0000-4000-8000-000000003008', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000011', '5eed4300-0000-4000-8000-000000000011', '5eed3000-0000-4000-8000-000000003001', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000012', '5eed4300-0000-4000-8000-000000000011', '5eed3000-0000-4000-8000-000000003002', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000013', '5eed4300-0000-4000-8000-000000000012', '5eed3000-0000-4000-8000-000000003003', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000014', '5eed4300-0000-4000-8000-000000000012', '5eed3000-0000-4000-8000-000000003004', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000015', '5eed4300-0000-4000-8000-000000000013', '5eed3000-0000-4000-8000-000000003005', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000016', '5eed4300-0000-4000-8000-000000000013', '5eed3000-0000-4000-8000-000000003006', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000017', '5eed4300-0000-4000-8000-000000000014', '5eed3000-0000-4000-8000-000000003007', 150, 'paid', now()),
  ('5eed4400-0000-4000-8000-000000000018', '5eed4300-0000-4000-8000-000000000014', '5eed3000-0000-4000-8000-000000003008', 150, 'paid', now())
on conflict (id) do nothing;
