import { describe, expect, it } from 'vitest'

import {
  calculateSpChange,
  distributeEqually,
  PROVISIONAL_RULE_NOTICE,
  PROVISIONAL_SP_RULE,
  sideRating,
  type SpMatchInput,
  type SpRuleConfig,
  type SpRuleVersion,
  type SpRounding,
  type SpSideInput,
} from './sp'

/**
 * Synthetic config, independent of the approved club values, so these tests
 * assert direction, caps, determinism, and ledger-shaped invariants without
 * locking in a club number.
 */
const CONFIG: SpRuleConfig = {
  baseChange: 10,
  strengthSensitivity: 0.01,
  minGainPerMatch: 2,
  maxGainPerMatch: 16,
  minLossPerMatch: 2,
  maxLossPerMatch: 16,
  floor: null,
  tournamentMultiplier: 2,
  rounding: 'round',
  doublesSplit: 'even',
}

function approvedRule(overrides: Partial<SpRuleConfig> = {}): SpRuleVersion {
  return {
    version: 'test-rule',
    status: 'approved',
    enabled: true,
    config: { ...CONFIG, ...overrides },
  }
}

function singles(playerId: string, sp: number): SpSideInput {
  return { playerIds: [playerId], spByPlayer: { [playerId]: sp } }
}

function match(winner: SpSideInput, loser: SpSideInput): SpMatchInput {
  return { winner, loser, scope: 'friendly' }
}

describe('calculateSpChange', () => {
  it('awards more for beating a stronger opponent than a weaker one', () => {
    const stronger = calculateSpChange(
      approvedRule(),
      match(singles('w', 1000), singles('l', 1500)),
    )
    const weaker = calculateSpChange(approvedRule(), match(singles('w', 1000), singles('l', 1000)))
    const muchWeaker = calculateSpChange(
      approvedRule(),
      match(singles('w', 1000), singles('l', 600)),
    )

    expect(stronger.status).toBe('calculated')
    expect(weaker.status).toBe('calculated')
    expect(muchWeaker.status).toBe('calculated')

    if (
      stronger.status !== 'calculated' ||
      weaker.status !== 'calculated' ||
      muchWeaker.status !== 'calculated'
    ) {
      throw new Error('expected calculated results')
    }

    expect(stronger.calculation.winnerTeamChange).toBeGreaterThan(
      weaker.calculation.winnerTeamChange,
    )
    expect(weaker.calculation.winnerTeamChange).toBeGreaterThan(
      muchWeaker.calculation.winnerTeamChange,
    )
  })

  it('costs less to lose to a stronger opponent than to a weaker one', () => {
    const toStronger = calculateSpChange(
      approvedRule(),
      match(singles('w', 1500), singles('l', 1000)),
    )
    const toWeaker = calculateSpChange(
      approvedRule(),
      match(singles('w', 1000), singles('l', 1000)),
    )

    if (toStronger.status !== 'calculated' || toWeaker.status !== 'calculated') {
      throw new Error('expected calculated results')
    }

    expect(Math.abs(toStronger.calculation.loserTeamChange)).toBeLessThan(
      Math.abs(toWeaker.calculation.loserTeamChange),
    )
  })

  it('applies the tournament multiplier to both the win and the loss', () => {
    const friendly = calculateSpChange(approvedRule(), {
      winner: singles('w', 1000),
      loser: singles('l', 1200),
      scope: 'friendly',
    })
    const tournament = calculateSpChange(approvedRule(), {
      winner: singles('w', 1000),
      loser: singles('l', 1200),
      scope: 'tournament',
    })

    if (friendly.status !== 'calculated' || tournament.status !== 'calculated') {
      throw new Error('expected calculated results')
    }

    expect(tournament.calculation.multiplier).toBe(2)
    expect(tournament.calculation.winnerTeamChange).toBe(friendly.calculation.winnerTeamChange * 2)
    expect(tournament.calculation.loserTeamChange).toBe(friendly.calculation.loserTeamChange * 2)
  })

  it('bounds a match change with the configured caps', () => {
    const capped = calculateSpChange(
      approvedRule({ maxGainPerMatch: 12, maxLossPerMatch: 12 }),
      match(singles('w', 0), singles('l', 5000)),
    )

    if (capped.status !== 'calculated') throw new Error('expected a calculated result')

    expect(capped.calculation.winnerTeamChange).toBeLessThanOrEqual(12)
    expect(Math.abs(capped.calculation.loserTeamChange)).toBeLessThanOrEqual(12)
  })

  it('uses the team average rating for doubles strength', () => {
    const doubles = calculateSpChange(approvedRule(), {
      winner: { playerIds: ['a', 'b'], spByPlayer: { a: 1000, b: 2000 } },
      loser: { playerIds: ['c', 'd'], spByPlayer: { c: 1400, d: 1600 } },
      scope: 'friendly',
    })
    const evenSingles = calculateSpChange(approvedRule(), {
      winner: { playerIds: ['w'], spByPlayer: { w: 1500 } },
      loser: { playerIds: ['l'], spByPlayer: { l: 1500 } },
      scope: 'friendly',
    })

    if (doubles.status !== 'calculated' || evenSingles.status !== 'calculated') {
      throw new Error('expected calculated results')
    }

    expect(doubles.calculation.winnerRating).toBe(1500)
    expect(doubles.calculation.loserRating).toBe(1500)
    expect(doubles.calculation.winnerTeamChange).toBe(evenSingles.calculation.winnerTeamChange)
  })

  it('splits a doubles change into whole deltas that sum to the team change', () => {
    const result = calculateSpChange(approvedRule({ baseChange: 11, strengthSensitivity: 0 }), {
      winner: { playerIds: ['p2', 'p1'], spByPlayer: { p1: 1000, p2: 1000 } },
      loser: { playerIds: ['q1', 'q2'], spByPlayer: { q1: 1000, q2: 1000 } },
      scope: 'friendly',
    })

    if (result.status !== 'calculated') throw new Error('expected a calculated result')

    const { winnerDeltas, loserDeltas, winnerTeamChange, loserTeamChange } = result.calculation

    expect(winnerDeltas).toHaveLength(2)
    expect(winnerDeltas.every((delta) => Number.isInteger(delta.delta))).toBe(true)
    expect(winnerDeltas.reduce((sum, delta) => sum + delta.delta, 0)).toBe(winnerTeamChange)
    expect(loserDeltas.reduce((sum, delta) => sum + delta.delta, 0)).toBe(loserTeamChange)
    expect(winnerTeamChange).toBe(11)
    expect(winnerDeltas.every((delta) => delta.delta > 0)).toBe(true)
    expect(loserDeltas.every((delta) => delta.delta < 0)).toBe(true)
  })

  it('reports each player’s stored balance around the change', () => {
    const result = calculateSpChange(approvedRule(), match(singles('w', 1000), singles('l', 1000)))

    if (result.status !== 'calculated') throw new Error('expected a calculated result')

    const win = result.calculation.winnerDeltas[0]!
    const loss = result.calculation.loserDeltas[0]!

    expect(win.spBefore).toBe(1000)
    expect(win.spAfter).toBe(1000 + win.delta)
    expect(loss.spBefore).toBe(1000)
    expect(loss.spAfter).toBe(1000 + loss.delta)
  })

  it('is deterministic for identical inputs', () => {
    const first = calculateSpChange(approvedRule(), match(singles('w', 1200), singles('l', 900)))
    const second = calculateSpChange(approvedRule(), match(singles('w', 1200), singles('l', 900)))

    expect(first).toEqual(second)
  })

  it('refuses a provisional rule even when someone enables it', () => {
    const result = calculateSpChange(PROVISIONAL_SP_RULE, {
      winner: singles('w', 1000),
      loser: singles('l', 1000),
      scope: 'friendly',
    })

    expect(PROVISIONAL_SP_RULE.status).toBe('provisional')
    expect(PROVISIONAL_SP_RULE.enabled).toBe(false)
    expect(PROVISIONAL_RULE_NOTICE).toMatch(/no match awards SP/i)
    expect(result.status).toBe('disabled')

    if (result.status === 'disabled') {
      expect(result.reason).toMatch(/approve/i)
    }
  })

  it('refuses an approved rule that is not enabled', () => {
    const result = calculateSpChange(
      { ...approvedRule(), enabled: false },
      match(singles('w', 1000), singles('l', 1000)),
    )

    expect(result.status).toBe('disabled')
  })

  it('refuses a retired rule', () => {
    const result = calculateSpChange(
      { ...approvedRule(), status: 'retired' },
      match(singles('w', 1000), singles('l', 1000)),
    )

    expect(result.status).toBe('disabled')
  })

  it('keeps a losing balance above the floor when one is configured', () => {
    const result = calculateSpChange(approvedRule({ floor: 950 }), {
      winner: singles('w', 1200),
      loser: singles('l', 955),
      scope: 'friendly',
    })

    if (result.status !== 'calculated') throw new Error('expected a calculated result')

    const loss = result.calculation.loserDeltas[0]!

    expect(result.calculation.floorApplied).toBe(true)
    expect(loss.spAfter).toBe(950)
    expect(loss.delta).toBe(-5)
  })

  it('has no lower bound while that rule is open (floor: null)', () => {
    const result = calculateSpChange(approvedRule({ floor: null }), {
      winner: singles('w', 1200),
      loser: singles('l', 1),
      scope: 'friendly',
    })

    if (result.status !== 'calculated') throw new Error('expected a calculated result')

    const loss = result.calculation.loserDeltas[0]!

    expect(result.calculation.floorApplied).toBe(false)
    expect(loss.spAfter).toBeLessThan(0)
  })

  it('rejects an incomplete side or a repeated player', () => {
    expect(() => sideRating({ playerIds: [], spByPlayer: {} })).toThrow(/at least one player/i)
    expect(() => sideRating({ playerIds: ['a', 'a'], spByPlayer: { a: 1000 } })).toThrow(
      /repeats a player/i,
    )
    expect(() => sideRating({ playerIds: ['a'], spByPlayer: {} })).toThrow(/missing a finite SP/i)
  })

  it('rejects a config whose caps are inverted', () => {
    expect(() =>
      calculateSpChange(
        approvedRule({ minGainPerMatch: 20, maxGainPerMatch: 10 }),
        match(singles('w', 1000), singles('l', 1000)),
      ),
    ).toThrow(/minimum gain/i)
  })

  it('rejects an unknown rounding policy by name, not as a bad split', () => {
    expect(() =>
      calculateSpChange(
        approvedRule({ rounding: 'bankers' as unknown as SpRounding }),
        match(singles('w', 1000), singles('l', 1000)),
      ),
    ).toThrow(/unknown rounding policy/i)
  })

  it('rejects an unknown doubles split by name', () => {
    const config = { ...CONFIG, doublesSplit: 'weighted' } as unknown as SpRuleConfig

    expect(() =>
      calculateSpChange(
        { version: 'test-rule', status: 'approved', enabled: true, config },
        match(singles('w', 1000), singles('l', 1000)),
      ),
    ).toThrow(/unknown doubles split/i)
  })

  it('lets a configured minimum of zero govern instead of an implicit floor of one', () => {
    const result = calculateSpChange(
      approvedRule({
        baseChange: 0,
        strengthSensitivity: 0,
        minGainPerMatch: 0,
        minLossPerMatch: 0,
      }),
      match(singles('w', 1000), singles('l', 1000)),
    )

    if (result.status !== 'calculated') throw new Error('expected a calculated result')

    // A zero change is not a ledger row (sp_delta <> 0), so both sides are empty.
    expect(result.calculation.winnerDeltas).toEqual([])
    expect(result.calculation.loserDeltas).toEqual([])
    expect(result.calculation.winnerTeamChange).toBe(0)
    expect(result.calculation.loserTeamChange).toBe(0)
  })

  it('rounds half-up before applying the tournament multiplier', () => {
    const rule = approvedRule({
      baseChange: 20,
      strengthSensitivity: 0.02,
      minGainPerMatch: 5,
      maxGainPerMatch: 40,
      minLossPerMatch: 5,
      maxLossPerMatch: 40,
    })
    const friendly = calculateSpChange(rule, {
      winner: singles('w', 1000),
      loser: singles('l', 1025),
      scope: 'friendly',
    })
    const tournament = calculateSpChange(rule, {
      winner: singles('w', 1000),
      loser: singles('l', 1025),
      scope: 'tournament',
    })

    if (friendly.status !== 'calculated' || tournament.status !== 'calculated') {
      throw new Error('expected calculated results')
    }

    // Raw 20.5 rounds to 21 first; doubling gives 42. Multiplying first would
    // give round(41) = 41, so this pins the approved operation order.
    expect(friendly.calculation.winnerTeamChange).toBe(21)
    expect(tournament.calculation.winnerTeamChange).toBe(42)
    expect(tournament.calculation.loserTeamChange).toBe(-42)
  })
})

describe('distributeEqually', () => {
  it('gives the extra point to the lowest player id so the split is repeatable', () => {
    expect(distributeEqually(['c', 'a', 'b'], 10)).toEqual([
      { playerId: 'a', delta: 4 },
      { playerId: 'b', delta: 3 },
      { playerId: 'c', delta: 3 },
    ])
    expect(distributeEqually(['c', 'a', 'b'], 10)).toEqual(distributeEqually(['a', 'b', 'c'], 10))
  })

  it('splits a loss with the same deterministic remainder', () => {
    expect(distributeEqually(['x', 'y'], -9)).toEqual([
      { playerId: 'x', delta: -5 },
      { playerId: 'y', delta: -4 },
    ])
  })

  it('drops zero shares and hands a single player the whole change', () => {
    expect(distributeEqually(['a', 'b'], 1)).toEqual([{ playerId: 'a', delta: 1 }])
    expect(distributeEqually(['a'], -12)).toEqual([{ playerId: 'a', delta: -12 }])
  })

  it('orders ids by code unit, not by locale collation', () => {
    // 'B' (U+0042) precedes 'a' (U+0061) in code-unit order, while
    // localeCompare would put 'a' first. The odd point follows the id, so a
    // collation-dependent sort would hand it to the other partner than the
    // database's `ORDER BY player_id` does.
    expect(distributeEqually(['a', 'B'], 3)).toEqual([
      { playerId: 'B', delta: 2 },
      { playerId: 'a', delta: 1 },
    ])
    expect(distributeEqually(['B', 'a'], 3)).toEqual(distributeEqually(['a', 'B'], 3))
  })
})
