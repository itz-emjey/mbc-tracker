import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import type { NotificationRecord } from './types'

const NOTIFICATION_COLUMNS =
  'id, profile_id, type, title, body, link_path, tournament_id, actor_profile_id, read_at, created_at'

/** The signed-in member's notifications, newest first. RLS hides everyone else's. */
export async function listNotifications(limit = 50): Promise<NotificationRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('notifications')
    .select(NOTIFICATION_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as NotificationRecord[]
}

export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await getSupabaseClient()
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)

  if (error) throw new Error(errorMessage(error))

  return count ?? 0
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('mark_notification_read', {
    p_notification_id: notificationId,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function markAllNotificationsRead(): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('mark_all_notifications_read')

  if (error) throw new Error(errorMessage(error))

  return (data as { marked?: number } | null)?.marked ?? 0
}
