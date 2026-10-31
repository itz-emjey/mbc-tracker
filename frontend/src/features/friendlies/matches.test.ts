import { describe, expect, it } from 'vitest'

import {
  canCancel,
  canRespond,
  canReviewResult,
  canSubmitResult,
  hoursUntilAutoApproval,
  isClosedFriendly,
  isOpenFriendly,
  opponentOf,
} from './matches'
import type { FriendlyMatchRecord, FriendlyStatus } from './types'

const PLAYER = 'p1'
const RIVAL = 'p2'
const OUTSIDER = 'p3'

function match(overrides: Partial<FriendlyMatchRecord> = {}): FriendlyMatchRecord {
  return {
    id: 'm1',
    challenger_id: PLAYER,
    opponent_id: RIVAL,
    note: null,
    status: 'pending',
    winner_id: null,
    submitted_by: null,
    submitted_at: null,
    auto_approval_due_at: null,
    responded_by: null,
    responded_at: null,
    confirmed_at: null,
    dispute_reason: null,
    disputed_at: null,
    created_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('status grouping', () => {
  const open: FriendlyStatus[] = ['pending', 'accepted', 'awaiting_approval']
  const closed: FriendlyStatus[] = [
    'declined',
    'cancelled',
    'confirmed',
    'auto_approved',
    'disputed',
  ]

  it('treats only the three live states as open', () => {
    for (const status of open) expect(isOpenFriendly(status)).toBe(true)
    for (const status of closed) expect(isOpenFriendly(status)).toBe(false)
  })

  it('treats every settled or withdrawn state as closed', () => {
    for (const status of closed) expect(isClosedFriendly(status)).toBe(true)
    for (const status of open) expect(isClosedFriendly(status)).toBe(false)
  })
})

describe('opponentOf', () => {
  it('returns the other player for either participant and null for an outsider', () => {
    expect(opponentOf(match(), PLAYER)).toBe(RIVAL)
    expect(opponentOf(match(), RIVAL)).toBe(PLAYER)
    expect(opponentOf(match(), OUTSIDER)).toBeNull()
  })
})

describe('canRespond', () => {
  it('lets only the challenged player respond to a pending invitation', () => {
    expect(canRespond(match(), RIVAL)).toBe(true)
    expect(canRespond(match(), PLAYER)).toBe(false)
    expect(canRespond(match(), OUTSIDER)).toBe(false)
  })

  it('stops responding once the invitation was accepted or declined', () => {
    expect(canRespond(match({ status: 'accepted' }), RIVAL)).toBe(false)
    expect(canRespond(match({ status: 'declined' }), RIVAL)).toBe(false)
  })
})

describe('canCancel', () => {
  it('lets the challenger withdraw before a result exists', () => {
    expect(canCancel(match(), PLAYER)).toBe(true)
    expect(canCancel(match({ status: 'accepted' }), PLAYER)).toBe(true)
    expect(canCancel(match(), RIVAL)).toBe(false)
  })

  it('refuses once a result was submitted, even for the challenger', () => {
    expect(canCancel(match({ status: 'awaiting_approval' }), PLAYER)).toBe(false)
  })
})

describe('canSubmitResult', () => {
  it('is limited to participants of an accepted challenge', () => {
    expect(canSubmitResult(match({ status: 'accepted' }), PLAYER)).toBe(true)
    expect(canSubmitResult(match({ status: 'accepted' }), RIVAL)).toBe(true)
    expect(canSubmitResult(match({ status: 'accepted' }), OUTSIDER)).toBe(false)
    expect(canSubmitResult(match(), PLAYER)).toBe(false)
  })
})

describe('canReviewResult', () => {
  const awaiting = match({
    status: 'awaiting_approval',
    winner_id: PLAYER,
    submitted_by: 'profile-1',
    submitted_at: '2026-11-01T00:00:00.000Z',
    auto_approval_due_at: '2026-11-02T00:00:00.000Z',
  })

  it('lets the losing side approve or dispute', () => {
    expect(canReviewResult(awaiting, RIVAL)).toBe(true)
  })

  it('never lets the winner review their own submission', () => {
    expect(canReviewResult(awaiting, PLAYER)).toBe(false)
  })

  it('refuses outsiders and results that are not awaiting approval', () => {
    expect(canReviewResult(awaiting, OUTSIDER)).toBe(false)
    expect(canReviewResult(match({ status: 'confirmed', winner_id: PLAYER }), RIVAL)).toBe(false)
  })
})

describe('hoursUntilAutoApproval', () => {
  const now = Date.parse('2026-11-01T06:00:00.000Z')
  const awaiting = (due: string) =>
    match({ status: 'awaiting_approval', winner_id: PLAYER, auto_approval_due_at: due })

  it('rounds the remaining window up to whole hours', () => {
    expect(hoursUntilAutoApproval(awaiting('2026-11-02T06:00:00.000Z'), now)).toBe(24)
    expect(hoursUntilAutoApproval(awaiting('2026-11-01T07:30:00.000Z'), now)).toBe(2)
  })

  it('reports zero once the server deadline has passed', () => {
    expect(hoursUntilAutoApproval(awaiting('2026-11-01T05:00:00.000Z'), now)).toBe(0)
  })

  it('returns null when there is no open window', () => {
    expect(hoursUntilAutoApproval(match(), now)).toBeNull()
    expect(hoursUntilAutoApproval(awaiting('not-a-date'), now)).toBeNull()
  })
})
