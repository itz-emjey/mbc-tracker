import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'
import type { Json } from '@/types/database'

import type { DrawMatchPayload } from './draw'
import { buildTournamentPosterPath, validateTournamentPoster } from './posters'
import type {
  DrawOutcome,
  EntryOutcome,
  GameScoreInput,
  InvitationOutcome,
  JoinEventOutcome,
  MatchGameRecord,
  MatchRecord,
  PartnerInvitationRecord,
  PaymentOutcome,
  PaymentRecord,
  PaymentStatus,
  ResultOutcome,
  TeamMemberRecord,
  TeamRecord,
  TournamentDetail,
  TournamentEntryRecord,
  TournamentEventInput,
  TournamentEventRecord,
  TournamentInput,
  TournamentRecord,
  TournamentStatus,
  WithdrawalOutcome,
} from './types'

/**
 * Tournament data access.
 *
 * Every read is a plain SELECT governed by RLS. Every write is an RPC: clients
 * hold no INSERT/UPDATE/DELETE grant on any tournament table, so the rules for
 * caps, D10, draw coverage, advancement, and corrections cannot be bypassed.
 */

export async function listTournaments(): Promise<TournamentRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('tournaments')
    .select('*')
    .order('starts_on', { ascending: false })
    .order('name', { ascending: true })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as TournamentRecord[]
}

export async function getTournament(tournamentId: string): Promise<TournamentRecord | null> {
  const { data, error } = await getSupabaseClient()
    .from('tournaments')
    .select('*')
    .eq('id', tournamentId)
    .maybeSingle()

  if (error) throw new Error(errorMessage(error))

  return (data as unknown as TournamentRecord | null) ?? null
}

export async function getTournamentDetail(tournamentId: string): Promise<TournamentDetail | null> {
  const tournament = await getTournament(tournamentId)
  if (!tournament) return null

  const eventResult = await getSupabaseClient()
    .from('tournament_events')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })

  if (eventResult.error) throw new Error(errorMessage(eventResult.error))

  const events = (eventResult.data ?? []) as unknown as TournamentEventRecord[]
  const eventIds = events.map((event) => event.id)

  if (eventIds.length === 0) {
    return {
      tournament,
      events,
      entries: [],
      teams: [],
      teamMembers: [],
      payments: [],
      invitations: [],
      matches: [],
      games: [],
    }
  }

  const [entryResult, teamResult, matchResult, invitationResult] = await Promise.all([
    getSupabaseClient()
      .from('tournament_entries')
      .select('*')
      .in('event_id', eventIds)
      .order('created_at', { ascending: true }),
    getSupabaseClient().from('teams').select('*').in('event_id', eventIds),
    getSupabaseClient()
      .from('matches')
      .select('*')
      .in('event_id', eventIds)
      .order('round', { ascending: true })
      .order('position', { ascending: true }),
    getSupabaseClient()
      .from('tournament_partner_invitations')
      .select('*')
      .in('event_id', eventIds)
      .order('created_at', { ascending: true }),
  ])

  if (entryResult.error) throw new Error(errorMessage(entryResult.error))
  if (teamResult.error) throw new Error(errorMessage(teamResult.error))
  if (matchResult.error) throw new Error(errorMessage(matchResult.error))
  if (invitationResult.error) throw new Error(errorMessage(invitationResult.error))

  const entries = (entryResult.data ?? []) as unknown as TournamentEntryRecord[]
  const teams = (teamResult.data ?? []) as unknown as TeamRecord[]
  const matches = (matchResult.data ?? []) as unknown as MatchRecord[]
  const invitations = (invitationResult.data ?? []) as unknown as PartnerInvitationRecord[]
  const teamIds = teams.map((team) => team.id)
  const matchIds = matches.map((match) => match.id)
  const entryIds = entries.map((entry) => entry.id)

  const [memberResult, gameResult, paymentResult] = await Promise.all([
    teamIds.length > 0
      ? getSupabaseClient().from('team_members').select('*').in('team_id', teamIds)
      : Promise.resolve({ data: [], error: null }),
    matchIds.length > 0
      ? getSupabaseClient()
          .from('match_games')
          .select('*')
          .in('match_id', matchIds)
          .order('game_number', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    entryIds.length > 0
      ? getSupabaseClient()
          .from('tournament_entry_payments')
          .select('*')
          .in('entry_id', entryIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
  ])

  if (memberResult.error) throw new Error(errorMessage(memberResult.error))
  if (gameResult.error) throw new Error(errorMessage(gameResult.error))
  if (paymentResult.error) throw new Error(errorMessage(paymentResult.error))

  return {
    tournament,
    events,
    entries,
    teams,
    teamMembers: (memberResult.data ?? []) as TeamMemberRecord[],
    payments: (paymentResult.data ?? []) as unknown as PaymentRecord[],
    invitations,
    matches,
    games: (gameResult.data ?? []) as MatchGameRecord[],
  }
}

export async function createTournament(input: TournamentInput): Promise<TournamentRecord> {
  const { data, error } = await getSupabaseClient().rpc('create_tournament', {
    p_name: input.name,
    p_starts_on: input.starts_on,
    p_ends_on: input.ends_on,
    p_venue: input.venue,
    p_description: input.description,
    p_registration_deadline: input.registration_deadline,
    p_entrance_fee: input.entrance_fee,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as TournamentRecord
}

export async function setTournamentStatus(
  tournamentId: string,
  status: TournamentStatus,
): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_tournament_status', {
    p_tournament_id: tournamentId,
    p_status: status,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function createTournamentEvent(
  tournamentId: string,
  input: TournamentEventInput,
): Promise<TournamentEventRecord> {
  const { data, error } = await getSupabaseClient().rpc('create_tournament_event', {
    p_tournament_id: tournamentId,
    p_discipline: input.discipline,
    p_format: input.format,
    p_max_entries: input.max_entries,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as TournamentEventRecord
}

export async function registerTournamentEntry(
  eventId: string,
  playerIds: readonly string[],
  seed: number | null,
): Promise<EntryOutcome> {
  const { data, error } = await getSupabaseClient().rpc('register_tournament_entry', {
    p_event_id: eventId,
    p_player_ids: [...playerIds],
    p_seed: seed,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as EntryOutcome
}

export async function withdrawTournamentEntry(entryId: string): Promise<void> {
  const { error } = await getSupabaseClient().rpc('withdraw_tournament_entry', {
    p_entry_id: entryId,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function saveTournamentDraw(
  eventId: string,
  matches: readonly DrawMatchPayload[],
  replace = false,
): Promise<DrawOutcome> {
  const { data, error } = await getSupabaseClient().rpc('save_tournament_draw', {
    p_event_id: eventId,
    p_matches: matches as unknown as Json,
    p_replace: replace,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as DrawOutcome
}

export async function recordMatchResult(
  matchId: string,
  games: readonly GameScoreInput[],
): Promise<ResultOutcome> {
  const { data, error } = await getSupabaseClient().rpc('record_match_result', {
    p_match_id: matchId,
    p_games: games as unknown as Json,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as ResultOutcome
}

export async function correctMatchResult(
  matchId: string,
  games: readonly GameScoreInput[],
  reason: string,
): Promise<ResultOutcome> {
  const { data, error } = await getSupabaseClient().rpc('correct_match_result', {
    p_match_id: matchId,
    p_games: games as unknown as Json,
    p_reason: reason,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as ResultOutcome
}

/**
 * Player self-entry. Singles and guest doubles register immediately; a club
 * partner receives an invitation and no entry exists until they accept.
 */
export async function joinTournamentEvent(
  eventId: string,
  partnerPlayerId: string | null = null,
  guestName: string | null = null,
): Promise<JoinEventOutcome> {
  const { data, error } = await getSupabaseClient().rpc('join_tournament_event', {
    p_event_id: eventId,
    p_partner_player_id: partnerPlayerId,
    p_guest_name: guestName,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as JoinEventOutcome
}

export async function respondTournamentPartnerInvitation(
  invitationId: string,
  accept: boolean,
): Promise<InvitationOutcome> {
  const { data, error } = await getSupabaseClient().rpc('respond_tournament_partner_invitation', {
    p_invitation_id: invitationId,
    p_accept: accept,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as InvitationOutcome
}

export async function cancelTournamentPartnerInvitation(
  invitationId: string,
): Promise<InvitationOutcome> {
  const { data, error } = await getSupabaseClient().rpc('cancel_tournament_partner_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as InvitationOutcome
}

export async function withdrawOwnTournamentEntry(entryId: string): Promise<WithdrawalOutcome> {
  const { data, error } = await getSupabaseClient().rpc('withdraw_own_tournament_entry', {
    p_entry_id: entryId,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as WithdrawalOutcome
}

export async function setEntryPayment(
  paymentId: string,
  status: PaymentStatus,
  note: string | null = null,
): Promise<PaymentOutcome> {
  const { data, error } = await getSupabaseClient().rpc('set_entry_payment', {
    p_payment_id: paymentId,
    p_status: status,
    p_note: note,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as PaymentOutcome
}

export async function setTournamentPoster(
  tournamentId: string,
  posterPath: string | null,
): Promise<string | null> {
  const { data, error } = await getSupabaseClient().rpc('set_tournament_poster', {
    p_tournament_id: tournamentId,
    p_poster_path: posterPath,
  })

  if (error) throw new Error(errorMessage(error))

  return (data as { poster_path?: string | null } | null)?.poster_path ?? null
}

export async function setTournamentEntranceFee(tournamentId: string, fee: number): Promise<number> {
  const { data, error } = await getSupabaseClient().rpc('set_tournament_entrance_fee', {
    p_tournament_id: tournamentId,
    p_fee: fee,
  })

  if (error) throw new Error(errorMessage(error))

  return (data as { entrance_fee?: number } | null)?.entrance_fee ?? fee
}

/**
 * Validates, uploads, and attaches a poster in one step. The previous object is
 * removed only after the database accepts the new path.
 */
export async function uploadTournamentPoster(
  tournamentId: string,
  file: File,
  previousPath: string | null = null,
): Promise<string> {
  const problem = validateTournamentPoster(file)

  if (problem) throw new Error(problem)

  const path = buildTournamentPosterPath(tournamentId, crypto.randomUUID(), file.type)
  const storage = getSupabaseClient().storage.from('tournament-posters')
  const { error: uploadError } = await storage.upload(path, file, {
    contentType: file.type,
    upsert: false,
  })

  if (uploadError) throw new Error(errorMessage(uploadError))

  try {
    await setTournamentPoster(tournamentId, path)
  } catch (attachError) {
    await storage.remove([path]).catch(() => undefined)
    throw attachError
  }

  if (previousPath) {
    await storage.remove([previousPath]).catch(() => undefined)
  }

  return path
}

/** Removes the stored object and clears the path. */
export async function removeTournamentPoster(
  tournamentId: string,
  posterPath: string,
): Promise<void> {
  await setTournamentPoster(tournamentId, null)
  await getSupabaseClient()
    .storage.from('tournament-posters')
    .remove([posterPath])
    .catch(() => undefined)
}

/** Public bucket URL, or `null` when the tournament has no poster. */
export function tournamentPosterUrl(path: string | null): string | null {
  if (!path) return null

  return getSupabaseClient().storage.from('tournament-posters').getPublicUrl(path).data.publicUrl
}
