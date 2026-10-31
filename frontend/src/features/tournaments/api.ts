import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'
import type { Json } from '@/types/database'

import type { DrawMatchPayload } from './draw'
import type {
  DrawOutcome,
  EntryOutcome,
  GameScoreInput,
  MatchGameRecord,
  MatchRecord,
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
      matches: [],
      games: [],
    }
  }

  const [entryResult, teamResult, matchResult] = await Promise.all([
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
  ])

  if (entryResult.error) throw new Error(errorMessage(entryResult.error))
  if (teamResult.error) throw new Error(errorMessage(teamResult.error))
  if (matchResult.error) throw new Error(errorMessage(matchResult.error))

  const entries = (entryResult.data ?? []) as unknown as TournamentEntryRecord[]
  const teams = (teamResult.data ?? []) as unknown as TeamRecord[]
  const matches = (matchResult.data ?? []) as unknown as MatchRecord[]
  const teamIds = teams.map((team) => team.id)
  const matchIds = matches.map((match) => match.id)

  const [memberResult, gameResult] = await Promise.all([
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
  ])

  if (memberResult.error) throw new Error(errorMessage(memberResult.error))
  if (gameResult.error) throw new Error(errorMessage(gameResult.error))

  return {
    tournament,
    events,
    entries,
    teams,
    teamMembers: (memberResult.data ?? []) as TeamMemberRecord[],
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
