/**
 * Training and payment types.
 *
 * These mirror migration 007. They describe data, not permissions: every table
 * is SELECT-only to clients, and writes cross the audited RPCs.
 */

import type { Role } from '@/features/auth/types'

export type TrainingSessionStatus = 'scheduled' | 'completed' | 'cancelled'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type PaymentMethod = 'cash' | 'bank_transfer' | 'gcash' | 'other'
export type PaymentStatus = 'recorded' | 'voided'

/** Roles that may create sessions, mark attendance, and record payments. */
export const TRAINING_STAFF_ROLES: readonly Role[] = ['super_admin', 'trainer']

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  'present',
  'late',
  'excused',
  'absent',
]

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['cash', 'bank_transfer', 'gcash', 'other']

export const SESSION_STATUS_LABELS: Record<TrainingSessionStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  excused: 'Excused',
  absent: 'Absent',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  gcash: 'GCash',
  other: 'Other',
}

export interface TrainingSessionRecord {
  id: string
  title: string
  starts_at: string
  ends_at: string
  venue: string | null
  notes: string | null
  status: TrainingSessionStatus
  created_at: string
  updated_at: string
}

export interface TrainingAttendanceRecord {
  session_id: string
  player_id: string
  status: AttendanceStatus
  recorded_at: string
}

export interface TrainingFeePeriodRecord {
  id: string
  label: string
  starts_on: string
  ends_on: string
  /** PostgREST returns `numeric` as a string. */
  amount: string
  due_on: string | null
  created_at: string
}

export interface TrainingPaymentRecord {
  id: string
  fee_period_id: string
  player_id: string
  amount: string
  paid_on: string
  method: PaymentMethod
  status: PaymentStatus
  voided_at: string | null
  void_reason: string | null
  created_at: string
}

export interface AttendanceEntryInput {
  player_id: string
  status: AttendanceStatus
}

export interface SessionInput {
  title: string
  /** ISO timestamps; the form converts its local value first. */
  starts_at: string
  ends_at: string
  venue: string | null
  notes: string | null
}

export interface FeePeriodInput {
  label: string
  starts_on: string
  ends_on: string
  amount: number
  due_on: string | null
}

export interface PaymentInput {
  fee_period_id: string
  player_id: string
  amount: number
  paid_on: string
  method: PaymentMethod
}
