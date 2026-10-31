import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'

import type { AnnouncementRecord, AnnouncementStatus } from './types'

const ANNOUNCEMENT_COLUMNS = 'id, title, body, status, published_at, created_at'

export async function listAnnouncements(): Promise<AnnouncementRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('announcements')
    .select(ANNOUNCEMENT_COLUMNS)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as AnnouncementRecord[]
}

export async function createAnnouncement(title: string, body: string): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc('create_announcement', {
    p_title: title,
    p_body: body,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function setAnnouncementStatus(
  announcementId: string,
  status: AnnouncementStatus,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_announcement_status', {
    p_announcement_id: announcementId,
    p_status: status,
  })

  if (error) throw new Error(errorMessage(error))
}
