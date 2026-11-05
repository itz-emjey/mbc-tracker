import { describe, expect, it } from 'vitest'

import {
  canCancel,
  canRespond,
  canReviewResult,
  canSubmitResult,
  captainOf,
  hasApproved,
  hoursUntilAutoApproval,
  isClosedFriendly,
  isLosingTeam,
  isOpenFriendly,
  isWinningTeam,
  losingTeamApprovals,
  opponentOf,
  partnerOf,
  teamOf,
} from './matches'
import type { FriendlyMatchRecord, FriendlyStatus } from './types'

const PLAYER = 'p1'
const RIVAL = 'p2'
const OUTSIDER = 'p3'
const PLAYER_PARTNER = 'p4'
const RIVAL_PARTNER = 'p5'

function match(overrides: Partial<FriendlyMatchRecord> = {}): FriendlyMatchRecord {
  return {
    id: 'm1',
    match_type: 'singles',
    challenger_id: PLAYER,
    challenger_partner_id: null,
    opponent_id: RIVAL,
    opponent_partner_id: null,
    note: null,
    status: 'pending',
    winner_id: null,
    submitted_by: null,
    submitted_at: null,
    auto_approval_due_at: null,
    responded_by: null,
    responded_at: null,
    confirmed_at: null,
    challenger_approved_at: null,
    challenger_partner_approved_at: null,
    opponent_approved_at: null,
    opponent_partner_approved_at: null,
    dispute_reason: null,
    disputed_at: null,
    created_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function doubles(overrides: Partial<FriendlyMatchRecord> = {}): FriendlyMatchRecord {
  return match({
    match_type: 'doubles',
    challenger_partner_id: PLAYER_PARTNER,
    opponent_partner_id: RIVAL_PARTNER,
    ...overrides,
  })
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

describe('team helpers', () => {
  it('places captains and partners on the right team', () => {
    expect(teamOf(doubles(), PLAYER)).toBe('challenger')
    expect(teamOf(doubles(), PLAYER_PARTNER)).toBe('challenger')
    expect(teamOf(doubles(), RIVAL)).toBe('opponent')
    expect(teamOf(doubles(), RIVAL_PARTNER)).toBe('opponent')
    expect(teamOf(doubles(), OUTSIDER)).toBeNull()
  })

  it('returns the captain and partner for either team member', () => {
    expect(captainOf(doubles(), PLAYER_PARTNER)).toBe(PLAYER)
    expect(captainOf(doubles(), RIVAL_PARTNER)).toBe(RIVAL)
    expect(captainOf(doubles(), OUTSIDER)).toBeNull()

    expect(partnerOf(doubles(), PLAYER)).toBe(PLAYER_PARTNER)
    expect(partnerOf(doubles(), PLAYER_PARTNER)).toBe(PLAYER)
    expect(partnerOf(doubles(), RIVAL)).toBe(RIVAL_PARTNER)
    expect(partnerOf(match(), PLAYER)).toBeNull()
  })
})

describe('opponentOf', () => {
  it('returns the other player for either participant and null for an outsider', () => {
    expect(opponentOf(match(), PLAYER)).toBe(RIVAL)
    expect(opponentOf(match(), RIVAL)).toBe(PLAYER)
    expect(opponentOf(match(), OUTSIDER)).toBeNull()
  })

  it('returns the opposing captain for a doubles partner', () => {
    expect(opponentOf(doubles(), PLAYER_PARTNER)).toBe(RIVAL)
    expect(opponentOf(doubles(), RIVAL_PARTNER)).toBe(PLAYER)
  })
})

describe('canRespond', () => {
  it('lets only the challenged captain respond to a pending invitation', () => {
    expect(canRespond(match(), RIVAL)).toBe(true)
    expect(canRespond(match(), PLAYER)).toBe(false)
    expect(canRespond(match(), OUTSIDER)).toBe(false)
  })

  it('never lets a doubles partner accept for the captain', () => {
    expect(canRespond(doubles(), RIVAL)).toBe(true)
    expect(canRespond(doubles(), RIVAL_PARTNER)).toBe(false)
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

  it('limits a doubles withdrawal to the challenger captain', () => {
    expect(canCancel(doubles(), PLAYER)).toBe(true)
    expect(canCancel(doubles(), PLAYER_PARTNER)).toBe(false)
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

  it('lets either doubles partner submit for the team', () => {
    expect(canSubmitResult(doubles({ status: 'accepted' }), PLAYER)).toBe(true)
    expect(canSubmitResult(doubles({ status: 'accepted' }), PLAYER_PARTNER)).toBe(true)
    expect(canSubmitResult(doubles({ status: 'accepted' }), RIVAL_PARTNER)).toBe(true)
  })
})

describe('winning and losing teams', () => {
  it('treats both members of the winning team as winners', () => {
    const won = doubles({ status: 'awaiting_approval', winner_id: PLAYER })

    expect(isWinningTeam(won, PLAYER)).toBe(true)
    expect(isWinningTeam(won, PLAYER_PARTNER)).toBe(true)
    expect(isLosingTeam(won, RIVAL)).toBe(true)
    expect(isLosingTeam(won, RIVAL_PARTNER)).toBe(true)
    expect(isWinningTeam(won, RIVAL)).toBe(false)
    expect(isLosingTeam(won, OUTSIDER)).toBe(false)
  })
})

describe('approvals', () => {
  it('tracks approval per player, not per team', () => {
    const partly = doubles({
      status: 'awaiting_approval',
      winner_id: PLAYER,
      opponent_approved_at: '2026-11-01T01:00:00.000Z',
    })

    expect(hasApproved(partly, RIVAL)).toBe(true)
    expect(hasApproved(partly, RIVAL_PARTNER)).toBe(false)
    expect(hasApproved(partly, PLAYER)).toBe(false)
    expect(losingTeamApprovals(partly)).toBe(1)
  })

  it('counts both losing partners once they approve', () => {
    const both = doubles({
      status: 'awaiting_approval',
      winner_id: PLAYER,
      opponent_approved_at: '2026-11-01T01:00:00.000Z',
      opponent_partner_approved_at: '2026-11-01T02:00:00.000Z',
    })

    expect(losingTeamApprovals(both)).toBe(2)
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

  it('lets both losing partners review, but stops one who already approved', () => {
    const doublesAwaiting = doubles({
      status: 'awaiting_approval',
      winner_id: PLAYER,
    })

    expect(canReviewResult(doublesAwaiting, RIVAL)).toBe(true)
    expect(canReviewResult(doublesAwaiting, RIVAL_PARTNER)).toBe(true)
    expect(canReviewResult(doublesAwaiting, PLAYER)).toBe(false)
    expect(canReviewResult(doublesAwaiting, PLAYER_PARTNER)).toBe(false)

    const partly = doubles({
      status: 'awaiting_approval',
      winner_id: PLAYER,
      opponent_approved_at: '2026-11-01T01:00:00.000Z',
    })

    expect(canReviewResult(partly, RIVAL)).toBe(false)
    expect(canReviewResult(partly, RIVAL_PARTNER)).toBe(true)
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
