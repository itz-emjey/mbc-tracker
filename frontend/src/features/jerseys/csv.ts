/**
 * Order export.
 *
 * The CSV is built in the browser from rows the staff member can already read;
 * there is no export endpoint and no extra storage. Pure builder, so quoting is
 * testable.
 */

export interface JerseyOrderCsvRow {
  player: string
  design: string
  size: string
  quantity: number
}

function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}

/** `"""Salazar, Ana"""`-safe CSV with a header row and a trailing newline. */
export function ordersToCsv(rows: readonly JerseyOrderCsvRow[]): string {
  const header = ['Player', 'Design', 'Size', 'Quantity']
  const lines = rows.map((row) => [
    escapeField(row.player),
    escapeField(row.design),
    escapeField(row.size),
    String(row.quantity),
  ])

  return [header, ...lines].map((line) => line.join(',')).join('\n') + '\n'
}

/** Triggers a download through a temporary object URL. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  anchor.click()

  URL.revokeObjectURL(url)
}
