import type * as React from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/cn'
import { getInitials } from '@/lib/format'

export interface PlayerIdentityProps {
  name: string
  avatarUrl?: string
  /** Secondary line: SP, role, team, or status. Keep it short. */
  meta?: string
  size?: 'sm' | 'md' | 'lg'
  /** Slot for badges or actions, aligned to the right. */
  trailing?: React.ReactNode
  className?: string
}

/**
 * Avatar + name + optional meta line.
 * Used in leaderboards, match lists, bracket rows, and the player directory.
 */
export function PlayerIdentity({
  name,
  avatarUrl,
  meta,
  size = 'md',
  trailing,
  className,
}: PlayerIdentityProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <Avatar size={size}>
        {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{name}</p>
        {meta ? <p className="truncate text-xs text-text-muted">{meta}</p> : null}
      </div>

      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  )
}
