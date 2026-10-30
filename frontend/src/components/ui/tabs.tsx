import * as TabsPrimitive from '@radix-ui/react-tabs'
import * as React from 'react'

import { cn } from '@/lib/cn'

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        'inline-flex items-center gap-1 border-b border-border text-sm text-text-muted',
        className,
      )}
      {...props}
    />
  )
})

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative -mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium',
        'transition-colors duration-fast hover:text-text',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        'data-[state=active]:border-accent data-[state=active]:text-text',
        className,
      )}
      {...props}
    />
  )
})

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'mt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
        className,
      )}
      {...props}
    />
  )
})

export { Tabs, TabsList, TabsTrigger, TabsContent }
