import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'
import type { Json } from '@/types/database'

import type {
  AttendanceEntryInput,
  FeePeriodInput,
  PaymentInput,
  TrainingAttendanceRecord,
  TrainingFeePeriodRecord,
  TrainingPaymentRecord,
  TrainingSessionRecord,
  TrainingSessionStatus,
} from './types'

/**
 * Training data access.
 *
 * Reads are plain SELECTs limited by RLS (staff see everything, a player sees
 * their own attendance and payments). Writes are RPC-only: no client holds an
 * INSERT/UPDATE/DELETE grant on these tables, so the audit trail and the money
 * rules cannot be bypassed.
 */

const SESSION_COLUMNS =
  'id, title, starts_at, ends_at, venue, notes, status, created_at, updated_at'
const ATTENDANCE_COLUMNS = 'session_id, player_id, status, recorded_at'
const PERIOD_COLUMNS = 'id, label, starts_on, ends_on, amount, due_on, created_at'
const PAYMENT_COLUMNS =
  'id, fee_period_id, player_id, amount, paid_on, method, status, voided_at, void_reason, created_at'

export async function listTrainingSessions(): Promise<TrainingSessionRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('training_sessions')
    .select(SESSION_COLUMNS)
    .order('starts_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as TrainingSessionRecord[]
}

export async function listTrainingAttendance(): Promise<TrainingAttendanceRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('training_attendance')
    .select(ATTENDANCE_COLUMNS)

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as TrainingAttendanceRecord[]
}

export async function createTrainingSession(input: {
  title: string
  starts_at: string
  ends_at: string
  venue: string | null
  notes: string | null
}): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc('create_training_session', {
    p_title: input.title,
    p_starts_at: input.starts_at,
    p_ends_at: input.ends_at,
    p_venue: input.venue,
    p_notes: input.notes,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function setTrainingSessionStatus(
  sessionId: string,
  status: Exclude<TrainingSessionStatus, 'scheduled'>,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_training_session_status', {
    p_session_id: sessionId,
    p_status: status,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function markTrainingAttendance(
  sessionId: string,
  entries: readonly AttendanceEntryInput[],
): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('mark_training_attendance', {
    p_session_id: sessionId,
    p_entries: entries as unknown as Json,
  })

  if (error) throw new Error(errorMessage(error))

  return (data as unknown as { recorded: number }).recorded
}

export async function listFeePeriods(): Promise<TrainingFeePeriodRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('training_fee_periods')
    .select(PERIOD_COLUMNS)
    .order('starts_on', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as TrainingFeePeriodRecord[]
}

export async function listTrainingPayments(): Promise<TrainingPaymentRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('training_payments')
    .select(PAYMENT_COLUMNS)
    .order('paid_on', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as TrainingPaymentRecord[]
}

export async function createFeePeriod(input: FeePeriodInput): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc('create_training_fee_period', {
    p_label: input.label,
    p_starts_on: input.starts_on,
    p_ends_on: input.ends_on,
    p_amount: input.amount,
    p_due_on: input.due_on,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function recordTrainingPayment(input: PaymentInput): Promise<{
  id: string
  total_paid: number
  remaining: number
}> {
  const { data, error } = await getSupabaseClient().rpc('record_training_payment', {
    p_fee_period_id: input.fee_period_id,
    p_player_id: input.player_id,
    p_amount: input.amount,
    p_paid_on: input.paid_on,
    p_method: input.method,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string; total_paid: number; remaining: number }
}

export async function voidTrainingPayment(paymentId: string, reason: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('void_training_payment', {
    p_payment_id: paymentId,
    p_reason: reason,
  })

  if (error) throw new Error(errorMessage(error))
}
