/**
 * Payment receipt file rules.
 *
 * Bytes live in the private `payment-receipts` Storage bucket. The uploader's
 * session writes the object; the database validates the path shape again in
 * `submit_payment_receipt`, so a client cannot point a receipt at another
 * member's upload. Everything here is pure and testable without a network.
 */

export const RECEIPT_BUCKET = 'payment-receipts'
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024
export const RECEIPT_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf'

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Only the fields the rules read, so a plain object can be tested. */
export interface ReceiptFile {
  name: string
  type: string
  size: number
}

/** `null` when the file is usable, otherwise a member-facing message. */
export function validateReceiptFile(file: ReceiptFile): string | null {
  if (!(file.type in EXTENSIONS)) {
    return 'Choose a PNG, JPEG, WebP image, or a PDF.'
  }

  if (file.size === 0) {
    return 'That receipt file is empty.'
  }

  if (file.size > RECEIPT_MAX_BYTES) {
    return 'Receipts must be 5 MB or smaller.'
  }

  return null
}

/** `receipts/<purpose>/<profile-id>/<file-id>.<ext>`, the only path the RPC accepts. */
export function buildReceiptPath(
  purpose: string,
  profileId: string,
  fileId: string,
  type: string,
): string {
  const extension = EXTENSIONS[type]

  if (!extension) {
    throw new Error('Unsupported receipt file type.')
  }

  if (!['training', 'tournament', 'jersey'].includes(purpose)) {
    throw new Error('Unknown receipt purpose.')
  }

  if (!/^[0-9a-f-]{36}$/i.test(profileId)) {
    throw new Error('Invalid profile id.')
  }

  if (!/^[0-9a-f-]{36}$/i.test(fileId)) {
    throw new Error('Invalid receipt id.')
  }

  return `receipts/${purpose}/${profileId}/${fileId}.${extension}`
}
