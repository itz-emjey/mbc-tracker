import { z } from 'zod'

import { isIsoDate } from '@/features/players/validation'

import { PAYMENT_METHODS } from './types'

/** `datetime-local` value, e.g. `2026-11-05T18:30`. */
const localDateTime = z
  .string()
  .refine((value) => value.trim() !== '' && !Number.isNaN(new Date(value).getTime()), {
    message: 'Choose a valid date and time.',
  })

export const sessionFormSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a session title.')
      .max(120, 'Keep the title under 120 characters.'),
    starts_at: localDateTime,
    ends_at: localDateTime,
    venue: z.string().trim().max(120, 'Keep the venue under 120 characters.').nullable(),
    notes: z.string().trim().max(2000, 'Keep notes under 2,000 characters.').nullable(),
  })
  .refine(
    (values) => {
      const starts = new Date(values.starts_at).getTime()
      const ends = new Date(values.ends_at).getTime()
      return Number.isNaN(starts) || Number.isNaN(ends) || ends > starts
    },
    { path: ['ends_at'], message: 'The session must end after it starts.' },
  )

export type SessionFormValues = z.infer<typeof sessionFormSchema>

export const feePeriodFormSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'Enter a label such as 2026-11.')
      .max(40, 'Keep the label under 40 characters.'),
    starts_on: z.string().refine(isIsoDate, 'Choose a valid start date.'),
    ends_on: z.string().refine(isIsoDate, 'Choose a valid end date.'),
    amount: z.coerce
      .number()
      .positive('Enter an amount greater than zero.')
      .refine((value) => Math.round(value * 100) === value * 100, {
        message: 'Use at most two decimal places.',
      }),
    due_on: z.string().nullable(),
  })
  .refine((values) => values.ends_on >= values.starts_on, {
    path: ['ends_on'],
    message: 'The period must end on or after it starts.',
  })

export type FeePeriodFormValues = z.infer<typeof feePeriodFormSchema>

export const paymentFormSchema = z.object({
  player_id: z.string().min(1, 'Choose a player.'),
  amount: z.coerce
    .number()
    .positive('Enter an amount greater than zero.')
    .refine((value) => Math.round(value * 100) === value * 100, {
      message: 'Use at most two decimal places.',
    }),
  paid_on: z.string().refine(isIsoDate, 'Choose a valid payment date.'),
  method: z.enum(PAYMENT_METHODS as [string, ...string[]]),
})

export type PaymentFormValues = z.infer<typeof paymentFormSchema>

/** Converts a `datetime-local` value into the ISO string the RPC stores. */
export function localDateTimeToIso(value: string): string {
  return new Date(value).toISOString()
}
