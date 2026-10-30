import { useLocation } from 'react-router-dom'

import { Brand } from '@/app/components/brand'
import { UserMenu } from '@/app/components/user-menu'
import { findModule } from '@/app/navigation'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/features/auth/session-context'
import { cn } from '@/lib/cn'

export interface AppTopbarProps {
  /** True on desktop when the sidebar is collapsed to its icon rail. */
  showContext: boolean
}

export function AppTopbar({ showContext }: AppTopbarProps) {
  const { pathname } = useLocation()
  const { dev } = useSession()
  const currentModule = findModule(pathname)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg px-4 sm:px-6">
      <div className="min-w-0 lg:hidden">
        <Brand showClub={false} />
      </div>

      <p className={cn('hidden truncate text-sm text-text-muted', showContext && 'lg:block')}>
        {currentModule?.label ?? 'MBC Arena'}
      </p>

      <div className="ml-auto flex items-center gap-2">
        {dev ? (
          <Badge tone="warning" title="A development persona is active. This is not a real login.">
            Dev session
          </Badge>
        ) : null}

        <UserMenu />
      </div>
    </header>
  )
}
