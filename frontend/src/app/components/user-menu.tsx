import { Check, ChevronDown, LogOut, ShieldCheck } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession } from '@/features/auth/session-context'
import { ROLE_LABELS } from '@/features/auth/types'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
}

/**
 * Account menu. Shows every role the account holds, because permissions are a
 * union — an account is never "just" one role.
 */
export function UserMenu() {
  const { user, signOut, dev } = useSession()

  if (!user) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-transparent p-1 pr-1.5 text-left transition-colors duration-fast hover:border-border hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          aria-label={`Account menu for ${user.name}`}
        >
          <Avatar size="sm">
            <AvatarFallback>{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm text-text sm:block">{user.name}</span>
          <ChevronDown className="size-3.5 text-text-faint" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm font-medium text-text">{user.name}</p>
          <p className="truncate text-xs text-text-muted">{user.email}</p>

          <div className="mt-2 flex flex-wrap gap-1">
            {user.roles.map((role) => (
              <Badge key={role} tone="accent">
                {ROLE_LABELS[role]}
              </Badge>
            ))}
            {user.status !== 'approved' ? (
              <Badge tone={user.status === 'pending' ? 'warning' : 'danger'}>
                {user.status === 'pending' ? 'Pending' : 'Suspended'}
              </Badge>
            ) : null}
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem disabled>
          <ShieldCheck className="size-4" aria-hidden="true" />
          Profile &amp; security
          <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-text-faint">
            Soon
          </span>
        </DropdownMenuItem>

        {dev ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Development session</DropdownMenuLabel>
            <p className="px-2.5 pb-1 text-[11px] leading-relaxed text-warning">
              Not authentication. A persona switch is a local shortcut for building the UI.
            </p>
            <div className="max-h-56 overflow-y-auto">
              {dev.personas.map((persona) => (
                <DropdownMenuCheckboxItem
                  key={persona.id}
                  checked={persona.id === dev.personaId}
                  onCheckedChange={() => dev.switchTo(persona.id)}
                >
                  <span className="flex flex-col">
                    <span className="text-sm text-text">{persona.label}</span>
                    <span className="text-[11px] text-text-faint">{persona.description}</span>
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          </>
        ) : null}

        <DropdownMenuSeparator />

        <DropdownMenuItem destructive onSelect={() => signOut()}>
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>

        {dev ? (
          <p className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.08em] text-text-faint">
            <Check className="size-3" aria-hidden="true" />
            Dev build
          </p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
