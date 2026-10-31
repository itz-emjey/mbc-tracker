import {
  buildDoubleElimination,
  buildRoundRobinSchedule,
  buildSingleElimination,
  type Bracket,
  type BracketSide,
  type RoundRobinSchedule,
} from '@/domain/bracket'

import type { MatchBracket, SlotOutcome, TournamentEntryRecord, TournamentFormat } from './types'

/**
 * Conversion from the pure bracket engines to the payload accepted by
 * `save_tournament_draw`.
 *
 * The engines already emit matches in dependency order, so the array order is
 * a valid source order. The engine's stable match id doubles as the RPC key.
 */

export type DrawOrder = 'seeded' | 'random'

export const DRAW_ORDER_OPTIONS: readonly DrawOrder[] = ['seeded', 'random']

export const DRAW_ORDER_LABELS: Record<DrawOrder, string> = {
  seeded: 'Seed order',
  random: 'Random draw',
}

export interface DrawMatchPayload {
  key: string
  bracket: MatchBracket
  round: number
  position: number
  home_entry_id?: string
  away_entry_id?: string
  home_source_key?: string
  home_source_outcome?: SlotOutcome
  away_source_key?: string
  away_source_outcome?: SlotOutcome
  conditional?: boolean
  reset?: boolean
}

function addSide(payload: DrawMatchPayload, side: 'home' | 'away', slot: BracketSide): void {
  if (slot.entryId !== null) {
    if (side === 'home') payload.home_entry_id = slot.entryId
    else payload.away_entry_id = slot.entryId
    return
  }

  if (slot.sourceMatchId !== null && slot.sourceOutcome !== null) {
    if (side === 'home') {
      payload.home_source_key = slot.sourceMatchId
      payload.home_source_outcome = slot.sourceOutcome
    } else {
      payload.away_source_key = slot.sourceMatchId
      payload.away_source_outcome = slot.sourceOutcome
    }
    return
  }

  throw new Error('A bracket side needs an entry or a source match.')
}

export function bracketToDrawPayload(bracket: Bracket): DrawMatchPayload[] {
  return bracket.matches.map((match) => {
    const payload: DrawMatchPayload = {
      key: match.id,
      bracket: match.bracket,
      round: match.round,
      position: match.position,
    }

    addSide(payload, 'home', match.home)
    addSide(payload, 'away', match.away)

    if (match.conditional) payload.conditional = true
    if (match.reset) payload.reset = true

    return payload
  })
}

export function roundRobinToDrawPayload(schedule: RoundRobinSchedule): DrawMatchPayload[] {
  const payload: DrawMatchPayload[] = []

  for (const round of schedule.rounds) {
    round.pairings.forEach((pairing, index) => {
      payload.push({
        key: `rr-r${round.round}-m${index + 1}`,
        bracket: 'round_robin',
        round: round.round,
        position: index + 1,
        home_entry_id: pairing.homeEntryId,
        away_entry_id: pairing.awayEntryId,
      })
    })
  }

  return payload
}

/** Fisher-Yates over a copy. Exposed so a draw can be reproducible in tests. */
export function shuffleEntryIds(
  entryIds: readonly string[],
  random: () => number = Math.random,
): string[] {
  const result = [...entryIds]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const current = result[index]!
    result[index] = result[swapIndex]!
    result[swapIndex] = current
  }

  return result
}

type SeedableEntry = Pick<TournamentEntryRecord, 'id' | 'seed' | 'status' | 'created_at'>

/**
 * Registered entries with seeded entries first, then unseeded entries in
 * registration order. The builder turns this order into the standard bracket
 * seed positions, so a random draw only needs a shuffle of the result.
 */
export function orderedEntryIds(entries: readonly SeedableEntry[]): string[] {
  return entries
    .filter((entry) => entry.status === 'registered')
    .sort((left, right) => {
      if (left.seed !== null && right.seed !== null) {
        if (left.seed !== right.seed) return left.seed - right.seed
      } else if (left.seed !== null) {
        return -1
      } else if (right.seed !== null) {
        return 1
      }

      const created = left.created_at.localeCompare(right.created_at)
      return created !== 0 ? created : left.id.localeCompare(right.id)
    })
    .map((entry) => entry.id)
}

export function drawPayloadFor(
  format: TournamentFormat,
  entryIds: readonly string[],
  order: DrawOrder,
  random: () => number = Math.random,
): DrawMatchPayload[] {
  const ordered = order === 'random' ? shuffleEntryIds(entryIds, random) : [...entryIds]
  const entries = ordered.map((id) => ({ id }))

  switch (format) {
    case 'single_elimination':
      return bracketToDrawPayload(buildSingleElimination(entries))
    case 'double_elimination':
      return bracketToDrawPayload(buildDoubleElimination(entries))
    case 'round_robin':
      return roundRobinToDrawPayload(buildRoundRobinSchedule(entries))
  }
}
