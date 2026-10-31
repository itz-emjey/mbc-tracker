import { AlertTriangle } from 'lucide-react'
import * as React from 'react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

export interface ConfirmDialogProps {
  trigger: React.ReactNode
  title: string
  /** What exactly will happen. Destructive dialogs must say what is affected. */
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  onConfirm: () => void | Promise<void>
}

/**
 * Confirmation for destructive or irreversible actions.
 * Stays open while the action runs so a failure can be reported in place.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      await onConfirm()
      setOpen(false)
    } catch (confirmError) {
      setError(
        confirmError instanceof Error && confirmError.message.trim()
          ? confirmError.message
          : 'The action could not be completed. Try again.',
      )
    } finally {
      setPending(false)
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen)
    if (!nextOpen) setError(null)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-danger-soft">
              <AlertTriangle className="size-4 text-danger" aria-hidden="true" />
            </span>
            <div>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              <AlertDialogDescription className="mt-1">{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {error ? (
          <p role="alert" className="mt-3 text-sm leading-relaxed text-danger">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
