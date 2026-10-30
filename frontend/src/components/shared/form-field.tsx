import * as React from 'react'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/cn'

export interface FormFieldRenderProps {
  id: string
  'aria-describedby': string | undefined
  'aria-invalid': boolean | undefined
  disabled: boolean | undefined
}

export interface FormFieldProps {
  id: string
  label: string
  /** Helper text shown under the control. */
  description?: string
  /** Validation message. Presence of a value marks the control invalid. */
  error?: string
  required?: boolean
  disabled?: boolean
  className?: string
  /**
   * Render prop so the control always receives the correct `id`,
   * `aria-describedby`, and `aria-invalid` — accessibility cannot be forgotten.
   */
  children: (props: FormFieldRenderProps) => React.ReactNode
}

export function FormField({
  id,
  label,
  description,
  error,
  required = false,
  disabled = false,
  className,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </Label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        disabled,
      })}

      {description ? (
        <p id={descriptionId} className="text-xs text-text-faint">
          {description}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
