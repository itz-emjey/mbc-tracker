/**
 * ShuttlePower calculation engine.
 *
 * The club approved the numeric formula on 2026-11-03 (PLAN.md §7 rules 1, 2,
 * 6, and 11-14; docs/sp-formula-signoff.md decisions F1-F3). The approved
 * values live in the `approved-2026-11` row created by migration 016; this
 * module never hardcodes them. Every call still takes a rule version, and a
 * version that is not both approved *and* enabled is refused, so an unapproved
 * or retired formula can never move a balance. `PROVISIONAL_SP_RULE` mirrors
 * the older `provisional-2026-11` proposal for audit and fallback display only.
 *
 * Pure by design: no React, no Supabase, no Date, and no database cache. Time
 * and stored balances are inputs, so the same inputs always produce the same
 * result and the ledger can be replayed.
 *
 * Approved operation order: clamp the magnitude to the per-match limits, round
 * half-up, then apply the tournament multiplier. Friendly matches use 1x, so
 * only tournament results depend on the order. Tournament matches carry twice
 * the friendly impact, doubles use the team average rating, and stats are
 * strength-based (beating a stronger side gains more, losing to a stronger
 * side costs less).
 */

export type SpRuleStatus = 'provisional' | 'approved' | 'retired'
export type SpRounding = 'round' | 'floor' | 'ceil'

const ROUNDING_POLICIES: readonly SpRounding[] = ['round', 'floor', 'ceil']
export type SpScope = 'friendly' | 'tournament'

/**
 * Calculation inputs. These are deliberately data, not constants, so the club
 * can approve a formula without a code change. Keys mirror the `config` JSON in
 * `sp_rule_versions`.
 */
export interface SpRuleConfig {
  /** Points before the strength curve, at an even matchup. */
  baseChange: number
  /** Points added per point of rating advantage for the winner. */
  strengthSensitivity: number
  minGainPerMatch: number
  maxGainPerMatch: number
  minLossPerMatch: number
  maxLossPerMatch: number
  /** Lowest reachable balance. The approved rule uses 0; `null` allows negatives. */
  floor: number | null
  /** Official tournament impact relative to friendly play (club rule: 2). */
  tournamentMultiplier: number
  rounding: SpRounding
  /** How a team change is split between partners. */
  doublesSplit: 'even'
}

export interface SpRuleVersion {
  version: string
  status: SpRuleStatus
  enabled: boolean
  config: SpRuleConfig
}

/**
 * Historical proposal from 2026-11-01 — **not** the approved club rule. It
 * mirrors the disabled `provisional-2026-11` row in migration 006 and is kept
 * for audit and fallback display. The approved values are the
 * `approved-2026-11` row in migration 016; read them from the database.
 */
export const PROVISIONAL_SP_RULE: SpRuleVersion = {
  version: 'provisional-2026-11',
  status: 'provisional',
  enabled: false,
  config: {
    baseChange: 20,
    strengthSensitivity: 0.04,
    minGainPerMatch: 5,
    maxGainPerMatch: 40,
    minLossPerMatch: 5,
    maxLossPerMatch: 40,
    floor: null,
    tournamentMultiplier: 2,
    rounding: 'round',
    doublesSplit: 'even',
  },
}

/** Wording the UI must show when no approved rule version is enabled. */
export const PROVISIONAL_RULE_NOTICE = 'No approved rule version is enabled. No match awards SP.'

export interface SpSideInput {
  playerIds: readonly string[]
  spByPlayer: Readonly<Record<string, number>>
}

export interface SpMatchInput {
  winner: SpSideInput
  loser: SpSideInput
  scope: SpScope
}

export interface SpDelta {
  playerId: string
  spBefore: number
  /** Always non-zero; a zero split must not be written to the ledger. */
  delta: number
  spAfter: number
}

export interface SpCalculation {
  ruleVersion: string
  scope: SpScope
  multiplier: number
  winnerRating: number
  loserRating: number
  winnerTeamChange: number
  loserTeamChange: number
  winnerDeltas: SpDelta[]
  loserDeltas: SpDelta[]
  /** True when the configured floor shortened at least one loss. */
  floorApplied: boolean
}

export type SpCalculationResult =
  { status: 'calculated'; calculation: SpCalculation } | { status: 'disabled'; reason: string }

function assertSide(side: SpSideInput, label: string): void {
  if (side.playerIds.length === 0) {
    throw new Error(`${label} needs at least one player.`)
  }

  if (new Set(side.playerIds).size !== side.playerIds.length) {
    throw new Error(`${label} repeats a player.`)
  }

  for (const playerId of side.playerIds) {
    const value = side.spByPlayer[playerId]

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`${label} is missing a finite SP value for ${playerId}.`)
    }
  }
}

function assertConfig(config: SpRuleConfig): void {
  const numbers = [
    config.baseChange,
    config.strengthSensitivity,
    config.minGainPerMatch,
    config.maxGainPerMatch,
    config.minLossPerMatch,
    config.maxLossPerMatch,
    config.tournamentMultiplier,
  ]

  if (numbers.some((value) => !Number.isFinite(value))) {
    throw new Error('The rule config needs finite numbers.')
  }

  if (config.strengthSensitivity < 0) {
    throw new Error('The strength sensitivity cannot be negative.')
  }

  if (config.minGainPerMatch > config.maxGainPerMatch) {
    throw new Error('The minimum gain cannot exceed the maximum gain.')
  }

  if (config.minLossPerMatch > config.maxLossPerMatch) {
    throw new Error('The minimum loss cannot exceed the maximum loss.')
  }

  if (config.tournamentMultiplier < 1) {
    throw new Error('The tournament multiplier cannot be below 1.')
  }

  // The approved multiplier is 2. A fractional multiplier would make the
  // rounded team change fractional too, and the ledger only stores whole
  // points, so require a whole number rather than silently rounding again.
  if (!Number.isInteger(config.tournamentMultiplier)) {
    throw new Error('The tournament multiplier must be a whole number.')
  }

  if (config.floor !== null && !Number.isFinite(config.floor)) {
    throw new Error('The floor must be a finite number or null.')
  }

  if (config.minGainPerMatch < 0 || config.minLossPerMatch < 0) {
    throw new Error('A per-match minimum cannot be negative.')
  }

  // The rule row comes from a JSON document the database only checks for being
  // an object, so an unknown enum value is reachable. Validate it here, where
  // the error names the field, rather than letting it surface as a bad split.
  if (!ROUNDING_POLICIES.includes(config.rounding)) {
    throw new Error(`Unknown rounding policy: ${String(config.rounding)}.`)
  }

  if (config.doublesSplit !== 'even') {
    throw new Error(`Unknown doubles split: ${String(config.doublesSplit)}.`)
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function roundMagnitude(value: number, rounding: SpRounding): number {
  switch (rounding) {
    case 'floor':
      return Math.floor(value)
    case 'ceil':
      return Math.ceil(value)
    case 'round':
      return Math.round(value)
    default:
      throw new Error(`Unknown rounding policy: ${String(rounding)}.`)
  }
}

/**
 * Byte-order comparison, not a locale collation: the documented rule gives an
 * odd point to the partner whose player id sorts first, and the database's
 * `ORDER BY player_id` is code-unit order. `localeCompare` depends on the
 * runtime's ICU data and can order mixed-case ids differently, which would hand
 * the extra point to a different partner than the auditor's query does.
 */
function comparePlayerIds(left: string, right: string): number {
  if (left === right) return 0

  return left < right ? -1 : 1
}

/** Average SP of a side — the approved team-strength basis for doubles. */
export function sideRating(side: SpSideInput): number {
  assertSide(side, 'A side')

  const total = side.playerIds.reduce((sum, playerId) => sum + (side.spByPlayer[playerId] ?? 0), 0)

  return total / side.playerIds.length
}

export interface TeamShare {
  playerId: string
  delta: number
}

/**
 * Splits a team change into whole per-player deltas that sum exactly to
 * `total`. Partners receive an equal share; when the change does not divide
 * evenly, the extra point goes to the lowest player id under byte order, so the
 * split is deterministic and matches the database's ordering. Zero shares are
 * dropped: the ledger rejects a zero delta.
 */
export function distributeEqually(playerIds: readonly string[], total: number): TeamShare[] {
  if (playerIds.length === 0) {
    throw new Error('A team change needs at least one player.')
  }

  if (!Number.isInteger(total)) {
    throw new Error('A team change must be a whole number of points.')
  }

  const ids = [...playerIds].sort(comparePlayerIds)
  const sign = total < 0 ? -1 : 1
  const magnitude = Math.abs(total)
  const base = Math.floor(magnitude / ids.length)
  const remainder = magnitude - base * ids.length

  return ids
    .map((playerId, index) => ({
      playerId,
      delta: (base + (index < remainder ? 1 : 0)) * sign,
    }))
    .filter((share) => share.delta !== 0)
}

function applyFloor(
  shares: readonly TeamShare[],
  spByPlayer: Readonly<Record<string, number>>,
  floor: number | null,
): { deltas: SpDelta[]; clamped: boolean } {
  let clamped = false

  const deltas = shares.flatMap((share) => {
    const spBefore = spByPlayer[share.playerId] ?? 0
    let delta = share.delta

    if (floor !== null && spBefore + delta < floor) {
      delta = floor - spBefore
      clamped = true
    }

    if (delta === 0) return []

    return [{ playerId: share.playerId, spBefore, delta, spAfter: spBefore + delta }]
  })

  return { deltas, clamped }
}

/**
 * Calculates one match's SP change from a rule version.
 *
 * Returns `disabled` unless the rule is approved and enabled, so a provisional
 * formula can never move a balance — the standing policy for unapproved rules.
 */
export function calculateSpChange(rule: SpRuleVersion, input: SpMatchInput): SpCalculationResult {
  if (rule.status === 'retired') {
    return {
      status: 'disabled',
      reason: `Rule version ${rule.version} is retired and cannot award SP.`,
    }
  }

  if (rule.status !== 'approved') {
    return {
      status: 'disabled',
      reason: `Rule version ${rule.version} is ${rule.status}; SP awards stay disabled until the club approves the formula.`,
    }
  }

  if (!rule.enabled) {
    return {
      status: 'disabled',
      reason: `Rule version ${rule.version} is approved but not enabled.`,
    }
  }

  assertConfig(rule.config)

  const winnerRating = sideRating(input.winner)
  const loserRating = sideRating(input.loser)
  const advantage = loserRating - winnerRating
  const multiplier = input.scope === 'tournament' ? rule.config.tournamentMultiplier : 1

  // Approved order: clamp the normal magnitude, round half-up, then apply the
  // multiplier. A friendly uses 1x; an official tournament uses 2x, so a
  // tournament change is exactly twice the rounded friendly change.
  //
  // No implicit floor of 1: the configured minimum governs, and a result that
  // rounds to 0 produces no share and therefore no ledger row (`sp_delta <> 0`
  // forbids a zero row). With the approved minimum of 5 this changes nothing.
  const gain =
    roundMagnitude(
      clamp(
        rule.config.baseChange + rule.config.strengthSensitivity * advantage,
        rule.config.minGainPerMatch,
        rule.config.maxGainPerMatch,
      ),
      rule.config.rounding,
    ) * multiplier

  // Losing costs more to a weaker opponent and less to a stronger one, which is
  // the same curve read from the loser's side of the same rating gap.
  const loss =
    roundMagnitude(
      clamp(
        rule.config.baseChange + rule.config.strengthSensitivity * advantage,
        rule.config.minLossPerMatch,
        rule.config.maxLossPerMatch,
      ),
      rule.config.rounding,
    ) * multiplier

  const winner = applyFloor(
    distributeEqually(input.winner.playerIds, gain),
    input.winner.spByPlayer,
    rule.config.floor,
  )

  const loser = applyFloor(
    distributeEqually(input.loser.playerIds, -loss),
    input.loser.spByPlayer,
    rule.config.floor,
  )

  return {
    status: 'calculated',
    calculation: {
      ruleVersion: rule.version,
      scope: input.scope,
      multiplier,
      winnerRating,
      loserRating,
      winnerTeamChange: winner.deltas.reduce((sum, delta) => sum + delta.delta, 0),
      loserTeamChange: loser.deltas.reduce((sum, delta) => sum + delta.delta, 0),
      winnerDeltas: winner.deltas,
      loserDeltas: loser.deltas,
      floorApplied: winner.clamped || loser.clamped,
    },
  }
}
