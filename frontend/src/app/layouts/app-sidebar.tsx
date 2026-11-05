import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react'
import { NavLink, Link } from 'react-router-dom'

import { Brand } from '@/app/components/brand'
import { modulesFor, type AppModule } from '@/app/navigation'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useSession } from '@/features/auth/session-context'
import { ROLE_LABELS } from '@/features/auth/types'
import { cn } from '@/lib/cn'
import { getInitials } from '@/lib/format'

export interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
}

function SidebarLink({ module, collapsed }: { module: AppModule; collapsed: boolean }) {
  const Icon = module.icon

  return (
    <NavLink
      to={module.path}
      end={module.path === '/'}
      title={collapsed ? module.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] transition-colors duration-base',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-surface-2 font-medium text-text'
            : 'text-text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-1.5 left-0 w-0.5 rounded-pill bg-accent transition-transform duration-base ease-arena',
              isActive ? 'scale-y-100' : 'scale-y-0',
            )}
          />
          <Icon
            className={cn(
              'size-4 shrink-0 transition-colors duration-fast',
              isActive ? 'text-accent' : 'text-text-faint group-hover:text-text-muted',
            )}
            aria-hidden="true"
          />
          {collapsed ? (
            <span className="sr-only">{module.label}</span>
          ) : (
            <span className="truncate">{module.label}</span>
          )}
        </>
      )}
    </NavLink>
  )
}

function GroupLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  return (
    <p
      className={cn(
        'px-2.5 pb-1.5 pt-3 text-[9px] font-semibold uppercase tracking-[0.18em] text-text-faint',
        collapsed && 'sr-only',
      )}
    >
      {children}
    </p>
  )
}

/**
 * Desktop sidebar. Collapses to a 64px icon rail; the choice is remembered.
 * Items come from the shared module list, already filtered by the account's
 * combined roles. The footer is the account's "court pass": who you are and
 * what you may open, without inventing numbers the session does not have.
 */
export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const { user } = useSession()
  const modules = modulesFor(user?.roles ?? [])
  const mainModules = modules.filter((module) => module.group === 'main')
  const adminModules = modules.filter((module) => module.group === 'admin')

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface-1 lg:flex',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-border',
          collapsed ? 'justify-center px-2' : 'px-3',
        )}
      >
        <Brand compact={collapsed} />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto p-2">
        <GroupLabel collapsed={collapsed}>Court</GroupLabel>
        <ul className="flex flex-col gap-0.5">
          {mainModules.map((module) => (
            <li key={module.path}>
              <SidebarLink module={module} collapsed={collapsed} />
            </li>
          ))}
        </ul>

        {adminModules.length > 0 ? (
          <>
            <div className={cn('mx-1 my-3 h-px bg-border', collapsed && 'mx-2')} />
            <GroupLabel collapsed={collapsed}>Control room</GroupLabel>
            <ul className="flex flex-col gap-0.5">
              {adminModules.map((module) => (
                <li key={module.path}>
                  <SidebarLink module={module} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </nav>

      <div className="border-t border-border p-2">
        {user && !collapsed ? (
          <Link
            to="/profile"
            className="group mb-2 flex items-center gap-2.5 rounded-sm border border-border bg-surface-2 px-2.5 py-2 transition-colors duration-fast hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <Avatar size="sm" className="size-7 text-[10px]">
              <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium text-text">{user.name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.1em] text-text-faint">
                <ShieldCheck className="size-2.5 text-accent" aria-hidden="true" />
                {user.roles.map((role) => ROLE_LABELS[role]).join(' · ')}
              </span>
            </span>
          </Link>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-text-muted transition-colors duration-fast',
            'hover:bg-surface-2 hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
            collapsed && 'justify-center px-0',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden="true" />
          )}
          {collapsed ? null : <span className="text-[13px]">Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
