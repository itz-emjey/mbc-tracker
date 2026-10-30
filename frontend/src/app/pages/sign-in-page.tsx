import { AlertTriangle, ArrowRight, ShieldOff } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/app/layouts/auth-layout'
import { AppLoading } from '@/app/states/app-loading'
import { Badge } from '@/components/ui/badge'
import { useSession } from '@/features/auth/session-context'
import { ROLE_LABELS } from '@/features/auth/types'

interface SignInLocationState {
  from?: string
}

function PersonaButton({
  label,
  description,
  roles,
  status,
  onSelect,
}: {
  label: string
  description: string
  roles: string[]
  status: 'approved' | 'pending' | 'suspended'
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-3 rounded-md border border-border bg-surface-1 px-4 py-3 text-left transition-colors duration-fast hover:border-border-strong hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-text">{label}</span>
        <span className="block text-xs text-text-muted">{description}</span>
        <span className="mt-2 flex flex-wrap gap-1">
          {roles.map((role) => (
            <Badge key={role} tone="neutral">
              {role}
            </Badge>
          ))}
          {status !== 'approved' ? (
            <Badge tone={status === 'pending' ? 'warning' : 'danger'}>
              {status === 'pending' ? 'Pending' : 'Suspended'}
            </Badge>
          ) : null}
        </span>
      </span>

      <ArrowRight
        className="size-4 shrink-0 text-text-faint transition-transform duration-fast group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  )
}

/**
 * Development sign-in placeholder.
 *
 * In a production build there is no authentication yet, so this screen says so
 * and offers no way in. In development it lists local personas and states
 * plainly that they are not authentication.
 */
export function SignInPage() {
  const { status, user, dev } = useSession()
  const navigate = useNavigate()
  const location = useLocation()

  if (status === 'loading') {
    return <AppLoading label="Checking session" />
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const from = (location.state as SignInLocationState | null)?.from ?? '/'

  if (!dev) {
    return (
      <AuthLayout
        title="Sign-in is not configured"
        description="MBC Arena uses Supabase Authentication. It is wired in Group E, so this build has no way to authenticate."
      >
        <div className="flex items-start gap-3 rounded-md border border-border bg-surface-1 px-4 py-4">
          <ShieldOff className="mt-0.5 size-4 shrink-0 text-text-faint" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-text">No session available</p>
            <p className="mt-1 text-sm text-text-muted">
              Nothing in this build grants access. Protected routes stay closed until real
              authentication exists.
            </p>
          </div>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Development sign-in"
      description="Authentication is not implemented yet. Choose a development persona to preview the shell and its role-aware navigation."
    >
      <div
        role="note"
        className="flex items-start gap-3 rounded-md border border-warning-soft bg-warning-soft px-4 py-3"
      >
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-text-muted">
          <span className="font-medium text-warning">Not authentication.</span> Personas live in
          this browser only. Supabase RLS remains the authority for every real read and write.
        </p>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {dev.personas
          .filter((persona) => persona.user)
          .map((persona) => (
            <li key={persona.id}>
              <PersonaButton
                label={persona.label}
                description={persona.description}
                roles={persona.user!.roles.map((role) => ROLE_LABELS[role])}
                status={persona.user!.status}
                onSelect={() => {
                  dev.switchTo(persona.id)
                  navigate(from, { replace: true })
                }}
              />
            </li>
          ))}
      </ul>

      <p className="mt-4 text-xs leading-relaxed text-text-faint">
        This screen does not exist in a production build. Group E replaces it with Supabase Auth.
      </p>
    </AuthLayout>
  )
}
