/**
 * Status vocabulary shared by every module.
 * Fixed set from PLAN.md §3.4 — do not invent new labels in components.
 */

export type StatusTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'info'

const STATUS_TONES = {
  // neutral
  draft: 'neutral',
  archived: 'neutral',
  inactive: 'neutral',
  cancelled: 'neutral',
  completed: 'neutral',
  // accent (positive, live, settled)
  active: 'accent',
  open: 'accent',
  published: 'accent',
  registered: 'accent',
  confirmed: 'accent',
  accepted: 'accent',
  paid: 'accent',
  // warning (waiting on someone)
  pending: 'warning',
  partial: 'warning',
  disputed: 'warning',
  suspended: 'warning',
  // danger
  unpaid: 'danger',
  rejected: 'danger',
  overdue: 'danger',
  deactivated: 'danger',
  disqualified: 'danger',
  // info (system-decided)
  'auto-approved': 'info',
  in_progress: 'info',
  waived: 'info',
} as const satisfies Record<string, StatusTone>

export type Status = keyof typeof STATUS_TONES

export function isKnownStatus(value: string): value is Status {
  return Object.prototype.hasOwnProperty.call(STATUS_TONES, value)
}

export function statusTone(status: string): StatusTone {
  return isKnownStatus(status) ? STATUS_TONES[status] : 'neutral'
}

/** `pending` → `Pending`, `auto-approved` → `Auto-approved`, `in_progress` → `In progress`. */
export function statusLabel(status: string): string {
  if (!status) return ''

  const words = status.replace(/_/g, ' ')

  return words.charAt(0).toUpperCase() + words.slice(1)
}
