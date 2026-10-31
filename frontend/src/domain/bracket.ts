export interface BracketEntry {
  id: string
}

export type EliminationFormat = 'single_elimination' | 'double_elimination'
export type EliminationBracket = 'winners' | 'losers'
export type BracketMatchKind = EliminationBracket | 'grand_final'
export type SlotOutcome = 'winner' | 'loser'

export interface BracketSide {
  entryId: string | null
  sourceMatchId: string | null
  sourceOutcome: SlotOutcome | null
}

export interface BracketMatch {
  id: string
  bracket: BracketMatchKind
  round: number
  position: number
  home: BracketSide
  away: BracketSide
  winnerTo: string | null
  loserTo: string | null
  /** A reset is only played when the losers-bracket finalist wins the first grand final. */
  conditional: boolean
  reset: boolean
}

export interface BracketRound {
  bracket: EliminationBracket
  round: number
  name: string
  /** One entry per bracket position; null means a bye, so no match was created. */
  matchIds: Array<string | null>
}

export interface GrandFinalLinks {
  matchId: string
  resetMatchId: string
}

export interface Bracket {
  format: EliminationFormat
  entryCount: number
  /** Power-of-two bracket capacity, including byes. */
  size: number
  rounds: BracketRound[]
  matches: BracketMatch[]
  grandFinal: GrandFinalLinks | null
}

export interface RoundRobinPairing {
  homeEntryId: string
  awayEntryId: string
}

export interface RoundRobinRound {
  round: number
  pairings: RoundRobinPairing[]
  byeEntryId: string | null
}

export interface RoundRobinSchedule {
  entryCount: number
  rounds: RoundRobinRound[]
}

type Slot = BracketSide
type NullableSlot = Slot | null

interface BuildContext {
  matches: BracketMatch[]
  matchById: Map<string, BracketMatch>
}

function assertEntries(entries: readonly BracketEntry[]): void {
  if (entries.length < 2) {
    throw new Error('A draw needs at least two entries.')
  }

  const seen = new Set<string>()
  for (const entry of entries) {
    if (entry.id.trim() === '') throw new Error('Every entry needs an id.')
    if (seen.has(entry.id)) throw new Error(`Duplicate entry: ${entry.id}`)
    seen.add(entry.id)
  }
}

function bracketSize(entryCount: number): number {
  let size = 2
  while (size < entryCount) size *= 2
  return size
}

/**
 * Standard bracket seed order: 1 v 8, 4 v 5, 2 v 7, 3 v 6 for an eight-slot
 * draw. Entries supplied to the builders are already in seed order, so the
 * caller can shuffle for a random draw or sort by a manual seed first.
 */
function seedOrder(size: number): number[] {
  let order = [1]
  while (order.length < size) {
    const next = order.length * 2 + 1
    order = order.flatMap((seed) => [seed, next - seed])
  }
  return order
}

function entrySlot(entryId: string): Slot {
  return { entryId, sourceMatchId: null, sourceOutcome: null }
}

function matchSlot(matchId: string, outcome: SlotOutcome): Slot {
  return { entryId: null, sourceMatchId: matchId, sourceOutcome: outcome }
}

function sideFromSlot(slot: Slot): BracketSide {
  return { ...slot }
}

function linkSource(context: BuildContext, side: BracketSide, targetMatchId: string): void {
  if (side.sourceMatchId === null) return

  const source = context.matchById.get(side.sourceMatchId)
  if (!source) throw new Error(`Missing source match ${side.sourceMatchId}`)

  if (side.sourceOutcome === 'loser') {
    source.loserTo = targetMatchId
  } else {
    source.winnerTo = targetMatchId
  }
}

interface PairingResult {
  matches: Array<BracketMatch | null>
  outputs: NullableSlot[]
}

function pairSlots(
  slots: readonly NullableSlot[],
  context: BuildContext,
  bracket: EliminationBracket,
  round: number,
  prefix: string,
): PairingResult {
  if (slots.length % 2 !== 0) throw new Error('A bracket round needs an even number of slots.')

  const matches: Array<BracketMatch | null> = []
  const outputs: NullableSlot[] = []

  for (let index = 0; index < slots.length; index += 2) {
    const home = slots[index] ?? null
    const away = slots[index + 1] ?? null
    const position = index / 2 + 1

    if (home === null && away === null) {
      matches.push(null)
      outputs.push(null)
      continue
    }

    if (home === null || away === null) {
      // A bye advances the existing entry/source without creating a match.
      matches.push(null)
      outputs.push(home ?? away)
      continue
    }

    const id = `${prefix}-r${round}-m${position}`
    const match: BracketMatch = {
      id,
      bracket,
      round,
      position,
      home: sideFromSlot(home),
      away: sideFromSlot(away),
      winnerTo: null,
      loserTo: null,
      conditional: false,
      reset: false,
    }

    linkSource(context, match.home, id)
    linkSource(context, match.away, id)

    context.matches.push(match)
    context.matchById.set(id, match)
    matches.push(match)
    outputs.push(matchSlot(id, 'winner'))
  }

  return { matches, outputs }
}

function winnersRoundName(round: number, totalRounds: number): string {
  const fromFinal = totalRounds - round
  if (fromFinal === 0) return 'Final'
  if (fromFinal === 1) return 'Semifinals'
  if (fromFinal === 2) return 'Quarterfinals'
  return `Round ${round}`
}

function buildWinners(
  entries: readonly BracketEntry[],
  size: number,
  context: BuildContext,
): { rounds: BracketRound[]; finalMatchId: string } {
  const order = seedOrder(size)
  let slots: NullableSlot[] = order.map((seed) =>
    seed <= entries.length ? entrySlot(entries[seed - 1]!.id) : null,
  )

  const rounds: BracketRound[] = []
  const totalRounds = Math.log2(size)

  for (let round = 1; round <= totalRounds; round += 1) {
    const { matches, outputs } = pairSlots(slots, context, 'winners', round, 'w')
    rounds.push({
      bracket: 'winners',
      round,
      name: winnersRoundName(round, totalRounds),
      matchIds: matches.map((match) => match?.id ?? null),
    })
    slots = outputs
  }

  const finalMatchId = rounds.at(-1)?.matchIds.at(0) ?? null
  if (finalMatchId === null) throw new Error('The winners bracket has no final.')
  return { rounds, finalMatchId }
}

function buildLosers(
  winnersRounds: readonly BracketRound[],
  context: BuildContext,
): { rounds: BracketRound[]; finalSlot: Slot } {
  const winnersRoundCount = winnersRounds.length
  const winnersFinalId = winnersRounds.at(-1)?.matchIds.at(0) ?? null
  if (winnersFinalId === null) throw new Error('The winners bracket has no final.')

  if (winnersRoundCount === 1) {
    return { rounds: [], finalSlot: matchSlot(winnersFinalId, 'loser') }
  }

  const firstWinnersRound = winnersRounds[0]
  if (!firstWinnersRound) throw new Error('The winners bracket has no first round.')

  let current: NullableSlot[] = firstWinnersRound.matchIds.map((matchId) =>
    matchId === null ? null : matchSlot(matchId, 'loser'),
  )
  const rounds: BracketRound[] = []
  const losersRoundCount = 2 * (winnersRoundCount - 1)

  for (let round = 1; round <= losersRoundCount; round += 1) {
    let input = current

    if (round % 2 === 0) {
      const dropRound = winnersRounds[round / 2]
      if (!dropRound) throw new Error(`No winners round drops into losers round ${round}.`)

      const dropping = dropRound.matchIds.map((matchId) =>
        matchId === null ? null : matchSlot(matchId, 'loser'),
      )
      if (dropping.length !== current.length) {
        throw new Error(`Losers round ${round} has mismatched drop slots.`)
      }

      // Cross the drop-ins against the surviving losers so a team does not
      // immediately replay the opponent it just met in the winners bracket.
      dropping.reverse()
      input = current.flatMap((slot, index) => [slot, dropping[index] ?? null])
    }

    const { matches, outputs } = pairSlots(input, context, 'losers', round, 'l')
    rounds.push({
      bracket: 'losers',
      round,
      name: `Losers round ${round}`,
      matchIds: matches.map((match) => match?.id ?? null),
    })
    current = outputs
  }

  const finalSlot = current[0]
  if (!finalSlot || (finalSlot.entryId === null && finalSlot.sourceMatchId === null)) {
    throw new Error('The losers bracket has no finalist.')
  }

  return { rounds, finalSlot }
}

function createGrandFinal(
  winnersFinalId: string,
  losersFinalSlot: Slot,
  context: BuildContext,
): GrandFinalLinks {
  const matchId = 'gf'
  const grandFinal: BracketMatch = {
    id: matchId,
    bracket: 'grand_final',
    round: 1,
    position: 1,
    home: matchSlot(winnersFinalId, 'winner'),
    away: sideFromSlot(losersFinalSlot),
    winnerTo: null,
    loserTo: null,
    conditional: false,
    reset: false,
  }

  linkSource(context, grandFinal.home, matchId)
  linkSource(context, grandFinal.away, matchId)
  context.matches.push(grandFinal)
  context.matchById.set(matchId, grandFinal)

  const resetMatchId = 'gf-reset'
  const reset: BracketMatch = {
    id: resetMatchId,
    bracket: 'grand_final',
    round: 2,
    position: 1,
    home: matchSlot(matchId, 'winner'),
    away: matchSlot(matchId, 'loser'),
    winnerTo: null,
    loserTo: null,
    conditional: true,
    reset: true,
  }

  // The reset is a placeholder until the first grand final is finalized. Do
  // not link the grand final's winner here; the result engine enables this
  // match only when the losers-bracket finalist wins.
  context.matches.push(reset)
  context.matchById.set(resetMatchId, reset)

  return { matchId, resetMatchId }
}

export function buildSingleElimination(entries: readonly BracketEntry[]): Bracket {
  assertEntries(entries)
  const size = bracketSize(entries.length)
  const context: BuildContext = { matches: [], matchById: new Map() }
  const winners = buildWinners(entries, size, context)

  return {
    format: 'single_elimination',
    entryCount: entries.length,
    size,
    rounds: winners.rounds,
    matches: context.matches,
    grandFinal: null,
  }
}

export function buildDoubleElimination(entries: readonly BracketEntry[]): Bracket {
  assertEntries(entries)
  const size = bracketSize(entries.length)
  const context: BuildContext = { matches: [], matchById: new Map() }
  const winners = buildWinners(entries, size, context)
  const losers = buildLosers(winners.rounds, context)
  const grandFinal = createGrandFinal(winners.finalMatchId, losers.finalSlot, context)

  return {
    format: 'double_elimination',
    entryCount: entries.length,
    size,
    rounds: [...winners.rounds, ...losers.rounds],
    matches: context.matches,
    grandFinal,
  }
}

/**
 * Circle-method round robin. An odd entry count receives one bye each round,
 * and the bye is returned as metadata rather than a fake pairing.
 */
export function buildRoundRobinSchedule(entries: readonly BracketEntry[]): RoundRobinSchedule {
  assertEntries(entries)

  const participants: Array<BracketEntry | null> = [...entries]
  if (participants.length % 2 === 1) participants.push(null)

  const rotating = participants.slice(1)
  const fixed = participants[0]
  if (!fixed) throw new Error('A round robin needs at least two entries.')

  const rounds: RoundRobinRound[] = []
  const roundCount = participants.length - 1

  for (let round = 0; round < roundCount; round += 1) {
    const arrangement = [fixed, ...rotating]
    const pairings: RoundRobinPairing[] = []
    let byeEntryId: string | null = null

    for (let index = 0; index < arrangement.length / 2; index += 1) {
      const home = arrangement[index] ?? null
      const away = arrangement[arrangement.length - 1 - index] ?? null

      if (home && away) {
        pairings.push({ homeEntryId: home.id, awayEntryId: away.id })
      } else if (home || away) {
        byeEntryId = (home ?? away)!.id
      }
    }

    rounds.push({ round: round + 1, pairings, byeEntryId })

    const last = rotating.pop()
    if (last !== undefined) rotating.unshift(last)
  }

  return { entryCount: entries.length, rounds }
}
