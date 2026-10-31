import { CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react'
import * as React from 'react'
import { Navigate } from 'react-router-dom'
import { toast } from 'sonner'

import { AuthLayout } from '@/app/layouts/auth-layout'
import { AppLoading } from '@/app/states/app-loading'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  errorMessage,
  getLatestRegistrationRequest,
  submitRegistration,
  type RegistrationRequestSummary,
} from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

/** Shown to registered accounts that a Super Admin has not approved yet. */
export function PendingPage() {
  const { status, user, signOut, refresh } = useSession()
  const [request, setRequest] = React.useState<RegistrationRequestSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const loadRequest = React.useCallback(async () => {
    if (!user) return

    const next = await getLatestRegistrationRequest(user.id)
    setRequest(next)
  }, [user])

  React.useEffect(() => {
    if (!user) return

    let active = true

    void getLatestRegistrationRequest(user.id)
      .then((next) => {
        if (active) setRequest(next)
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user])

  if (status === 'loading') {
    return <AppLoading label="Checking registration status" />
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />
  }

  if (user.status === 'approved') {
    return <Navigate to="/" replace />
  }

  if (user.status === 'suspended' || user.status === 'deactivated') {
    return <Navigate to="/unauthorized" replace state={{ reason: user.status }} />
  }

  async function handleCheck() {
    setChecking(true)
    setError(null)

    try {
      await refresh()
      await loadRequest()
    } catch (checkError) {
      setError(errorMessage(checkError))
    } finally {
      setChecking(false)
    }
  }

  async function handleResubmit() {
    if (!user) return

    setSubmitting(true)
    setError(null)

    try {
      await submitRegistration(user.name)
      await loadRequest()
      toast.success('A fresh registration request has been submitted.')
    } catch (submitError) {
      const message = errorMessage(submitError)
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const rejected = request?.status === 'rejected'

  return (
    <AuthLayout
      title={rejected ? 'Registration not approved' : 'Account awaiting approval'}
      description={
        rejected
          ? 'A Super Admin reviewed this registration and did not approve it. The reason is shown below.'
          : 'A Super Admin needs to approve this registration before it can open club modules.'
      }
    >
      <div className="rounded-md border border-border bg-surface-1 p-5">
        <div className="flex items-start gap-3">
          {rejected ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
          ) : (
            <Clock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">{user.name}</p>
            <p className="mt-0.5 text-xs text-text-muted">{user.email}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge tone={rejected ? 'danger' : 'warning'}>
                {rejected ? 'Rejected' : 'Pending review'}
              </Badge>
              {request ? <StatusBadge status={request.status} /> : null}
            </div>
          </div>
        </div>

        {loading ? (
          <LoadingState className="mt-4" variant="spinner" label="Loading registration status" />
        ) : error ? (
          <ErrorState
            className="mt-4"
            title="Could not load the request"
            description={error}
            onRetry={() => {
              setLoading(true)
              setError(null)
              void loadRequest()
                .catch((loadError: unknown) => setError(errorMessage(loadError)))
                .finally(() => setLoading(false))
            }}
          />
        ) : request ? (
          <div className="mt-4 rounded-sm border border-border bg-surface-2 p-3">
            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-text-faint">Requested</dt>
                <dd className="mt-0.5 text-text-muted">{formatDate(request.requested_at)}</dd>
              </div>
              {request.reviewed_at ? (
                <div>
                  <dt className="text-text-faint">Reviewed</dt>
                  <dd className="mt-0.5 text-text-muted">{formatDate(request.reviewed_at)}</dd>
                </div>
              ) : null}
            </dl>

            {rejected && request.decision_note ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-text-faint">
                  Reviewer's reason
                </p>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  {request.decision_note}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-text-muted">
                Nothing is wrong with the request — approval is a manual club step. You can check
                again after the Super Admin reviews it.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 rounded-sm border border-border bg-surface-2 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-text-muted">
                No active request was found. Submit one so a Super Admin can review the account.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2">
          {rejected || !request ? (
            <Button
              size="sm"
              className="w-full"
              loading={submitting}
              onClick={() => void handleResubmit()}
            >
              Submit registration again
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              loading={checking}
              onClick={() => void handleCheck()}
            >
              <RefreshCw aria-hidden="true" />
              Check approval status
            </Button>
          )}

          <Button variant="ghost" size="sm" className="w-full" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </div>
    </AuthLayout>
  )
}
