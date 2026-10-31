export type Discipline = 'singles' | 'mens_doubles' | 'womens_doubles' | 'mixed_doubles'

export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin'

export type Gender = 'male' | 'female'

export interface TournamentPlayer {
  id: string
  gender: Gender | null
}

export interface EntryCandidate {
  playerIds: readonly string[]
  seed?: number | null
}

export interface EntryValidationInput {
  discipline: Discipline
  maxEntries?: number | null
  entries: readonly EntryCandidate[]
  players: readonly TournamentPlayer[]
}

export type EntryValidationCode =
  | 'too_many_entries'
  | 'invalid_participant_count'
  | 'duplicate_player'
  | 'player_not_found'
  | 'invalid_seed'
  | 'duplicate_seed'
  | 'gender_required'
  | 'doubles_gender_mismatch'
  | 'mixed_doubles_pairing'

export interface EntryValidationIssue {
  code: EntryValidationCode
  message: string
  entryIndex?: number
  playerId?: string
  seed?: number
}

export type EntryValidationResult =
  { valid: true; errors: [] } | { valid: false; errors: EntryValidationIssue[] }

export function playersPerEntry(discipline: Discipline): 1 | 2 {
  return discipline === 'singles' ? 1 : 2
}

/**
 * Validate entries before they are saved or a draw is generated.
 *
 * The database still owns uniqueness and the event cap; this module gives the
 * form the same rules up front so a manager sees every problem at once. It also
 * isolates the D10 Mixed Doubles rule, which must be mirrored by a database
 * constraint when tournament tables land.
 */
export function validateTournamentEntries(input: EntryValidationInput): EntryValidationResult {
  const errors: EntryValidationIssue[] = []
  const expectedSize = playersPerEntry(input.discipline)
  const playerById = new Map(input.players.map((player) => [player.id, player]))
  const seenPlayers = new Map<string, number>()
  const seenSeeds = new Map<number, number>()

  if (
    input.maxEntries !== null &&
    input.maxEntries !== undefined &&
    input.entries.length > input.maxEntries
  ) {
    errors.push({
      code: 'too_many_entries',
      message: `This event allows at most ${input.maxEntries} entries.`,
    })
  }

  input.entries.forEach((entry, entryIndex) => {
    if (entry.playerIds.length !== expectedSize) {
      errors.push({
        code: 'invalid_participant_count',
        message:
          expectedSize === 1
            ? 'A singles entry needs exactly one player.'
            : 'A doubles entry needs exactly two players.',
        entryIndex,
      })
    }

    const localPlayers = new Set<string>()
    entry.playerIds.forEach((playerId) => {
      if (localPlayers.has(playerId)) {
        errors.push({
          code: 'duplicate_player',
          message: 'The same player cannot appear twice in one entry.',
          entryIndex,
          playerId,
        })
      }
      localPlayers.add(playerId)

      const previousEntry = seenPlayers.get(playerId)
      if (previousEntry !== undefined && previousEntry !== entryIndex) {
        errors.push({
          code: 'duplicate_player',
          message: 'A player cannot be registered twice in the same event.',
          entryIndex,
          playerId,
        })
      } else {
        seenPlayers.set(playerId, entryIndex)
      }

      if (!playerById.has(playerId)) {
        errors.push({
          code: 'player_not_found',
          message: 'The selected player record no longer exists.',
          entryIndex,
          playerId,
        })
      }
    })

    if (entry.seed !== null && entry.seed !== undefined) {
      if (!Number.isInteger(entry.seed) || entry.seed < 1) {
        errors.push({
          code: 'invalid_seed',
          message: 'Seeds must be whole numbers starting at 1.',
          entryIndex,
          seed: entry.seed,
        })
      } else if (seenSeeds.has(entry.seed)) {
        errors.push({
          code: 'duplicate_seed',
          message: `Seed ${entry.seed} is already assigned.`,
          entryIndex,
          seed: entry.seed,
        })
      } else {
        seenSeeds.set(entry.seed, entryIndex)
      }
    }

    if (expectedSize !== 2 || entry.playerIds.length !== 2) return

    const pair = entry.playerIds
      .map((playerId) => playerById.get(playerId))
      .filter((player): player is TournamentPlayer => player !== undefined)

    if (pair.length !== 2) return

    const [first, second] = pair as [TournamentPlayer, TournamentPlayer]
    const firstGender = first.gender
    const secondGender = second.gender

    if (firstGender === null || secondGender === null) {
      errors.push({
        code: 'gender_required',
        message: 'Both players need a recorded gender for this doubles event.',
        entryIndex,
      })
      return
    }

    if (input.discipline === 'mixed_doubles') {
      if (firstGender === secondGender) {
        errors.push({
          code: 'mixed_doubles_pairing',
          message: 'Mixed Doubles needs exactly one male and one female player.',
          entryIndex,
        })
      }
      return
    }

    const requiredGender: Gender = input.discipline === 'mens_doubles' ? 'male' : 'female'
    if (firstGender !== requiredGender || secondGender !== requiredGender) {
      errors.push({
        code: 'doubles_gender_mismatch',
        message:
          requiredGender === 'male'
            ? "Men's Doubles needs two male players."
            : "Women's Doubles needs two female players.",
        entryIndex,
      })
    }
  })

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}
