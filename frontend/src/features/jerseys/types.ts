/**
 * Jersey records. These mirror migration 008; every table is SELECT-only to
 * clients and writes cross the audited RPCs.
 */

import type { Role } from '@/features/auth/types'

export type JerseyProjectStatus = 'draft' | 'open' | 'closed' | 'completed' | 'cancelled'
export type JerseyOrderStatus = 'submitted' | 'cancelled'

export const JERSEY_STAFF_ROLES: readonly Role[] = ['super_admin', 'trainer']

export const JERSEY_STATUS_LABELS: Record<JerseyProjectStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export interface JerseyProjectRecord {
  id: string
  name: string
  description: string | null
  /** PostgREST returns `numeric` as a string. */
  price: string | null
  order_deadline: string | null
  status: JerseyProjectStatus
  created_at: string
}

export interface JerseyDesignRecord {
  id: string
  project_id: string
  name: string
  description: string | null
  /** Storage object path inside the `jersey-designs` bucket, if a mockup exists. */
  image_path: string | null
  position: number
}

export interface JerseySizeRecord {
  id: string
  project_id: string
  label: string
  position: number
}

export interface JerseyOrderRecord {
  id: string
  project_id: string
  player_id: string
  design_id: string
  size_id: string
  quantity: number
  status: JerseyOrderStatus
  created_at: string
}
