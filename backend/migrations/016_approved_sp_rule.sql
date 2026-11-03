-- MBC Arena - Migration 016: approved ShuttlePower rule version
--
-- The club owner approved the §7.1 formula on 2026-11-03. This migration
-- records that approval as a new rule version and enables it, which is the
-- deliberate step that lets a finalized friendly award SP. The applied
-- `provisional-2026-11` row is never edited, so every past calculation stays
-- auditable against the version that produced it.
--
-- Approved parameters (PLAN.md §7 rules 1, 2, 6, and 11-14;
-- docs/sp-formula-signoff.md decisions F1-F3):
--   * base change 20, strength sensitivity 0.02 (1 point per 50 SP of gap)
--   * per-match clamp 5-40 on the magnitude, applied before the multiplier
--   * half-up rounding before the multiplier (friendly 1x, tournament 2x)
--   * floor 0 (SP cannot go negative), no ceiling key
--   * doubles split evenly, odd point to the lower player id
--
-- Decision F4 (corrected and invalidated results) is still open and is not
-- authorised by this migration. Walkovers, forfeits, withdrawals, and
-- disqualifications still have no SP rule.
--
-- Apply after 015_payment_receipts.sql. This migration is intentionally not
-- idempotent.

begin;

insert into public.sp_rule_versions (
  version,
  status,
  config,
  is_enabled,
  effective_from,
  notes
)
values (
  'approved-2026-11',
  'approved',
  '{
    "baseChange": 20,
    "strengthSensitivity": 0.02,
    "minGainPerMatch": 5,
    "maxGainPerMatch": 40,
    "minLossPerMatch": 5,
    "maxLossPerMatch": 40,
    "floor": 0,
    "tournamentMultiplier": 2,
    "rounding": "round",
    "doublesSplit": "even"
  }'::jsonb,
  true,
  timestamptz '2026-11-03 00:00:00+08',
  'Approved by the club owner on 2026-11-03 (PLAN.md §7 rules 1, 2, 6, and 11-14; docs/sp-formula-signoff.md F1-F3). Base 20, sensitivity 0.02, clamp 5-40, floor 0, no ceiling, tournament x2, half-up rounding before the multiplier, even doubles split with the odd point to the lower player id. F4 (corrected and invalidated results) remains open.'
);

commit;
