import { useLocation } from 'react-router-dom'

import { Brand } from '@/app/components/brand'
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
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg px-4 sm:px-6">
      <div className="min-w-0 lg:hidden">
        <Brand showClub={false} />
      </div>

      <p className={cn('hidden truncate text-sm text-text-muted', showContext && 'lg:block')}>
        {currentModule?.label ?? 'MBC Arena'}
      </p>

      <div className="ml-auto flex items-center gap-2">
        <UserMenu />
      </div>
    </header>
  )
}
