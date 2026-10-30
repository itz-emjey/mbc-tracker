import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge conditional class names while resolving Tailwind conflicts.
 * Required by shadcn/ui components in Group C; kept dependency-light on purpose.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
