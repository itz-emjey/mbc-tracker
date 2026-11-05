import { describe, expect, it } from 'vitest'

import {
  ARENA_TIERS,
  arenaMatches,
  arenaRecord,
  daysBetween,
  rivalsNear,
  tierFor,
  type ArenaMatchLike,
} from './arena'

const NOW = Date.parse('2026-11-02T08:00:00Z')

describe('tierFor', () => {
  it('places the starting balance in Rally at zero progress', () => {
    const progress = tierFor(1000)

    expect(progress.tier.id).toBe('rally')
    expect(progress.tier.rankTitle).toBe('Challenger')
    expect(progress.progress).toBe(0)
    expect(progress.spToNext).toBe(150)
    expect(progress.tierSpan).toBe(150)
  })

  it('measures progress inside a band', () => {
    const progress = tierFor(1100)

    expect(progress.tier.id).toBe('rally')
    expect(progress.spIntoTier).toBe(100)
    expect(progress.progress).toBeCloseTo(2 / 3)
    expect(progress.next?.id).toBe('smash')
  })

  it('caps the top division at full progress', () => {
    const progress = tierFor(1500)

    expect(progress.tier.id).toBe('legend')
    expect(progress.next).toBeNull()
    expect(progress.progress).toBe(1)
    expect(progress.spToNext).toBeNull()
  })

  it('treats a negative balance as the bottom of the lowest division', () => {
    const progress = tierFor(-80)

    expect(progress.tier.id).toBe('feather')
    expect(progress.tier.rankTitle).toBe('Rookie')
    expect(progress.progress).toBe(0)
    expect(progress.spToNext).toBe(1000)
  })
})

describe('rank titles', () => {
  it('gives every division a unique player-facing title', () => {
    const titles = ARENA_TIERS.map((tier) => tier.rankTitle)

    expect(titles).toEqual(['Rookie', 'Challenger', 'Striker', 'Elite', 'Champion'])
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('resolves the title together with the division', () => {
    expect(tierFor(1450).tier.rankTitle).toBe('Champion')
    expect(tierFor(1300).tier.rankTitle).toBe('Elite')
    expect(tierFor(1150).tier.rankTitle).toBe('Striker')
  })
})

describe('arenaRecord', () => {
  const player = 'p1'

  it('counts only settled results involving the player, newest first', () => {
    const record = arenaRecord(
      [
        match({
          id: 'a',
          status: 'confirmed',
          winner_id: 'p1',
          confirmed_at: '2026-11-01T10:00:00Z',
        }),
        match({
          id: 'b',
          status: 'confirmed',
          winner_id: 'p2',
          confirmed_at: '2026-10-30T10:00:00Z',
        }),
        match({
          id: 'c',
          status: 'auto_approved',
          winner_id: 'p1',
          confirmed_at: '2026-10-28T10:00:00Z',
        }),
        match({ id: 'open', status: 'accepted', winner_id: null }),
        match({
          id: 'other',
          status: 'confirmed',
          winner_id: 'p2',
          challenger_id: 'p3',
          opponent_id: 'p4',
        }),
      ],
      player,
    )

    expect(record.played).toBe(3)
    expect(record.wins).toBe(2)
    expect(record.losses).toBe(1)
    expect(record.winRate).toBeCloseTo(2 / 3)
    expect(record.form).toEqual(['win', 'loss', 'win'])
    expect(record.streak).toEqual({ kind: 'win', length: 1 })
  })

  it('counts a run of identical results as the streak', () => {
    const record = arenaRecord(
      [
        match({
          id: 'a',
          status: 'confirmed',
          winner_id: 'p1',
          confirmed_at: '2026-11-01T10:00:00Z',
        }),
        match({
          id: 'b',
          status: 'confirmed',
          winner_id: 'p1',
          confirmed_at: '2026-10-31T10:00:00Z',
        }),
        match({
          id: 'c',
          status: 'confirmed',
          winner_id: 'p2',
          confirmed_at: '2026-10-30T10:00:00Z',
        }),
      ],
      player,
    )

    expect(record.streak).toEqual({ kind: 'win', length: 2 })
  })

  it('counts doubles partners as participants and winning partners as winners', () => {
    const record = arenaRecord(
      [
        doubles({
          id: 'win',
          status: 'confirmed',
          winner_id: 'p1',
          confirmed_at: '2026-11-01T10:00:00Z',
        }),
        doubles({
          id: 'loss',
          status: 'confirmed',
          winner_id: 'p2',
          confirmed_at: '2026-10-30T10:00:00Z',
        }),
      ],
      'p4',
    )

    expect(record.played).toBe(2)
    expect(record.wins).toBe(1)
    expect(record.losses).toBe(1)
    expect(record.form).toEqual(['win', 'loss'])
  })

  it('has no record without a linked player or decided matches', () => {
    expect(arenaRecord([], null)).toEqual({
      played: 0,
      wins: 0,
      losses: 0,
      winRate: null,
      form: [],
      streak: null,
    })
    expect(arenaRecord([match({ status: 'pending' })], player).played).toBe(0)
  })
})

describe('arenaMatches', () => {
  it('puts actions on the player first and describes the next step', () => {
    const rows = arenaMatches(
      [
        match({
          id: 'review',
          status: 'awaiting_approval',
          winner_id: 'p2',
          auto_approval_due_at: '2026-11-02T20:00:00Z',
        }),
        match({ id: 'done', status: 'confirmed', winner_id: 'p1' }),
        match({ id: 'invite', status: 'pending', challenger_id: 'p2', opponent_id: 'p1' }),
        match({ id: 'sent', status: 'pending', challenger_id: 'p1', opponent_id: 'p2' }),
      ],
      'p1',
      NOW,
    )

    expect(rows.map((row) => row.id)).toEqual(['invite', 'review', 'sent', 'done'])
    expect(rows[0]?.needsYou).toBe(true)
    expect(rows[0]?.direction).toBe('incoming')
    expect(rows[1]?.needsYou).toBe(true)
    expect(rows[1]?.hoursLeft).toBe(12)
    expect(rows[2]?.needsYou).toBe(false)
    expect(rows[2]?.direction).toBe('outgoing')
    expect(rows[3]?.result).toBe('win')
  })

  it('never asks the winner to approve their own result', () => {
    const rows = arenaMatches(
      [
        match({
          id: 'mine',
          status: 'awaiting_approval',
          winner_id: 'p1',
          auto_approval_due_at: '2026-11-03T08:00:00Z',
        }),
      ],
      'p1',
      NOW,
    )

    expect(rows[0]?.needsYou).toBe(false)
    expect(rows[0]?.result).toBeNull()
  })

  it('asks each losing doubles partner once and never the winning team', () => {
    const rows = arenaMatches(
      [
        doubles({
          id: 'review',
          status: 'awaiting_approval',
          winner_id: 'p1',
          auto_approval_due_at: '2026-11-02T20:00:00Z',
        }),
        doubles({
          id: 'approved',
          status: 'awaiting_approval',
          winner_id: 'p1',
          opponent_partner_approved_at: '2026-11-01T11:00:00Z',
        }),
        doubles({ id: 'winner', status: 'awaiting_approval', winner_id: 'p2' }),
      ],
      'p5',
      NOW,
    )

    expect(rows.find((row) => row.id === 'review')?.needsYou).toBe(true)
    expect(rows.find((row) => row.id === 'approved')?.needsYou).toBe(false)
    expect(rows.find((row) => row.id === 'winner')?.needsYou).toBe(false)
  })

  it('gives a doubles partner the result and opposing captain', () => {
    const rows = arenaMatches(
      [
        doubles({
          id: 'win',
          status: 'confirmed',
          winner_id: 'p1',
          confirmed_at: '2026-11-01T10:00:00Z',
        }),
      ],
      'p4',
      NOW,
    )

    expect(rows[0]).toMatchObject({ opponentId: 'p2', direction: 'outgoing', result: 'win' })
  })

  it('ignores matches the player is not part of and caps the list', () => {
    const rows = arenaMatches(
      [
        match({ id: 'foreign', challenger_id: 'p2', opponent_id: 'p3', status: 'accepted' }),
        ...Array.from({ length: 8 }, (_, index) =>
          match({ id: `m${index}`, status: 'confirmed', winner_id: 'p1' }),
        ),
      ],
      'p1',
      NOW,
      3,
    )

    expect(rows).toHaveLength(3)
    expect(rows.some((row) => row.id === 'foreign')).toBe(false)
  })
})

describe('rivalsNear', () => {
  const ladder = [
    { playerId: 'p1', fullName: 'Ana Reyes', sp: 1180, position: 1 },
    { playerId: 'p2', fullName: 'Bea Cruz', sp: 1150, position: 2 },
    { playerId: 'p3', fullName: 'Cara Lim', sp: 1090, position: 3 },
    { playerId: 'p4', fullName: 'Dina Tan', sp: 1000, position: 4 },
    { playerId: 'p5', fullName: 'Eli Go', sp: 1420, position: 5 },
  ]

  it('returns the closest balances with a signed delta', () => {
    const rivals = rivalsNear(ladder, 'p2', 3)

    expect(rivals.map((row) => row.playerId)).toEqual(['p1', 'p3', 'p4'])
    expect(rivals[0]).toMatchObject({ delta: 30, position: 1 })
    expect(rivals[1]).toMatchObject({ delta: -60, position: 3 })
  })

  it('returns nothing without a signed-in ladder row', () => {
    expect(rivalsNear(ladder, null)).toEqual([])
    expect(rivalsNear(ladder, 'unknown')).toEqual([])
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days across a month boundary', () => {
    expect(daysBetween('2026-11-28', '2026-12-02')).toBe(4)
    expect(daysBetween('2026-11-02', '2026-11-02')).toBe(0)
  })

  it('returns null for values it cannot read', () => {
    expect(daysBetween('not-a-date', '2026-11-02')).toBeNull()
    expect(daysBetween('2026-11-02', '')).toBeNull()
  })
})

function match(overrides: Partial<ArenaMatchLike>): ArenaMatchLike {
  return {
    id: 'match',
    match_type: 'singles',
    challenger_id: 'p1',
    challenger_partner_id: null,
    opponent_id: 'p2',
    opponent_partner_id: null,
    status: 'pending',
    winner_id: null,
    challenger_approved_at: null,
    challenger_partner_approved_at: null,
    opponent_approved_at: null,
    opponent_partner_approved_at: null,
    created_at: '2026-11-01T10:00:00Z',
    confirmed_at: null,
    auto_approval_due_at: null,
    ...overrides,
  }
}

function doubles(overrides: Partial<ArenaMatchLike> = {}): ArenaMatchLike {
  return match({
    match_type: 'doubles',
    challenger_partner_id: 'p4',
    opponent_partner_id: 'p5',
    ...overrides,
  })
}
