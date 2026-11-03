/**
 * Notification types.
 *
 * Notifications are SELECT-only for clients; reads and mark-read calls cross
 * security-definer RPCs that always use `auth.uid()`.
 */

export interface NotificationRecord {
  id: string
  profile_id: string
  type: string
  title: string
  body: string | null
  link_path: string | null
  tournament_id: string | null
  actor_profile_id: string | null
  read_at: string | null
  created_at: string
}
