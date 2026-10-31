import type { User } from '@supabase/supabase-js'

import { getSupabaseClient } from '@/lib/supabase'

import {
  ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
  type AccountStatus,
  type Role,
  type SessionUser,
} from './types'

/**
 * Supabase Auth + registration lifecycle API.
 *
 * The browser never writes identity tables directly. Registration, approval,
 * rejection, status changes, role assignment, and starting SP all cross a
 * server-side RPC that re-checks authorization and writes the audit log.
 */

export const ROLE_KEYS: readonly Role[] = ['player', 'trainer', 'tournament_manager', 'super_admin']

export const ASSIGNABLE_ROLES: readonly Role[] = [
  'player',
  'trainer',
  'tournament_manager',
  'super_admin',
]

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: 'Registration approvals, role assignment, status changes, and club settings.',
  tournament_manager: 'Tournaments, draws, brackets, and official results.',
  trainer: 'Training, payments, jerseys, polls, and announcements.',
  player: 'Normal club membership and player-facing modules.',
}

export interface RegistrationRequestSummary {
  id: string
  profile_id: string
  email: string
  full_name: string
  status: string
  requested_at: string
  reviewed_at: string | null
  decision_note: string | null
}

export interface MemberSummary {
  id: string
  full_name: string
  status: string
  roles: Role[]
}

export interface UnlinkedPlayer {
  id: string
  full_name: string
  gender: string | null
}

export interface RegistrationOutcome {
  status: string
  request_id: string | null
  profile_id?: string
  player_id?: string | null
  roles?: Role[]
  current_sp?: number | null
  already_processed?: boolean
}

export interface SignUpResult {
  /** True when Supabase did not return a session (email confirmation is on). */
  needsEmailConfirmation: boolean
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return knownAuthMessage(error.message)
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String((error as { message: unknown }).message)
    if (message.trim()) return knownAuthMessage(message)
  }

  return 'Something went wrong. Please try again.'
}

function knownAuthMessage(message: string): string {
  switch (message) {
    case 'Invalid login credentials':
      return 'Email or password is incorrect.'
    case 'Email not confirmed':
      return 'Confirm your email address before signing in.'
    case 'User already registered':
      return 'An account with this email already exists. Try signing in instead.'
    case 'Password should be at least 6 characters':
      return 'Use a password with at least 8 characters.'
    case 'not authorized':
      return 'Only an active Super Admin can do that.'
    default:
      return message
  }
}

export function isRole(value: string): value is Role {
  return ROLE_KEYS.includes(value as Role)
}

export function accountStatusFromDatabase(status: string): AccountStatus {
  switch (status) {
    case 'active':
      return 'approved'
    case 'pending':
      return 'pending'
    case 'suspended':
      return 'suspended'
    case 'deactivated':
      return 'deactivated'
    default:
      throw new Error(`Unknown account status: ${status}`)
  }
}

export function accountStatusLabel(status: AccountStatus): string {
  return ACCOUNT_STATUS_LABELS[status]
}

function sortRoles(roles: readonly Role[]): Role[] {
  return [...new Set(roles)].sort(
    (left, right) => ROLE_KEYS.indexOf(left) - ROLE_KEYS.indexOf(right),
  )
}

/**
 * Loads the profile and role assignments for an Auth user.
 *
 * A confirmed sign-up can arrive before its profile exists (email-confirmation
 * projects). That path submits the pending registration from the full name
 * stored in Auth metadata, which keeps registration idempotent across the
 * confirmation boundary.
 */
export async function loadSessionUser(authUser: User): Promise<SessionUser | null> {
  const supabase = getSupabaseClient()

  let profileResponse = await supabase
    .from('profiles')
    .select('id, full_name, status')
    .eq('id', authUser.id)
    .maybeSingle()

  if (profileResponse.error) {
    throw new Error(errorMessage(profileResponse.error))
  }

  if (!profileResponse.data) {
    const fullName =
      typeof authUser.user_metadata.full_name === 'string' ? authUser.user_metadata.full_name : null

    const registration = await supabase.rpc('submit_registration', {
      p_full_name: fullName ?? undefined,
    })

    if (registration.error) {
      throw new Error(errorMessage(registration.error))
    }

    profileResponse = await supabase
      .from('profiles')
      .select('id, full_name, status')
      .eq('id', authUser.id)
      .maybeSingle()

    if (profileResponse.error) {
      throw new Error(errorMessage(profileResponse.error))
    }
  }

  const profile = profileResponse.data

  if (!profile) {
    return null
  }

  const assignments = await supabase
    .from('user_roles')
    .select('role_id')
    .eq('profile_id', authUser.id)

  if (assignments.error) {
    throw new Error(errorMessage(assignments.error))
  }

  const roleIds = (assignments.data ?? []).map((assignment) => assignment.role_id)
  let roles: Role[] = []

  if (roleIds.length > 0) {
    const roleRows = await supabase.from('roles').select('id, key').in('id', roleIds)

    if (roleRows.error) {
      throw new Error(errorMessage(roleRows.error))
    }

    roles = sortRoles(
      (roleRows.data ?? []).map((role) => role.key).filter((key): key is Role => isRole(key)),
    )
  }

  return {
    id: profile.id,
    name: profile.full_name,
    email: authUser.email ?? '',
    roles,
    status: accountStatusFromDatabase(profile.status),
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await getSupabaseClient().auth.signInWithPassword({ email, password })

  if (error) {
    throw new Error(errorMessage(error))
  }
}

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut()

  if (error) {
    throw new Error(errorMessage(error))
  }
}

export async function signUp(
  fullName: string,
  email: string,
  password: string,
): Promise<SignUpResult> {
  const { data, error } = await getSupabaseClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    throw new Error(errorMessage(error))
  }

  if (!data.session) {
    return { needsEmailConfirmation: true }
  }

  const registration = await getSupabaseClient().rpc('submit_registration', {
    p_full_name: fullName,
  })

  if (registration.error) {
    throw new Error(errorMessage(registration.error))
  }

  return { needsEmailConfirmation: false }
}

export async function submitRegistration(fullName?: string): Promise<RegistrationOutcome> {
  const { data, error } = await getSupabaseClient().rpc('submit_registration', {
    p_full_name: fullName,
  })

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data as unknown as RegistrationOutcome
}

export async function getLatestRegistrationRequest(
  profileId: string,
): Promise<RegistrationRequestSummary | null> {
  const { data, error } = await getSupabaseClient()
    .from('registration_requests')
    .select('id, profile_id, email, full_name, status, requested_at, reviewed_at, decision_note')
    .eq('profile_id', profileId)
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data
}

export async function listPendingRegistrations(): Promise<RegistrationRequestSummary[]> {
  const { data, error } = await getSupabaseClient()
    .from('registration_requests')
    .select('id, profile_id, email, full_name, status, requested_at, reviewed_at, decision_note')
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data ?? []
}

export async function listMembers(): Promise<MemberSummary[]> {
  const supabase = getSupabaseClient()

  const profiles = await supabase
    .from('profiles')
    .select('id, full_name, status')
    .neq('status', 'pending')
    .order('full_name', { ascending: true })

  if (profiles.error) {
    throw new Error(errorMessage(profiles.error))
  }

  const rows = profiles.data ?? []

  if (rows.length === 0) {
    return []
  }

  const profileIds = rows.map((profile) => profile.id)
  const assignments = await supabase
    .from('user_roles')
    .select('profile_id, role_id')
    .in('profile_id', profileIds)

  if (assignments.error) {
    throw new Error(errorMessage(assignments.error))
  }

  const roleIds = [...new Set((assignments.data ?? []).map((row) => row.role_id))]
  const roleRows =
    roleIds.length > 0
      ? await supabase.from('roles').select('id, key').in('id', roleIds)
      : { data: [], error: null }

  if (roleRows.error) {
    throw new Error(errorMessage(roleRows.error))
  }

  const roleKeyById = new Map(
    (roleRows.data ?? [])
      .filter((role): role is { id: string; key: string } => isRole(role.key))
      .map((role) => [role.id, role.key as Role]),
  )

  return rows.map((profile) => ({
    id: profile.id,
    full_name: profile.full_name,
    status: profile.status,
    roles: sortRoles(
      (assignments.data ?? [])
        .filter((assignment) => assignment.profile_id === profile.id)
        .map((assignment) => roleKeyById.get(assignment.role_id))
        .filter((role): role is Role => Boolean(role)),
    ),
  }))
}

export async function listUnlinkedPlayers(): Promise<UnlinkedPlayer[]> {
  const { data, error } = await getSupabaseClient()
    .from('players')
    .select('id, full_name, gender')
    .is('profile_id', null)
    .eq('status', 'active')
    .order('full_name', { ascending: true })

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data ?? []
}

export async function approveRegistration(
  requestId: string,
  roles: readonly Role[],
  playerId: string | null,
): Promise<RegistrationOutcome> {
  const { data, error } = await getSupabaseClient().rpc('approve_registration', {
    p_request_id: requestId,
    p_role_keys: [...roles],
    p_player_id: playerId ?? undefined,
  })

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data as unknown as RegistrationOutcome
}

export async function rejectRegistration(
  requestId: string,
  reason: string,
): Promise<RegistrationOutcome> {
  const { data, error } = await getSupabaseClient().rpc('reject_registration', {
    p_request_id: requestId,
    p_reason: reason,
  })

  if (error) {
    throw new Error(errorMessage(error))
  }

  return data as unknown as RegistrationOutcome
}

export async function setProfileStatus(
  profileId: string,
  status: 'active' | 'suspended' | 'deactivated',
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_profile_status', {
    p_profile_id: profileId,
    p_status: status,
  })

  if (error) {
    throw new Error(errorMessage(error))
  }
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role]
}

export function accountStatusOptions(): { value: AccountStatus; label: string }[] {
  return (Object.keys(ACCOUNT_STATUS_LABELS) as AccountStatus[]).map((status) => ({
    value: status,
    label: ACCOUNT_STATUS_LABELS[status],
  }))
}
