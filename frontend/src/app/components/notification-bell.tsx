import { Bell } from 'lucide-react'
import * as React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { unreadNotificationCount } from '@/features/notifications/api'

/**
 * Topbar shortcut to the notification page. The unread count reloads whenever
 * the route changes, so returning from the page immediately clears the badge.
 */
export function NotificationBell() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [unread, setUnread] = React.useState(0)

  React.useEffect(() => {
    let active = true

    void unreadNotificationCount()
      .then((count) => {
        if (active) setUnread(count)
      })
      .catch(() => {
        if (active) setUnread(0)
      })

    return () => {
      active = false
    }
  }, [pathname])

  return (
    <Button
      variant="ghost"
      size="icon"
      className="relative"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      onClick={() => navigate('/notifications')}
    >
      <Bell aria-hidden="true" />
      {unread > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-4 text-accent-foreground">
          {unread > 9 ? '9+' : unread}
        </span>
      ) : null}
    </Button>
  )
}
