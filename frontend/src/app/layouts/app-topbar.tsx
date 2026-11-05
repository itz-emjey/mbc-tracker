import { useLocation } from 'react-router-dom'

import { Brand } from '@/app/components/brand'
import { NotificationBell } from '@/app/components/notification-bell'
import { UserMenu } from '@/app/components/user-menu'
import { findModule } from '@/app/navigation'
import { cn } from '@/lib/cn'

export interface AppTopbarProps {
  /** True on desktop when the sidebar is collapsed to its icon rail. */
  showContext: boolean
}

export function AppTopbar({ showContext }: AppTopbarProps) {
  const { pathname } = useLocation()
  const currentModule = findModule(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg px-4 backdrop-blur-sm sm:px-6">
      <div className="min-w-0 lg:hidden">
        <Brand showClub={false} />
      </div>

      <div className={cn('hidden min-w-0 items-center gap-2', showContext && 'lg:flex')}>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-faint">
          MBC
        </span>
        <span aria-hidden="true" className="text-text-faint">
          /
        </span>
        <p className="truncate text-sm text-text-muted">{currentModule?.label ?? 'Arena'}</p>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  )
}
