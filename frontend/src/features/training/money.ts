/**
 * Training and payment display helpers.
 *
 * Money stays exact: amounts are whole centavos, so every calculation rounds
 * before it is compared or shown. These helpers never decide whether a payment
 * is allowed — the database refuses overpayment — they only describe state.
 */

export type PaymentState = 'paid' | 'partial' | 'unpaid'

interface RecordedPayment {
  amount: string | number
  status: string
}

/** Parses a PostgREST numeric (`"1200.00"`) or a number, tolerating junk. */
export function toAmount(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number(value)

  return Number.isFinite(amount) ? amount : 0
}

/** Rounds to whole centavos, avoiding float drift like 0.1 + 0.2. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/** Sum of non-voided payments. A voided row stays in history but counts zero. */
export function sumRecorded(payments: readonly RecordedPayment[]): number {
  return roundMoney(
    payments
      .filter((payment) => payment.status !== 'voided')
      .reduce((total, payment) => total + toAmount(payment.amount), 0),
  )
}

export function paymentState(due: string | number, paid: string | number): PaymentState {
  const owing = roundMoney(toAmount(due))
  const settled = roundMoney(toAmount(paid))

  if (settled <= 0) return 'unpaid'
  if (settled >= owing) return 'paid'

  return 'partial'
}

export function remainingAmount(due: string | number, paid: string | number): number {
  return roundMoney(Math.max(0, toAmount(due) - toAmount(paid)))
}

/** `1200` → `"₱1,200.00"`; the club collects pesos. */
export function formatMoney(value: string | number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(toAmount(value))
}

export interface AttendanceCounts {
  present: number
  late: number
  absent: number
  excused: number
  total: number
}

export function countAttendance(statuses: readonly { status: string }[]): AttendanceCounts {
  const counts: AttendanceCounts = { present: 0, late: 0, absent: 0, excused: 0, total: 0 }

  for (const entry of statuses) {
    if (entry.status === 'present') counts.present += 1
    else if (entry.status === 'late') counts.late += 1
    else if (entry.status === 'absent') counts.absent += 1
    else if (entry.status === 'excused') counts.excused += 1

    counts.total += 1
  }

  return counts
}

/** `present` + `late` count as attended for the summary line. */
export function attendedCount(counts: AttendanceCounts): number {
  return counts.present + counts.late
}
