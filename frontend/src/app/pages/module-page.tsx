import { Link } from 'react-router-dom'

import type { AppModule } from '@/app/navigation'
import { EmptyState } from '@/components/shared/empty-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ModulePageProps {
  module: AppModule
}

/**
 * Honest placeholder for a module that is routed and guarded but not built.
 * It exists so navigation and role checks can be exercised without inventing
 * club data.
 */
export function ModulePage({ module }: ModulePageProps) {
  return (
    <>
      <PageHeader
        kicker={module.phase ? `Planned · ${module.phase}` : 'Module'}
        title={module.label}
        description={module.description}
        actions={module.phase ? <Badge tone="outline">{module.phase}</Badge> : null}
      />

      <div className="mt-6">
        <EmptyState
          icon={module.icon}
          title={`${module.label} is not built yet`}
          description={`This route, its shell layout, and its role guard are in place. The module itself arrives in ${module.phase ?? 'a later phase'} as described in PLAN.md. No club data is stored or displayed here yet.`}
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
