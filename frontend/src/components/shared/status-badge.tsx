import { Badge } from '@/components/ui/badge'
import { statusLabel, statusTone } from '@/lib/status'

export interface StatusBadgeProps {
  /** A value from the shared status vocabulary in `lib/status.ts`. */
  status: string
  className?: string
}

/** Renders any status with the correct tone and label — never hardcode colours. */
export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {statusLabel(status)}
    </Badge>
  )
}
