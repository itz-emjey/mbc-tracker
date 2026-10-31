import { z } from 'zod'

/**
 * Client-side form validation.
 *
 * These rules mirror the server checks so a user gets fast, specific feedback.
 * They are not authorization: the RPC still validates every value, and RLS
 * remains the authority.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'Email is too long')
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'))

export const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Full name is required')
  .max(120, 'Full name must be 120 characters or fewer')

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Password must be 72 characters or fewer')

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
})

export const registrationSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

export const rejectReasonSchema = z
  .string()
  .trim()
  .min(3, 'Give a short reason the member can understand')
  .max(1000, 'Reason must be 1,000 characters or fewer')

export type SignInValues = z.infer<typeof signInSchema>
export type RegistrationValues = z.infer<typeof registrationSchema>
