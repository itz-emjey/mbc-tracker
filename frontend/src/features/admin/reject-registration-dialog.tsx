import { AlertTriangle } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { FormField } from '@/components/shared/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  errorMessage,
  rejectRegistration,
  type RegistrationRequestSummary,
} from '@/features/auth/api'
import { rejectReasonSchema } from '@/features/auth/validation'

interface RejectRegistrationDialogProps {
  request: RegistrationRequestSummary | null
  onOpenChange: (open: boolean) => void
  onRejected: () => void
}

export function RejectRegistrationDialog({
  request,
  onOpenChange,
  onRejected,
}: RejectRegistrationDialogProps) {
  const [reason, setReason] = React.useState('')
  const [fieldError, setFieldError] = React.useState<string | undefined>()
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function handleReject() {
    if (!request) return

    const parsed = rejectReasonSchema.safeParse(reason)

    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? 'Enter a reason.')
      return
    }

    setFieldError(undefined)
    setFormError(null)
    setSubmitting(true)

    try {
      const result = await rejectRegistration(request.id, parsed.data)

      if (result.already_processed) {
        toast.info(`${request.full_name}'s request was already rejected.`)
      } else {
        toast.success(`${request.full_name}'s registration was rejected.`)
      }

      onRejected()
      onOpenChange(false)
    } catch (rejectError) {
      setFormError(errorMessage(rejectError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent>
        {request ? (
          <>
            <DialogHeader>
              <DialogTitle>Reject {request.full_name}</DialogTitle>
              <DialogDescription>
                {request.email} will see this reason on the pending screen and can submit a fresh
                request later. The decision is audited.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5">
              {formError ? (
                <div
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-sm border border-danger-soft bg-danger-soft px-3 py-2.5"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-danger"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-text-muted">{formError}</p>
                </div>
              ) : null}

              <FormField
                id="reject-reason"
                label="Reason"
                description="Required. Be specific enough that the member knows what to fix."
                error={fieldError}
                required
              >
                {(field) => (
                  <Textarea
                    {...field}
                    value={reason}
                    maxLength={1000}
                    placeholder="For example: the name does not match the club roster."
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </FormField>
            </div>

            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void handleReject()} loading={submitting}>
                Reject request
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
