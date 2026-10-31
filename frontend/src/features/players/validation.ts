import { z } from 'zod'

import { PLAYER_GENDERS, PLAYER_STATUSES } from './types'

/**
 * True for a real calendar date in `YYYY-MM-DD` form.
 * `new Date('2026-02-31')` silently rolls over, so the round-trip check is
 * required to reject impossible dates.
 */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const parsed = new Date(`${value}T00:00:00Z`)

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export const playerFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'Enter the player name.')
    .max(120, 'Keep the name under 120 characters.'),
  gender: z.enum(PLAYER_GENDERS).nullable(),
  status: z.enum(PLAYER_STATUSES),
  joined_on: z.string().refine(isIsoDate, 'Choose a valid joining date.'),
})

export type PlayerFormValues = z.infer<typeof playerFormSchema>
