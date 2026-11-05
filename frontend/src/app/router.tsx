import type * as React from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { RequireApproved } from '@/app/guards/require-approved'
import { RequireAuth } from '@/app/guards/require-auth'
import { RequireRole } from '@/app/guards/require-role'
import { AppShell } from '@/app/layouts/app-shell'
import { APP_MODULES } from '@/app/navigation'
import {
  AdminPage,
  AdminSeasonsPage,
  AnnouncementsPage,
  FriendlyMatchesPage,
  JerseysPage,
  NotificationsPage,
  OverviewPage,
  PaymentsPage,
  PlayerProfilePage,
  PlayersPage,
  PollsPage,
  ShuttlepowerPage,
  TournamentDetailPage,
  TournamentDrawsPage,
  TournamentsPage,
  TrainingPage,
} from '@/app/pages/lazy-pages'
import { ModulePage } from '@/app/pages/module-page'
import { NotFoundPage } from '@/app/pages/not-found-page'
import { PendingPage } from '@/app/pages/pending-page'
import { RegisterPage } from '@/app/pages/register-page'
import { SignInPage } from '@/app/pages/sign-in-page'
import { UnauthorizedPage } from '@/app/pages/unauthorized-page'
import { RouteError } from '@/app/states/route-error'

/** Module path → page. Anything missing falls back to the module placeholder. */
const MODULE_PAGES: Record<string, React.ComponentType> = {
  '/admin': AdminPage,
  '/players': PlayersPage,
  '/tournaments': TournamentsPage,
  '/shuttlepower': ShuttlepowerPage,
  '/matches': FriendlyMatchesPage,
  '/training': TrainingPage,
  '/payments': PaymentsPage,
  '/jerseys': JerseysPage,
  '/polls': PollsPage,
  '/announcements': AnnouncementsPage,
}

/**
 * Module routes are generated from the same list that builds the navigation.
 * A module can never appear in a menu without a guarded route behind it, and a
 * guard can never drift from the menu's role rules.
 */
const moduleRoutes = APP_MODULES.filter((module) => module.path !== '/').map((module) => {
  const Page = MODULE_PAGES[module.path]

  return {
    path: module.path.slice(1),
    element: (
      <RequireRole roles={module.roles}>
        {Page ? <Page /> : <ModulePage module={module} />}
      </RequireRole>
    ),
  }
})

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
            path: 'admin/seasons',
            element: (
              <RequireRole roles={['super_admin']}>
                <AdminSeasonsPage />
              </RequireRole>
            ),
          },
          {
            path: 'tournaments/:id/draws',
            element: (
              <RequireRole>
                <TournamentDrawsPage />
              </RequireRole>
            ),
          },
          {
            path: 'tournaments/:id',
            element: (
              <RequireRole>
                <TournamentDetailPage />
              </RequireRole>
            ),
          },
          {
            path: 'notifications',
            element: (
              <RequireRole>
                <NotificationsPage />
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
