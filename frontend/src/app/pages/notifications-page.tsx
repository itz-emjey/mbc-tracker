import { Bell, CheckCheck, Trophy } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { SectionHeading } from '@/components/arena/arena-ui'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/features/auth/api'
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/api'
import type { NotificationRecord } from '@/features/notifications/types'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'

function isTournamentNotice(type: string): boolean {
  return type.startsWith('tournament') || type.startsWith('entry')
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = React.useState<NotificationRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [marking, setMarking] = React.useState(false)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true

    void listNotifications()
      .then((rows) => {
        if (active) setNotifications(rows)
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
  }, [reloadKey])

  const unread = notifications.filter((notification) => notification.read_at === null).length
  const tournamentCount = notifications.filter((notification) =>
    isTournamentNotice(notification.type),
  ).length

  async function handleOpen(notification: NotificationRecord) {
    if (notification.read_at === null) {
      try {
        await markNotificationRead(notification.id)
        setNotifications((current) =>
          current.map((row) =>
            row.id === notification.id ? { ...row, read_at: new Date().toISOString() } : row,
          ),
        )
      } catch (markError) {
        toast.error(errorMessage(markError))
      }
    }

    if (notification.link_path) navigate(notification.link_path)
  }

  async function handleMarkAll() {
    setMarking(true)

    try {
      const marked = await markAllNotificationsRead()
      const stamp = new Date().toISOString()
      setNotifications((current) =>
        current.map((row) => (row.read_at === null ? { ...row, read_at: stamp } : row)),
      )
      toast.success(
        marked === 1 ? 'Notification marked read.' : `${marked} notifications marked read.`,
      )
    } catch (markError) {
      toast.error(errorMessage(markError))
    } finally {
      setMarking(false)
    }
  }

  return (
    <>
      <PageHeader
        kicker="Activity"
        title="Notifications"
        description="Tournament announcements, partner invitations, and payment confirmations land here."
        stats={[
          { label: 'Unread', value: String(unread) },
          { label: 'All activity', value: String(notifications.length) },
          { label: 'Tournaments', value: String(tournamentCount) },
          { label: 'Read', value: String(Math.max(0, notifications.length - unread)) },
        ]}
        actions={
          notifications.length > 0 ? (
            <Button
              variant="secondary"
              onClick={() => void handleMarkAll()}
              loading={marking}
              disabled={unread === 0}
            >
              <CheckCheck aria-hidden="true" />
              Mark all read
            </Button>
          ) : null
        }
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not load notifications"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <div className="mt-6">
        <SectionHeading
          index="01"
          title="Latest activity"
          description="Newest first. Opening a notification marks it read."
        />
      </div>

      <div className="mt-4">
        {loading ? (
          <LoadingState label="Loading notifications" rows={5} />
        ) : error ? null : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="When a tournament is published or a partner invites you, it will show up here."
          />
        ) : (
          <ul className="mt-1 divide-y divide-border">
            {notifications.map((notification) => {
              const tournament = isTournamentNotice(notification.type)

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpen(notification)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-fast hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-ring',
                      notification.read_at === null && 'bg-accent-soft',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid size-8 shrink-0 place-items-center rounded-sm border border-border',
                        tournament ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-text-muted',
                      )}
                    >
                      {tournament ? (
                        <Trophy className="size-4" aria-hidden="true" />
                      ) : (
                        <Bell className="size-4" aria-hidden="true" />
                      )}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium text-text">{notification.title}</span>
                        <span className="shrink-0 font-mono text-[10px] text-text-faint">
                          {formatDateTime(notification.created_at)}
                        </span>
                      </span>

                      {notification.body ? (
                        <span className="mt-1 block text-[13px] leading-relaxed text-text-muted">
                          {notification.body}
                        </span>
                      ) : null}
                    </span>

                    {notification.read_at === null ? (
                      <span className="mt-1.5 shrink-0">
                        <Badge tone="accent">New</Badge>
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}
