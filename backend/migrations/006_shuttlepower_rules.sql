-- MBC Arena - Migration 006: ShuttlePower rule versions and reconciliation (Phase 4)
--
-- Phase 4 scaffolding. The club has not approved the numeric SP formula
-- (PLAN.md §7 rules 1, 2, 5, and 6), so this migration adds configuration, not
-- a live rule:
--   * sp_rule_versions stores every proposed/approved calculation config as a
--     versioned JSON document. Exactly one version may be enabled, and a CHECK
--     constraint makes an unapproved version impossible to enable. The single
--     seeded version is provisional and disabled, so no match can award SP
--     until the club approves a formula and someone deliberately enables it.
--   * reconcile_sp_balances() proves the cached sp_accounts balance still
--     equals the ledger sum. It reports mismatches and never repairs silently.
--
-- Deliberately absent: any RPC that awards SP. Awarding needs the approved
-- formula, an idempotency key per match, and the match workflow; that lands
-- with the phase that owns each match source, not here.
--
-- Apply after 005_tournaments.sql, before backend/policies/006_shuttlepower_rules.sql.
-- This migration is intentionally not idempotent.

begin;

-- ---------------------------------------------------------------------------
-- sp_rule_versions: club-owned, versioned SP calculation settings
-- ---------------------------------------------------------------------------
create table public.sp_rule_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  status text not null default 'provisional',
  config jsonb not null,
  is_enabled boolean not null default false,
  effective_from timestamptz,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sp_rule_versions_version_unique unique (version),
  constraint sp_rule_versions_version_check
    check (
      version = btrim(version)
      and char_length(version) between 1 and 50
    ),
  constraint sp_rule_versions_status_check
    check (status in ('provisional', 'approved', 'retired')),
  constraint sp_rule_versions_config_check
    check (jsonb_typeof(config) = 'object'),
  constraint sp_rule_versions_notes_check
    check (notes is null or char_length(notes) <= 2000),
  -- An unapproved formula can never be live. Enabling an approved version is a
  -- deliberate, reviewed act, never a client request.
  constraint sp_rule_versions_enabled_check
    check (not is_enabled or status = 'approved')
);

comment on table public.sp_rule_versions is
  'Versioned SP calculation settings. Clients read only; one approved version may be enabled at a time.';
comment on column public.sp_rule_versions.config is
  'Calculation inputs (base change, strength curve, per-match caps, floor, tournament multiplier, rounding, doubles split). Keys mirror frontend/src/domain/sp.ts.';
comment on column public.sp_rule_versions.is_enabled is
  'When true the engine is allowed to calculate awards. Only an approved version may be enabled.';

-- At most one enabled version. A partial unique index on a constant expression
-- is the smallest way to express "one row with is_enabled".
create unique index sp_rule_versions_one_enabled_key
  on public.sp_rule_versions ((true))
  where is_enabled;

create index sp_rule_versions_status_idx
  on public.sp_rule_versions (status, created_at desc);

create trigger sp_rule_versions_set_updated_at
  before update on public.sp_rule_versions
  for each row execute function public.set_updated_at();

-- The proposed defaults for club review. Every number below is a proposal, not
-- a club rule, and the row is disabled: PLAN.md §7 requires the affected
-- workflow to ship disabled until the formula is approved. `floor` is null
-- because whether SP may fall below zero (rule 2) is still open.
insert into public.sp_rule_versions (version, status, config, is_enabled, notes)
values (
  'provisional-2026-11',
  'provisional',
  '{
    "baseChange": 20,
    "strengthSensitivity": 0.04,
    "minGainPerMatch": 5,
    "maxGainPerMatch": 40,
    "minLossPerMatch": 5,
    "maxLossPerMatch": 40,
    "floor": null,
    "tournamentMultiplier": 2,
    "rounding": "round",
    "doublesSplit": "even"
  }'::jsonb,
  false,
  'Proposed defaults awaiting club approval of PLAN.md §7 rules 1, 2, 5, and 6. Disabled: no match awards SP until an approved version is enabled.'
);

-- ---------------------------------------------------------------------------
-- reconcile_sp_balances(): cached balances must equal the immutable ledger
-- ---------------------------------------------------------------------------
create function public.reconcile_sp_balances()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_accounts integer;
  v_mismatches jsonb;
begin
  perform public.require_super_admin();

  with ledger as (
    select
      a.player_id,
      a.current_sp,
      coalesce(sum(t.sp_delta), 0)::bigint as ledger_sp
    from public.sp_accounts as a
    left join public.sp_transactions as t on t.player_id = a.player_id
    group by a.player_id, a.current_sp
  )
  select
    (select count(*) from public.sp_accounts),
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'player_id', player_id,
          'cached_sp', current_sp,
          'ledger_sp', ledger_sp
        )
        order by player_id
      ) filter (where current_sp <> ledger_sp),
      '[]'::jsonb
    )
  into v_accounts, v_mismatches
  from ledger;

  return jsonb_build_object(
    'checked', v_accounts,
    'mismatches', v_mismatches,
    'consistent', jsonb_array_length(v_mismatches) = 0
  );
end;
$function$;

comment on function public.reconcile_sp_balances() is
  'Super Admin only. Reports every cached SP balance that differs from its ledger sum; it never writes a correction.';

revoke all on function public.reconcile_sp_balances() from public;
grant execute on function public.reconcile_sp_balances() to authenticated, service_role;

alter table public.sp_rule_versions enable row level security;

commit;
