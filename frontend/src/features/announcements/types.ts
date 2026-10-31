/**
 * Announcement records. These mirror migration 008. Members see published
 * announcements only; staff see drafts and archived rows too.
 */

import type { Role } from '@/features/auth/types'

export type AnnouncementStatus = 'draft' | 'published' | 'archived'

/** Roles that write, publish, and archive announcements. */
export const ANNOUNCEMENT_STAFF_ROLES: readonly Role[] = ['super_admin', 'trainer']

export const ANNOUNCEMENT_STATUS_LABELS: Record<AnnouncementStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
}

export interface AnnouncementRecord {
  id: string
  title: string
  body: string
  status: AnnouncementStatus
  published_at: string | null
  created_at: string
}
