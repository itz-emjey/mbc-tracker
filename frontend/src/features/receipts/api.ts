import { errorMessage } from '@/features/auth/api'
import type { PaymentMethod } from '@/features/training/types'
import { getSupabaseClient } from '@/lib/supabase'

import { buildReceiptPath, RECEIPT_BUCKET, validateReceiptFile } from './files'
import type { ReceiptPurpose } from './types'

export interface PendingJerseyReceiptRecord {
  id: string
  jersey_payment_id: string | null
}

/**
 * Pending jersey proof. RLS scopes a member to their own rows; jersey staff see
 * every pending jersey receipt, which the review queue will use later.
 */
export async function listPendingJerseyReceipts(): Promise<PendingJerseyReceiptRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('payment_receipts')
    .select('id, jersey_payment_id')
    .eq('purpose', 'jersey')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as PendingJerseyReceiptRecord[]
}

export interface SubmitReceiptInput {
  purpose: ReceiptPurpose
  /** The fee row being settled: `jersey_order_payments.id` for a jersey order. */
  targetId: string
  amount: number
  method: PaymentMethod
  referenceNo: string | null
  /** `YYYY-MM-DD`; the RPC rejects future dates. */
  paidOn: string
  file: File
  profileId: string
}

/**
 * Uploads the proof, then submits it for review. The target stays unpaid until
 * staff accept it. A rejected submission removes the orphaned upload so the
 * bucket does not collect files no receipt points at.
 */
export async function submitPaymentReceipt(input: SubmitReceiptInput): Promise<void> {
  const problem = validateReceiptFile(input.file)

  if (problem) throw new Error(problem)

  if (!input.profileId) throw new Error('Sign in again to submit a receipt.')

  const client = getSupabaseClient()
  const path = buildReceiptPath(
    input.purpose,
    input.profileId,
    crypto.randomUUID(),
    input.file.type,
  )

  const { error: uploadError } = await client.storage
    .from(RECEIPT_BUCKET)
    .upload(path, input.file, { contentType: input.file.type, upsert: false })

  if (uploadError) throw new Error(errorMessage(uploadError))

  try {
    const { error } = await client.rpc('submit_payment_receipt', {
      p_purpose: input.purpose,
      p_target_id: input.targetId,
      p_amount: input.amount,
      p_method: input.method,
      p_reference_no: input.referenceNo,
      p_paid_on: input.paidOn,
      p_receipt_path: path,
    })

    if (error) throw new Error(errorMessage(error))
  } catch (submitError) {
    await client.storage
      .from(RECEIPT_BUCKET)
      .remove([path])
      .catch(() => undefined)

    throw submitError
  }
}
