import { LogOut, MoreHorizontal } from 'lucide-react'
import * as React from 'react'
import { NavLink } from 'react-router-dom'

import { modulesFor, type AppModule } from '@/app/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSession } from '@/features/auth/session-context'
import { ROLE_LABELS } from '@/features/auth/types'
import { cn } from '@/lib/cn'

const PRIMARY_SLOTS = 4

function MobileLink({ module }: { module: AppModule }) {
  const Icon = module.icon

  return (
    <NavLink
      to={module.path}
      end={module.path === '/'}
      className={({ isActive }) =>
        cn(
          'flex h-full flex-col items-center justify-center gap-1 px-1 text-[10px] transition-colors duration-fast',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-inset',
          isActive ? 'text-accent' : 'text-text-muted hover:text-text',
        )
      }
    >
      <Icon className="size-5" aria-hidden="true" />
      <span className="truncate">{module.shortLabel}</span>
    </NavLink>
  )
}

/**
 * Mobile navigation: a bottom bar with the four most-used modules for this
 * account plus a "More" sheet. Visibility still comes from the same role
 * filter as the sidebar.
 */
export function MobileNav() {
  const { user, signOut } = useSession()
  const [moreOpen, setMoreOpen] = React.useState(false)
  const moreButtonRef = React.useRef<HTMLButtonElement>(null)
  const modules = modulesFor(user?.roles ?? [])
  const primary = modules.slice(0, PRIMARY_SLOTS)
  const mainModules = modules.filter((module) => module.group === 'main')
  const adminModules = modules.filter((module) => module.group === 'admin')

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="grid h-14 grid-cols-5">
          {primary.map((module) => (
            <li key={module.path}>
              <MobileLink module={module} />
            </li>
          ))}
          <li>
            <button
              ref={moreButtonRef}
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-[10px] text-text-muted transition-colors duration-fast hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring focus-visible:ring-inset"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              <span>More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            moreButtonRef.current?.focus()
          }}
        >
          <DialogHeader>
            <DialogTitle>All modules</DialogTitle>
            <DialogDescription>
              Everything this account can open with its current roles.
            </DialogDescription>
          </DialogHeader>

          <p className="mt-4 px-2.5 text-[10px] uppercase tracking-[0.12em] text-text-faint">
            Club
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {mainModules.map((module) => (
              <li key={module.path}>
                <NavLink
                  to={module.path}
                  end={module.path === '/'}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors duration-fast',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
                      isActive
                        ? 'bg-accent-soft font-medium text-accent'
                        : 'text-text-muted hover:bg-surface-2 hover:text-text',
                    )
                  }
                >
                  <module.icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{module.label}</span>
                  {module.phase ? (
                    <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-text-faint">
                      {module.phase}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>

          {adminModules.length > 0 ? (
            <>
              <p className="mt-4 px-2.5 text-[10px] uppercase tracking-[0.12em] text-text-faint">
                Administration
              </p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {adminModules.map((module) => (
                  <li key={module.path}>
                    <NavLink
                      to={module.path}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm transition-colors duration-fast',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
                          isActive
                            ? 'bg-accent-soft font-medium text-accent'
                            : 'text-text-muted hover:bg-surface-2 hover:text-text',
                        )
                      }
                    >
                      <module.icon className="size-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{module.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {user ? (
            <div className="mt-5 border-t border-border pt-4">
              <p className="text-sm font-medium text-text">{user.name}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <Badge key={role} tone="accent">
                    {ROLE_LABELS[role]}
                  </Badge>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  setMoreOpen(false)
                  signOut()
                }}
              >
                <LogOut aria-hidden="true" />
                Sign out
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
