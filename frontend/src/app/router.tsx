import { createBrowserRouter } from 'react-router-dom'

import { RequireApproved } from '@/app/guards/require-approved'
import { RequireAuth } from '@/app/guards/require-auth'
import { RequireRole } from '@/app/guards/require-role'
import { AppShell } from '@/app/layouts/app-shell'
import { APP_MODULES } from '@/app/navigation'
import { AdminPage } from '@/app/pages/admin-page'
import { AnnouncementsPage } from '@/app/pages/announcements-page'
import { FriendlyMatchesPage } from '@/app/pages/friendly-matches-page'
import { ModulePage } from '@/app/pages/module-page'
import { NotFoundPage } from '@/app/pages/not-found-page'
import { OverviewPage } from '@/app/pages/overview-page'
import { PendingPage } from '@/app/pages/pending-page'
import { PlayerProfilePage } from '@/app/pages/player-profile-page'
import { PlayersPage } from '@/app/pages/players-page'
import { RegisterPage } from '@/app/pages/register-page'
import { ShuttlepowerPage } from '@/app/pages/shuttlepower-page'
import { SignInPage } from '@/app/pages/sign-in-page'
import { JerseysPage } from '@/app/pages/jerseys-page'
import { PaymentsPage } from '@/app/pages/payments-page'
import { PollsPage } from '@/app/pages/polls-page'
import { TournamentDetailPage } from '@/app/pages/tournament-detail-page'
import { TournamentsPage } from '@/app/pages/tournaments-page'
import { TrainingPage } from '@/app/pages/training-page'
import { UnauthorizedPage } from '@/app/pages/unauthorized-page'
import { RouteError } from '@/app/states/route-error'
import { TOURNAMENT_STAFF_ROLES } from '@/features/tournaments/types'

/**
 * Module routes are generated from the same list that builds the navigation.
 * A module can never appear in a menu without a guarded route behind it, and a
 * guard can never drift from the menu's role rules.
 */
const moduleRoutes = APP_MODULES.filter((module) => module.path !== '/').map((module) => ({
  path: module.path.slice(1),
  element: (
    <RequireRole roles={module.roles}>
      {module.path === '/admin' ? (
        <AdminPage />
      ) : module.path === '/players' ? (
        <PlayersPage />
      ) : module.path === '/tournaments' ? (
        <TournamentsPage />
      ) : module.path === '/shuttlepower' ? (
        <ShuttlepowerPage />
      ) : module.path === '/matches' ? (
        <FriendlyMatchesPage />
      ) : module.path === '/training' ? (
        <TrainingPage />
      ) : module.path === '/payments' ? (
        <PaymentsPage />
      ) : module.path === '/jerseys' ? (
        <JerseysPage />
      ) : module.path === '/polls' ? (
        <PollsPage />
      ) : module.path === '/announcements' ? (
        <AnnouncementsPage />
      ) : (
        <ModulePage module={module} />
      )}
    </RequireRole>
  ),
}))

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/sign-in', element: <SignInPage /> },
      { path: '/register', element: <RegisterPage /> },
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
          {
            path: 'tournaments/:id',
            element: (
              <RequireRole roles={TOURNAMENT_STAFF_ROLES}>
                <TournamentDetailPage />
              </RequireRole>
            ),
          },
          {
            path: 'players/:id',
            element: (
              <RequireRole>
                <PlayerProfilePage />
              </RequireRole>
            ),
          },
          {
            path: 'profile',
            element: (
              <RequireRole>
                <PlayerProfilePage self />
              </RequireRole>
            ),
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
