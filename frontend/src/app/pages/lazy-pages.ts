import * as React from 'react'

/**
 * Workspace pages, loaded on demand.
 *
 * The signed-out screens stay in the entry bundle because they are what a new
 * visitor paints first; everything behind the session guard (charts, dialogs,
 * rich text, per-feature API code) is fetched when that page is opened. The
 * shell renders immediately and the outlet shows a skeleton while a chunk
 * arrives, so navigation keeps the chrome in place.
 */
function page<T extends Record<string, React.ComponentType>>(
  load: () => Promise<T>,
  name: keyof T & string,
): React.LazyExoticComponent<React.ComponentType> {
  return React.lazy(async () => {
    const module = await load()

    return { default: module[name] as React.ComponentType }
  })
}

export const OverviewPage = page(() => import('@/app/pages/overview-page'), 'OverviewPage')
export const AdminPage = page(() => import('@/app/pages/admin-page'), 'AdminPage')
export const AdminSeasonsPage = page(
  () => import('@/app/pages/admin-seasons-page'),
  'AdminSeasonsPage',
)
export const AnnouncementsPage = page(
  () => import('@/app/pages/announcements-page'),
  'AnnouncementsPage',
)
export const FriendlyMatchesPage = page(
  () => import('@/app/pages/friendly-matches-page'),
  'FriendlyMatchesPage',
)
export const JerseysPage = page(() => import('@/app/pages/jerseys-page'), 'JerseysPage')
export const NotificationsPage = page(
  () => import('@/app/pages/notifications-page'),
  'NotificationsPage',
)
export const PaymentsPage = page(() => import('@/app/pages/payments-page'), 'PaymentsPage')
export const PlayersPage = page(() => import('@/app/pages/players-page'), 'PlayersPage')

/**
 * The profile page is also rendered as `/profile`, where it takes no route
 * param, so its props are typed here rather than going through `page()`.
 */
export const PlayerProfilePage = React.lazy(async () => {
  const { PlayerProfilePage: PlayerProfile } = await import('@/app/pages/player-profile-page')

  return { default: PlayerProfile as React.ComponentType<{ self?: boolean }> }
})

export const PollsPage = page(() => import('@/app/pages/polls-page'), 'PollsPage')
export const ShuttlepowerPage = page(
  () => import('@/app/pages/shuttlepower-page'),
  'ShuttlepowerPage',
)
export const TournamentDetailPage = page(
  () => import('@/app/pages/tournament-detail-page'),
  'TournamentDetailPage',
)
export const TournamentDrawsPage = page(
  () => import('@/app/pages/tournament-draws-page'),
  'TournamentDrawsPage',
)
export const TournamentsPage = page(() => import('@/app/pages/tournaments-page'), 'TournamentsPage')
export const TrainingPage = page(() => import('@/app/pages/training-page'), 'TrainingPage')
