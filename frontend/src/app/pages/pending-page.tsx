import { Clock } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import { AuthLayout } from '@/app/layouts/auth-layout'
import { Button } from '@/components/ui/button'
import { useSession } from '@/features/auth/session-context'

/** Shown to registered accounts that a Super Admin has not approved yet. */
export function PendingPage() {
  const { user, signOut } = useSession()

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  if (user.status === 'approved') {
    return <Navigate to="/" replace />
  }

  if (user.status === 'suspended') {
    return <Navigate to="/unauthorized" replace state={{ reason: 'suspended' }} />
  }

  return (
    <AuthLayout
      title="Account awaiting approval"
      description="A Super Admin needs to approve this registration before it can open club modules."
    >
      <div className="rounded-md border border-border bg-surface-1 p-5">
        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-text">{user.name}</p>
            <p className="mt-0.5 text-xs text-text-muted">{user.email}</p>
            <p className="mt-3 text-sm leading-relaxed text-text-muted">
              Nothing is wrong with the request — approval is a manual club step. You will be able
              to sign in normally once it is done.
            </p>
          </div>
        </div>

        <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    </AuthLayout>
  )
}
