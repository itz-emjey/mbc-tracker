import * as React from 'react'

import { cn } from '@/lib/cn'

/**
 * Table primitives. The wrapper owns horizontal scrolling on small screens so
 * the page never scrolls sideways; pages that need a stacked layout below
 * `md` compose their own cards from the same data.
 */
const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement> & { containerClassName?: string }
>(function Table({ className, containerClassName, ...props }, ref) {
  return (
    <div
      className={cn('w-full overflow-x-auto rounded-md border border-border', containerClassName)}
    >
      <table
        ref={ref}
        className={cn('w-full caption-bottom border-collapse text-sm', className)}
        {...props}
      />
    </div>
  )
})

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableHeader({ className, ...props }, ref) {
  return <thead ref={ref} className={cn('bg-surface-2', className)} {...props} />
})

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableBody({ className, ...props }, ref) {
  return <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
})

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(function TableFooter({ className, ...props }, ref) {
  return (
    <tfoot
      ref={ref}
      className={cn('border-t border-border bg-surface-2 font-medium', className)}
      {...props}
    />
  )
})

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({ className, ...props }, ref) {
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b border-border transition-[background-color,box-shadow] duration-fast',
          'hover:bg-surface-2 hover:shadow-[inset_2px_0_0_0_var(--color-accent)]',
          'data-[state=selected]:bg-surface-3',
          className,
        )}
        {...props}
      />
    )
  },
)

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(function TableHead({ className, ...props }, ref) {
  return (
    <th
      ref={ref}
      scope="col"
      className={cn(
        'h-9 px-3 text-left align-middle text-[10px] font-semibold uppercase tracking-[0.12em] text-text-faint',
        className,
      )}
      {...props}
    />
  )
})

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(function TableCell({ className, ...props }, ref) {
  return <td ref={ref} className={cn('px-3 py-3 align-middle text-sm', className)} {...props} />
})

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(function TableCaption({ className, ...props }, ref) {
  return <caption ref={ref} className={cn('mt-2 text-xs text-text-faint', className)} {...props} />
})

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption }
