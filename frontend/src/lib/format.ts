/**
 * Small, pure display helpers. No formatting rule here is a business rule;
 * anything financial or SP-related stays server-side.
 */

/** `"Maria Santos"` → `"MS"`, `"Bong"` → `"B"`, `""` → `"?"`. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'

  const first = parts[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? '') : ''

  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

/** Formats a `YYYY-MM-DD` date for display without shifting it across time zones. */
export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

/** A single date when both ends match, otherwise `"start – end"`. */
export function formatDateRange(start: string, end: string): string {
  return start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
}

/** Formats a timestamp with its local time; invalid values stay readable. */
export function formatDateTime(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}
