import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { NavLink } from 'react-router-dom'

import { Brand } from '@/app/components/brand'
import { modulesFor, type AppModule } from '@/app/navigation'
import { useSession } from '@/features/auth/session-context'
import { cn } from '@/lib/cn'

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
          'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-accent-soft font-medium text-accent'
            : 'text-text-muted hover:bg-surface-2 hover:text-text',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? (
        <span className="sr-only">{module.label}</span>
      ) : (
        <span className="truncate">{module.label}</span>
      )}
    </NavLink>
  )
}

/**
 * Desktop sidebar. Collapses to a 64px icon rail; the choice is remembered.
 * Items come from the shared module list, already filtered by the account's
 * combined roles.
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
        <p
          className={cn(
            'px-2.5 pb-1 pt-2 text-[10px] uppercase tracking-[0.12em] text-text-faint',
            collapsed && 'sr-only',
          )}
        >
          Club
        </p>
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
            <p
              className={cn(
                'px-2.5 pb-1 text-[10px] uppercase tracking-[0.12em] text-text-faint',
                collapsed && 'sr-only',
              )}
            >
              Administration
            </p>
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
          {collapsed ? null : <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
