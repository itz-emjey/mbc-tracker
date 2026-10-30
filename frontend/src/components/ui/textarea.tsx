import * as React from 'react'

import { fieldBase } from '@/components/ui/input'
import { cn } from '@/lib/cn'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, 'min-h-20 resize-y py-2 leading-relaxed', className)}
      {...props}
    />
  )
})

export { Textarea }
