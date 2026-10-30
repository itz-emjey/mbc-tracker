import * as React from 'react'

import { cn } from '@/lib/cn'

const fieldBase = [
  'w-full rounded-md border bg-surface-2 px-3 text-sm text-text',
  'transition-colors duration-fast placeholder:text-text-faint',
  'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
  'disabled:cursor-not-allowed disabled:opacity-50',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:border-danger aria-[invalid=true]:focus-visible:ring-danger-ring',
].join(' ')

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input ref={ref} type={type} className={cn(fieldBase, 'h-9 py-1', className)} {...props} />
    )
  },
)

export { Input, fieldBase }
