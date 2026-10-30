import { RefreshCw } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

import { Brand } from '@/app/components/brand'
import { useDocumentTitle } from '@/app/hooks/use-document-title'
import { Button } from '@/components/ui/button'

/**
 * Route-level error boundary.
 * Shows a plain-language message and a way out; raw error details stay in the
 * console rather than on screen.
 */
export function RouteError() {
  const error = useRouteError()
  useDocumentTitle('Something went wrong')

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : 'An unexpected error stopped this screen from rendering.'

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10">
      <div className="w-full max-w-md">
        <Brand />

        <h1 className="mt-8 text-xl font-semibold tracking-tight text-text">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
          {detail} The rest of the club workspace is unaffected — reload or go back to the overview.
        </p>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button size="sm" className="flex-1" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />
            Reload
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={() => window.location.assign('/')}
          >
            Go to overview
          </Button>
        </div>

        <p className="mt-6 text-xs leading-relaxed text-text-faint">
          Route guards decide what the interface shows. Data access is enforced separately by
          database row-level security.
        </p>
      </div>
    </div>
  )
}
