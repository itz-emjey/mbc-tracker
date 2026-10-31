/**
 * Poll records. These mirror migration 008. Tallies come from the
 * `poll_results` RPC, which never exposes voter identities.
 */

import type { Role } from '@/features/auth/types'

export type PollMode = 'single' | 'multiple'
export type PollStatus = 'draft' | 'open' | 'closed'

/** Roles that create and close polls. */
export const POLL_STAFF_ROLES: readonly Role[] = ['super_admin', 'trainer']

export const POLL_STATUS_LABELS: Record<PollStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
}

export const POLL_MODE_LABELS: Record<PollMode, string> = {
  single: 'Single choice',
  multiple: 'Multiple choice',
}

export interface PollRecord {
  id: string
  question: string
  description: string | null
  mode: PollMode
  is_anonymous: boolean
  show_results: boolean
  status: PollStatus
  opens_at: string | null
  closes_at: string | null
  created_at: string
}

export interface PollOptionRecord {
  id: string
  poll_id: string
  label: string
  position: number
}

export interface PollResultsOption {
  id: string
  label: string
  position: number
  /** `null` while results are hidden (open poll, results not shown). */
  count: number | null
}

export interface PollResults {
  poll_id: string
  status: PollStatus
  mode: PollMode
  is_anonymous: boolean
  results_visible: boolean
  options: PollResultsOption[]
  my_option_ids: string[]
}
