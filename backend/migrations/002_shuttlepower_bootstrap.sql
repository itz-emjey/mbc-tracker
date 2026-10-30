-- MBC Arena — Migration 002: Phase 1 ShuttlePower bootstrap
--
-- Phase 1 requires a player to start with exactly 1,000 SP once (Group G6),
-- and Group F6 requires that `sp_accounts` cannot be written by players.
-- That needs the account cache and the append-only ledger to exist now.
--
-- This is intentionally NOT the Phase 4 SP engine: it contains no formula,
-- rule configuration, seasons, or match references. Phase 4 extends this
-- schema through new migrations. The ledger is the source of truth; the
-- account row is a cache that must be reconcilable against it.
--
-- Apply after 001_identity.sql, before backend/policies/003_shuttlepower.sql.

begin;

create table public.sp_accounts (
  player_id uuid primary key references public.players (id) on delete cascade,
  current_sp integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.sp_accounts is
  'Cached SP balance per player. Maintained only by privileged RPCs; the ledger is authoritative.';

create trigger sp_accounts_set_updated_at
  before update on public.sp_accounts
  for each row execute function public.set_updated_at();

create table public.sp_transactions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete restrict,
  transaction_type text not null,
  sp_before integer not null,
  sp_delta integer not null,
  sp_after integer not null,
  reference_type text,
  reference_id uuid,
  rule_version text,
  idempotency_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sp_transactions_type_check
    check (
      transaction_type in (
        'initial',
        'friendly',
        'tournament',
        'season_deduction',
        'correction',
        'reversal'
      )
    ),
  constraint sp_transactions_balance_check
    check (sp_before + sp_delta = sp_after),
  constraint sp_transactions_delta_check
    check (sp_delta <> 0),
  constraint sp_transactions_reference_type_check
    check (
      reference_type is null
      or reference_type in ('registration', 'match', 'season', 'correction')
    ),
  constraint sp_transactions_rule_version_check
    check (rule_version is null or char_length(btrim(rule_version)) between 1 and 50),
  constraint sp_transactions_idempotency_key_check
    check (
      idempotency_key = btrim(idempotency_key)
      and char_length(idempotency_key) between 1 and 200
    ),
  constraint sp_transactions_metadata_check
    check (jsonb_typeof(metadata) = 'object'),
  constraint sp_transactions_idempotency_key_unique unique (idempotency_key)
);

comment on table public.sp_transactions is
  'Append-only SP ledger. Clients have no write privileges; corrections add new rows.';

create index sp_transactions_player_id_idx
  on public.sp_transactions (player_id, created_at desc);

create index sp_transactions_reference_idx
  on public.sp_transactions (reference_type, reference_id);

create index sp_transactions_created_by_idx
  on public.sp_transactions (created_by);

create function public.prevent_sp_transaction_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  raise exception 'sp_transactions is append-only';
end;
$function$;

revoke all on function public.prevent_sp_transaction_mutation() from public;

create trigger sp_transactions_no_update_or_delete
  before update or delete on public.sp_transactions
  for each row execute function public.prevent_sp_transaction_mutation();

create trigger sp_transactions_no_truncate
  before truncate on public.sp_transactions
  for each statement execute function public.prevent_sp_transaction_mutation();

alter table public.sp_accounts enable row level security;
alter table public.sp_transactions enable row level security;

commit;
