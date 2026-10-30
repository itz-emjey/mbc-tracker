import { createBrowserRouter } from 'react-router-dom'

import { RequireApproved } from '@/app/guards/require-approved'
import { RequireAuth } from '@/app/guards/require-auth'
import { RequireRole } from '@/app/guards/require-role'
import { AppShell } from '@/app/layouts/app-shell'
import { APP_MODULES } from '@/app/navigation'
import { ModulePage } from '@/app/pages/module-page'
import { NotFoundPage } from '@/app/pages/not-found-page'
import { OverviewPage } from '@/app/pages/overview-page'
import { PendingPage } from '@/app/pages/pending-page'
import { SignInPage } from '@/app/pages/sign-in-page'
import { UnauthorizedPage } from '@/app/pages/unauthorized-page'
import { RouteError } from '@/app/states/route-error'

/**
 * Module routes are generated from the same list that builds the navigation.
 * A module can never appear in a menu without a guarded route behind it, and a
 * guard can never drift from the menu's role rules.
 */
const moduleRoutes = APP_MODULES.filter((module) => module.path !== '/').map((module) => ({
  path: module.path.slice(1),
  element: (
    <RequireRole roles={module.roles}>
      <ModulePage module={module} />
    </RequireRole>
  ),
}))

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/pending', element: <PendingPage /> },
      { path: '/unauthorized', element: <UnauthorizedPage /> },
      {
        path: '/',
        element: (
          <RequireAuth>
            <RequireApproved>
              <AppShell />
            </RequireApproved>
          </RequireAuth>
        ),
        children: [
          { index: true, element: <OverviewPage /> },
          ...moduleRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
