import { Compass } from 'lucide-react'
import { Link } from 'react-router-dom'

import { useDocumentTitle } from '@/app/hooks/use-document-title'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'

/** 404 for unknown paths. Rendered inside the shell for signed-in accounts. */
export function NotFoundPage() {
  useDocumentTitle('Page not found')

  return (
    <>
      <PageHeader
        title="Page not found"
        description="The address does not match any page in MBC Arena."
      />

      <div className="mt-6">
        <EmptyState
          icon={Compass}
          title="404 — nothing here"
          description="Check the address, or use the navigation to pick a module. Nothing was deleted."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link to="/">Back to overview</Link>
            </Button>
          }
        />
      </div>
    </>
  )
}
