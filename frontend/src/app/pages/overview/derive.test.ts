import { describe, expect, it } from 'vitest'

import type { FriendlyMatchRecord } from '@/features/friendlies/types'
import type { JerseyOrderRecord, JerseyProjectRecord } from '@/features/jerseys/types'
import type { PlayerRecord } from '@/features/players/types'
import type { PollRecord, PollResults } from '@/features/polls/types'
import type { TrainingFeePeriodRecord, TrainingPaymentRecord } from '@/features/training/types'
import type { TournamentRecord } from '@/features/tournaments/types'

import {
  activePolls,
  attendanceSummary,
  buildAttentionItems,
  feeSummary,
  latestFeePeriod,
  nextTrainingSession,
  openJerseyProjects,
  upcomingTournaments,
} from './derive'

const NOW = Date.parse('2026-11-02T08:00:00Z')

describe('overview date filters', () => {
  it('picks the earliest scheduled session that has not ended', () => {
    const sessions = [
      {
        id: 'past',
        status: 'scheduled',
        starts_at: '2026-11-01T10:00:00Z',
        ends_at: '2026-11-01T12:00:00Z',
      },
      {
        id: 'completed',
        status: 'completed',
        starts_at: '2026-11-03T10:00:00Z',
        ends_at: '2026-11-03T12:00:00Z',
      },
      {
        id: 'later',
        status: 'scheduled',
        starts_at: '2026-11-05T10:00:00Z',
        ends_at: '2026-11-05T12:00:00Z',
      },
      {
        id: 'next',
        status: 'scheduled',
        starts_at: '2026-11-03T10:00:00Z',
        ends_at: '2026-11-03T12:00:00Z',
      },
    ]

    expect(nextTrainingSession(sessions, NOW)?.id).toBe('next')
  })

  it('keeps only open polls whose window includes now', () => {
    const polls = [
      {
        id: 'open',
        status: 'open',
        opens_at: '2026-11-01T00:00:00Z',
        closes_at: '2026-11-10T00:00:00Z',
      },
      { id: 'future', status: 'open', opens_at: '2026-11-03T00:00:00Z', closes_at: null },
      { id: 'closed', status: 'closed', opens_at: null, closes_at: null },
      { id: 'expired', status: 'open', opens_at: null, closes_at: '2026-11-01T00:00:00Z' },
    ]

    expect(activePolls(polls, NOW).map((poll) => poll.id)).toEqual(['open'])
  })

  it('keeps projects still accepting orders, soonest deadline first', () => {
    const projects = [
      { id: 'later', status: 'open', order_deadline: '2026-11-20T00:00:00Z' },
      { id: 'expired', status: 'open', order_deadline: '2026-11-01T00:00:00Z' },
      { id: 'closed', status: 'closed', order_deadline: null },
      { id: 'no-deadline', status: 'open', order_deadline: null },
      { id: 'sooner', status: 'open', order_deadline: '2026-11-10T00:00:00Z' },
    ]

    expect(openJerseyProjects(projects, NOW).map((project) => project.id)).toEqual([
      'sooner',
      'later',
      'no-deadline',
    ])
  })

  it('keeps published or running tournaments that have not finished', () => {
    const tournaments = [
      {
        id: 'running',
        status: 'in_progress',
        starts_on: '2026-10-30',
        ends_on: '2026-11-04',
      },
      {
        id: 'upcoming',
        status: 'published',
        starts_on: '2026-11-10',
        ends_on: '2026-11-12',
      },
      { id: 'draft', status: 'draft', starts_on: '2026-11-20', ends_on: '2026-11-21' },
      { id: 'done', status: 'published', starts_on: '2026-10-01', ends_on: '2026-10-02' },
      {
        id: 'archived',
        status: 'archived',
        starts_on: '2026-11-20',
        ends_on: '2026-11-22',
      },
    ]

    expect(upcomingTournaments(tournaments, '2026-11-02').map((event) => event.id)).toEqual([
      'running',
      'upcoming',
    ])
  })

  it('uses the most recently started fee period', () => {
    const periods = [
      { id: 'september', starts_on: '2026-09-01', ends_on: '2026-09-30' },
      { id: 'november', starts_on: '2026-11-01', ends_on: '2026-11-30' },
      { id: 'october', starts_on: '2026-10-01', ends_on: '2026-10-31' },
    ]

    expect(latestFeePeriod(periods)?.id).toBe('november')
    expect(latestFeePeriod([])).toBeNull()
  })
})

describe('overview summaries', () => {
  it('counts own attendance and treats present or late as attended', () => {
    expect(
      attendanceSummary(
        [
          { session_id: 's1', player_id: 'p1', status: 'present', recorded_at: '' },
          { session_id: 's2', player_id: 'p1', status: 'late', recorded_at: '' },
          { session_id: 's3', player_id: 'p1', status: 'absent', recorded_at: '' },
          { session_id: 's4', player_id: 'p2', status: 'present', recorded_at: '' },
        ],
        'p1',
      ),
    ).toEqual({ attended: 2, recorded: 3 })

    expect(attendanceSummary([], null)).toEqual({ attended: 0, recorded: 0 })
  })

  it('sums only the player’s non-voided payments for the period', () => {
    const period = feePeriod({ amount: '1000.00' })
    const payments = [
      payment({ id: 'a', amount: '400.00' }),
      payment({ id: 'b', amount: '100.00' }),
      payment({ id: 'void', amount: '500.00', status: 'voided' }),
    ]

    expect(feeSummary(period, payments, 'p1')).toEqual({
      state: 'partial',
      paid: 500,
      remaining: 500,
    })
  })
})

describe('attention queue', () => {
  const player = playerRecord()

  it('lists personal actions and near-term club deadlines', () => {
    const poll = pollRecord({ id: 'poll-1', question: 'Which jersey?' })
    const project = jerseyProject({ id: 'project-1', name: '2026 kit' })
    const openPoll = pollResults({ poll_id: poll.id })

    const items = buildAttentionItems({
      player,
      now: NOW,
      matches: [matchRecord({ id: 'match-1', status: 'pending' })],
      names: new Map([['p2', 'Bea Cruz']]),
      polls: [poll],
      pollResults: new Map([[poll.id, openPoll]]),
      jerseyProjects: [project],
      jerseyOrders: [],
      feePeriod: feePeriod({ label: 'November', amount: '500.00' }),
      payments: [],
      tournaments: [
        tournamentRecord({
          id: 'tournament-1',
          name: 'Club Open',
          registration_deadline: '2026-11-05T00:00:00Z',
        }),
      ],
    })

    expect(items.map((item) => item.kind)).toEqual(['match', 'fee', 'tournament', 'poll', 'jersey'])
    expect(items[0]?.title).toBe('Challenge from Bea Cruz')
    expect(items[1]?.tone).toBe('danger')
  })

  it('does not prompt voting or ordering without an active player record', () => {
    const poll = pollRecord({ id: 'poll-1' })
    const project = jerseyProject({ id: 'project-1' })

    const items = buildAttentionItems({
      player: { ...player, status: 'inactive' },
      now: NOW,
      matches: [],
      names: new Map(),
      polls: [poll],
      pollResults: new Map([[poll.id, pollResults({ poll_id: poll.id })]]),
      jerseyProjects: [project],
      jerseyOrders: [],
      feePeriod: null,
      payments: [],
      tournaments: [],
    })

    expect(items).toEqual([])
  })

  it('is empty when nothing is waiting on the player', () => {
    const poll = pollRecord({ id: 'poll-1', status: 'closed' })
    const project = jerseyProject({ id: 'project-1' })
    const voted = pollResults({ poll_id: poll.id, my_option_ids: ['option-1'] })

    const items = buildAttentionItems({
      player,
      now: NOW,
      matches: [matchRecord({ id: 'match-1', status: 'confirmed' })],
      names: new Map([['p2', 'Bea Cruz']]),
      polls: [],
      pollResults: new Map([[poll.id, voted]]),
      jerseyProjects: [project],
      jerseyOrders: [jerseyOrder({ id: 'order-1', project_id: project.id })],
      feePeriod: feePeriod({ amount: '500.00' }),
      payments: [payment({ id: 'paid', amount: '500.00' })],
      tournaments: [
        tournamentRecord({
          id: 'tournament-1',
          registration_deadline: '2026-12-01T00:00:00Z',
        }),
      ],
    })

    expect(items).toEqual([])
  })
})

function playerRecord(): PlayerRecord {
  return {
    id: 'p1',
    player_code: 'MBC-001',
    profile_id: 'profile-1',
    full_name: 'Ana Reyes',
    gender: 'female',
    status: 'active',
    rating_status: 'rated',
    joined_on: '2026-01-01',
  }
}

function matchRecord(overrides: Partial<FriendlyMatchRecord>): FriendlyMatchRecord {
  return {
    id: 'match',
    match_type: 'singles',
    challenger_id: 'p2',
    challenger_partner_id: null,
    opponent_id: 'p1',
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
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function pollRecord(overrides: Partial<PollRecord>): PollRecord {
  return {
    id: 'poll',
    question: 'Question?',
    description: null,
    mode: 'single',
    is_anonymous: false,
    show_results: true,
    status: 'open',
    opens_at: null,
    closes_at: null,
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function pollResults(overrides: Partial<PollResults>): PollResults {
  return {
    poll_id: 'poll',
    status: 'open',
    mode: 'single',
    is_anonymous: false,
    results_visible: true,
    options: [],
    my_option_ids: [],
    ...overrides,
  }
}

function jerseyProject(overrides: Partial<JerseyProjectRecord>): JerseyProjectRecord {
  return {
    id: 'project',
    name: 'Project',
    description: null,
    price: null,
    order_deadline: null,
    status: 'open',
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function jerseyOrder(overrides: Partial<JerseyOrderRecord>): JerseyOrderRecord {
  return {
    id: 'order',
    project_id: 'project',
    player_id: 'p1',
    design_id: 'design',
    size_id: 'size',
    quantity: 1,
    status: 'submitted',
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function feePeriod(overrides: Partial<TrainingFeePeriodRecord>): TrainingFeePeriodRecord {
  return {
    id: 'period',
    label: 'November',
    starts_on: '2026-11-01',
    ends_on: '2026-11-30',
    amount: '500.00',
    due_on: null,
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}

function payment(overrides: Partial<TrainingPaymentRecord>): TrainingPaymentRecord {
  return {
    id: 'payment',
    fee_period_id: 'period',
    player_id: 'p1',
    amount: '500.00',
    paid_on: '2026-11-02',
    method: 'cash',
    status: 'recorded',
    voided_at: null,
    void_reason: null,
    created_at: '2026-11-02T00:00:00Z',
    ...overrides,
  }
}

function tournamentRecord(overrides: Partial<TournamentRecord>): TournamentRecord {
  return {
    id: 'tournament',
    name: 'Tournament',
    description: null,
    venue: null,
    starts_on: '2026-11-10',
    ends_on: '2026-11-12',
    registration_deadline: null,
    poster_path: null,
    entrance_fee: 0,
    status: 'published',
    created_by: null,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  }
}
