import { z } from 'zod'

import { isIsoDate } from '@/features/players/validation'

import type { Discipline, GameScoreInput, TournamentFormat } from './types'

export const tournamentFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a tournament name.')
      .max(120, 'Keep the name under 120 characters.'),
    starts_on: z.string().refine(isIsoDate, 'Choose a valid start date.'),
    ends_on: z.string().refine(isIsoDate, 'Choose a valid end date.'),
    venue: z.string().trim().max(160, 'Keep the venue under 160 characters.').nullable(),
    description: z
      .string()
      .trim()
      .max(2000, 'Keep the description under 2,000 characters.')
      .nullable(),
    registration_deadline: z.string().nullable(),
  })
  .refine((values) => values.ends_on >= values.starts_on, {
    path: ['ends_on'],
    message: 'The end date must be on or after the start date.',
  })

export type TournamentFormValues = z.infer<typeof tournamentFormSchema>

export const eventFormSchema = z.object({
  discipline: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
  format: z.enum(['single_elimination', 'double_elimination', 'round_robin']),
  max_entries: z.coerce
    .number()
    .int('Use a whole number.')
    .min(2, 'An event needs room for at least two entries.')
    .max(256, 'Keep the cap at 256 entries or fewer.'),
})

export type EventFormValues = z.infer<typeof eventFormSchema>

export function disciplineOrDefault(value: string | undefined): Discipline {
  switch (value) {
    case 'mens_doubles':
    case 'womens_doubles':
    case 'mixed_doubles':
    case 'singles':
      return value
    default:
      return 'singles'
  }
}

export function formatOrDefault(value: string | undefined): TournamentFormat {
  switch (value) {
    case 'double_elimination':
    case 'round_robin':
    case 'single_elimination':
      return value
    default:
      return 'single_elimination'
  }
}

export interface GameRowInput {
  home_points: string
  away_points: string
}

export type GameRowsResult =
  { valid: true; games: GameScoreInput[] } | { valid: false; message: string }

/**
 * Mirrors the database's score rules so a manager sees the problem before the
 * RPC round-trip: at least one game, whole non-negative points, no level game,
 * and an overall winner.
 */
export function parseGameRows(rows: readonly GameRowInput[]): GameRowsResult {
  if (rows.length === 0) {
    return { valid: false, message: 'Add at least one game.' }
  }

  const games: GameScoreInput[] = []
  let homeWins = 0
  let awayWins = 0

  for (const [index, row] of rows.entries()) {
    const home = Number(row.home_points)
    const away = Number(row.away_points)

    if (
      row.home_points.trim() === '' ||
      row.away_points.trim() === '' ||
      !Number.isInteger(home) ||
      !Number.isInteger(away) ||
      home < 0 ||
      away < 0
    ) {
      return {
        valid: false,
        message: `Game ${index + 1} needs non-negative whole numbers on both sides.`,
      }
    }

    if (home === away) {
      return { valid: false, message: `Game ${index + 1} cannot end level.` }
    }

    if (home > away) homeWins += 1
    else awayWins += 1

    games.push({ home_points: home, away_points: away })
  }

  if (homeWins === awayWins) {
    return { valid: false, message: 'The match needs a winner: add a deciding game.' }
  }

  return { valid: true, games }
}
