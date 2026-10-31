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
  // info (system-decided)
  'auto-approved': 'info',
} as const satisfies Record<string, StatusTone>

export type Status = keyof typeof STATUS_TONES

export function isKnownStatus(value: string): value is Status {
  return Object.prototype.hasOwnProperty.call(STATUS_TONES, value)
}

export function statusTone(status: string): StatusTone {
  return isKnownStatus(status) ? STATUS_TONES[status] : 'neutral'
}

/** `pending` → `Pending`, `auto-approved` → `Auto-approved`. */
export function statusLabel(status: string): string {
  if (!status) return ''

  return status.charAt(0).toUpperCase() + status.slice(1)
}
