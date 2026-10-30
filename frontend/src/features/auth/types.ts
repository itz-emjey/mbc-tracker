/**
 * Roles and session shapes.
 *
 * These mirror the roles defined in AGENT.md §3. A single account may hold
 * several roles at once, so every permission check must accept an array.
 *
 * Reminder: nothing here is security. It decides what the UI shows. The
 * database (RLS + RPC guards) remains the only authority.
 */

export type Role = 'super_admin' | 'tournament_manager' | 'trainer' | 'player'

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  tournament_manager: 'Tournament Manager',
  trainer: 'Trainer',
  player: 'Player',
}

export type AccountStatus = 'approved' | 'pending' | 'suspended'

export interface SessionUser {
  id: string
  name: string
  email: string
  /** One or more. Never assume exactly one. */
  roles: Role[]
  status: AccountStatus
}

/**
 * True when the user holds at least one of the required roles.
 * An empty/undefined `required` means "any approved member".
 */
export function hasAnyRole(userRoles: readonly Role[], required?: readonly Role[]): boolean {
  if (!required || required.length === 0) return true

  return required.some((role) => userRoles.includes(role))
}
