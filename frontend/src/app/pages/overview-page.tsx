import * as React from 'react'

import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { arenaMatches, arenaRecord, rivalsNear, tierFor } from '@/domain/arena'
import { errorMessage, listPendingRegistrations } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { listAnnouncements } from '@/features/announcements/api'
import type { AnnouncementRecord } from '@/features/announcements/types'
import { listFriendlyMatches } from '@/features/friendlies/api'
import type { FriendlyMatchRecord } from '@/features/friendlies/types'
import { listJerseyOrders, listJerseyProjects } from '@/features/jerseys/api'
import type { JerseyOrderRecord, JerseyProjectRecord } from '@/features/jerseys/types'
import { getPlayerByProfile, getPlayerSp, listPlayers } from '@/features/players/api'
import type { PlayerRecord } from '@/features/players/types'
import { getPollResults, listPolls } from '@/features/polls/api'
import type { PollRecord, PollResults } from '@/features/polls/types'
import { listSpLeaderboard } from '@/features/shuttlepower/api'
import { rankLeaderboard } from '@/features/shuttlepower/leaderboard'
import type { SpLeaderboardEntry } from '@/features/shuttlepower/types'
import {
  listFeePeriods,
  listTrainingAttendance,
  listTrainingPayments,
  listTrainingSessions,
} from '@/features/training/api'
import type {
  TrainingAttendanceRecord,
  TrainingFeePeriodRecord,
  TrainingPaymentRecord,
  TrainingSessionRecord,
} from '@/features/training/types'
import { listTournaments } from '@/features/tournaments/api'
import type { TournamentRecord } from '@/features/tournaments/types'
import { formatDateTime } from '@/lib/format'

import {
  ArenaHero,
  ClubDutyPanel,
  ClubFeedPanel,
  LadderBoard,
  MatchCentrePanel,
  OperationsPanel,
  RivalsPanel,
  TournamentBoard,
  YourMovePanel,
  type FeedItem,
  type StaffSummaryRow,
} from './overview/arena-panels'
import {
  activePolls,
  attendanceSummary,
  buildAttentionItems,
  feeSummary,
  latestFeePeriod,
  nextTrainingSession,
  openJerseyProjects,
  upcomingTournaments,
} from './overview/derive'

interface OverviewData {
  player: PlayerRecord | null
  sp: number | null
  leaderboard: SpLeaderboardEntry[]
  matches: FriendlyMatchRecord[]
  players: PlayerRecord[]
  sessions: TrainingSessionRecord[]
  attendance: TrainingAttendanceRecord[]
  feePeriods: TrainingFeePeriodRecord[]
  payments: TrainingPaymentRecord[]
  announcements: AnnouncementRecord[]
  polls: PollRecord[]
  pollResults: PollResults[]
  jerseyProjects: JerseyProjectRecord[]
  jerseyOrders: JerseyOrderRecord[]
  tournaments: TournamentRecord[]
  pendingRegistrations: number
  loadedAt: number
}

/** Local calendar date, matching how the club reads date-only fields. */
function localToday(now: number): string {
  const date = new Date(now)

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export function OverviewPage() {
  const { user } = useSession()
  const [data, setData] = React.useState<OverviewData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)

  React.useEffect(() => {
    let active = true

    async function load() {
      if (!user) return

      setLoading(true)
      setError(null)

      try {
        const player = await getPlayerByProfile(user.id)
        const isSuperAdmin = hasAnyRole(user.roles, ['super_admin'])
        const loadedAt = Date.now()

        const [
          sp,
          tournaments,
          sessions,
          attendance,
          feePeriods,
          payments,
          announcements,
          polls,
          jerseyProjects,
          jerseyOrders,
          matches,
          players,
          leaderboard,
          pending,
        ] = await Promise.all([
          player ? getPlayerSp(player.id) : Promise.resolve(null),
          listTournaments(),
          listTrainingSessions(),
          listTrainingAttendance(),
          listFeePeriods(),
          listTrainingPayments(),
          listAnnouncements(),
          listPolls(),
          listJerseyProjects(),
          listJerseyOrders(),
          listFriendlyMatches(),
          listPlayers(),
          listSpLeaderboard(),
          isSuperAdmin ? listPendingRegistrations() : Promise.resolve([]),
        ])

        const currentPolls = activePolls(polls, loadedAt)
        const pollResults = await Promise.all(currentPolls.map((poll) => getPollResults(poll.id)))

        if (!active) return

        setData({
          player,
          sp,
          leaderboard,
          matches,
          players,
          sessions,
          attendance,
          feePeriods,
          payments,
          announcements,
          polls,
          pollResults,
          jerseyProjects,
          jerseyOrders,
          tournaments,
          pendingRegistrations: pending.length,
          loadedAt,
        })
      } catch (loadError) {
        if (active) setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [user, reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  if (!user) {
    return null
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Arena" />
        <LoadingState className="mt-6" label="Loading the arena" rows={6} />
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <PageHeader title="Arena" />
        <ErrorState
          className="mt-6"
          title="Could not load your arena"
          description={error ?? 'The arena data is unavailable right now.'}
          onRetry={reload}
        />
      </>
    )
  }

  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name
  const today = localToday(data.loadedAt)
  const names = new Map(data.players.map((player) => [player.id, player.full_name]))
  const ranked = rankLeaderboard(data.leaderboard)
  const ownRank = data.player ? ranked.find((row) => row.playerId === data.player?.id) : undefined

  const session = nextTrainingSession(data.sessions, data.loadedAt)
  const attendance = attendanceSummary(data.attendance, data.player?.id ?? null)
  const period = latestFeePeriod(data.feePeriods)
  const fee = period ? feeSummary(period, data.payments, data.player?.id ?? null) : null

  const currentPolls = activePolls(data.polls, data.loadedAt)
  const pollResults = new Map(data.pollResults.map((result) => [result.poll_id, result]))
  const projects = openJerseyProjects(data.jerseyProjects, data.loadedAt)
  const canActAsPlayer = data.player?.status === 'active'

  const attentionItems = buildAttentionItems({
    player: data.player,
    now: data.loadedAt,
    matches: data.matches,
    names,
    polls: currentPolls,
    pollResults,
    jerseyProjects: projects,
    jerseyOrders: data.jerseyOrders,
    feePeriod: period,
    payments: data.payments,
    tournaments: data.tournaments,
  })

  const upcoming = upcomingTournaments(data.tournaments, today)
  const record = arenaRecord(data.matches, data.player?.id ?? null)
  const matchRows = arenaMatches(data.matches, data.player?.id ?? null, data.loadedAt, 4)
  const progress = data.sp === null ? null : tierFor(data.sp)
  const rivals = data.player ? rivalsNear(ranked, data.player.id, 4) : []

  const orderedProjectIds = new Set(
    canActAsPlayer && data.player
      ? data.jerseyOrders
          .filter((order) => order.player_id === data.player?.id && order.status === 'submitted')
          .map((order) => order.project_id)
      : [],
  )

  const feed: FeedItem[] = [
    ...data.announcements
      .filter((announcement) => announcement.status === 'published')
      .slice(0, 2)
      .map((announcement) => ({
        id: `news:${announcement.id}`,
        kind: 'news' as const,
        title: announcement.title,
        description: announcement.body,
        href: '/announcements',
        meta: announcement.published_at ? formatDateTime(announcement.published_at) : null,
      })),
    ...currentPolls.slice(0, 1).map((poll) => ({
      id: `poll:${poll.id}`,
      kind: 'poll' as const,
      title: poll.question,
      description: poll.closes_at
        ? `Closes ${formatDateTime(poll.closes_at)}. One response per player unless the poll says otherwise.`
        : 'Open for responses. One response per player unless the poll says otherwise.',
      href: '/polls',
      meta: pollResults.get(poll.id)?.my_option_ids.length ? 'Voted' : 'Open',
    })),
    ...projects.slice(0, 1).map((project) => ({
      id: `jersey:${project.id}`,
      kind: 'jersey' as const,
      title: project.name,
      description: orderedProjectIds.has(project.id)
        ? 'You have an order in for this project.'
        : (project.description ?? 'Ordering is open for this project.'),
      href: '/jerseys',
      meta: project.order_deadline
        ? `Closes ${formatDateTime(project.order_deadline)}`
        : 'Ordering open',
    })),
  ]

  const staffRows: StaffSummaryRow[] = []

  if (hasAnyRole(user.roles, ['super_admin'])) {
    staffRows.push({
      id: 'registrations',
      label: 'Pending registrations',
      description: 'Accounts waiting for approval or rejection.',
      href: '/admin',
      count: data.pendingRegistrations,
    })
    staffRows.push({
      id: 'disputes',
      label: 'Disputed results',
      description: 'Friendly matches waiting for a club decision.',
      href: '/matches',
      count: data.matches.filter((match) => match.status === 'disputed').length,
    })
  }

  if (hasAnyRole(user.roles, ['tournament_manager'])) {
    staffRows.push({
      id: 'draft-tournaments',
      label: 'Draft tournaments',
      description: 'Events that are not published yet.',
      href: '/tournaments',
      count: data.tournaments.filter((tournament) => tournament.status === 'draft').length,
    })
  }

  if (hasAnyRole(user.roles, ['trainer'])) {
    staffRows.push({
      id: 'draft-announcements',
      label: 'Draft announcements',
      description: 'Club news waiting to be published.',
      href: '/announcements',
      count: data.announcements.filter((announcement) => announcement.status === 'draft').length,
    })
    staffRows.push({
      id: 'draft-polls',
      label: 'Draft polls',
      description: 'Polls not yet opened to members.',
      href: '/polls',
      count: data.polls.filter((poll) => poll.status === 'draft').length,
    })
  }

  return (
    <>
      <ArenaHero
        firstName={firstName}
        player={data.player}
        sp={data.sp}
        position={ownRank?.position ?? null}
        totalPlayers={ranked.length}
        divisionPosition={ownRank?.divisionPosition ?? null}
        record={record}
        progress={progress}
        roles={user.roles}
        status={user.status}
        waiting={attentionItems.length}
      />

      <div className="mt-8">
        <YourMovePanel items={attentionItems} />
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <MatchCentrePanel rows={matchRows} names={names} />
        <LadderBoard rows={ranked} ownPlayerId={data.player?.id ?? null} />
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-8 border-t border-border pt-8 lg:grid-cols-2">
        <TournamentBoard tournaments={upcoming} today={today} />
        <ClubDutyPanel
          session={session}
          attended={attendance.attended}
          recorded={attendance.recorded}
          periodLabel={period?.label ?? null}
          dueOn={period?.due_on ?? null}
          amount={period?.amount ?? null}
          fee={fee}
        />
      </div>

      <div className="mt-8 grid gap-x-10 gap-y-8 border-t border-border pt-8 lg:grid-cols-2">
        <RivalsPanel rivals={rivals} />
        <ClubFeedPanel items={feed} />
      </div>

      {staffRows.length > 0 ? (
        <OperationsPanel rows={staffRows} className="mt-8 border-t border-border pt-8" />
      ) : null}
    </>
  )
}
