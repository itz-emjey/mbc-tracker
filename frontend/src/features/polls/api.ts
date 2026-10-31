import { errorMessage } from '@/features/auth/api'
import { getSupabaseClient } from '@/lib/supabase'
import type { Json } from '@/types/database'

import type { PollMode, PollOptionRecord, PollRecord, PollResults, PollStatus } from './types'

const POLL_COLUMNS =
  'id, question, description, mode, is_anonymous, show_results, status, opens_at, closes_at, created_at'
const OPTION_COLUMNS = 'id, poll_id, label, position'

export async function listPolls(): Promise<PollRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('polls')
    .select(POLL_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as PollRecord[]
}

export async function listPollOptions(): Promise<PollOptionRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from('poll_options')
    .select(OPTION_COLUMNS)
    .order('position', { ascending: true })

  if (error) throw new Error(errorMessage(error))

  return (data ?? []) as unknown as PollOptionRecord[]
}

/** Tallies plus the caller's own votes. Voter identities are never returned. */
export async function getPollResults(pollId: string): Promise<PollResults> {
  const { data, error } = await getSupabaseClient().rpc('poll_results', {
    p_poll_id: pollId,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as PollResults
}

export async function createPoll(input: {
  question: string
  description: string | null
  mode: PollMode
  is_anonymous: boolean
  show_results: boolean
  opens_at: string | null
  closes_at: string | null
  options: readonly string[]
}): Promise<{ id: string }> {
  const { data, error } = await getSupabaseClient().rpc('create_poll', {
    p_question: input.question,
    p_description: input.description,
    p_mode: input.mode,
    p_is_anonymous: input.is_anonymous,
    p_show_results: input.show_results,
    p_opens_at: input.opens_at,
    p_closes_at: input.closes_at,
    p_options: input.options as unknown as Json,
  })

  if (error) throw new Error(errorMessage(error))

  return data as unknown as { id: string }
}

export async function setPollStatus(pollId: string, status: PollStatus): Promise<void> {
  const { error } = await getSupabaseClient().rpc('set_poll_status', {
    p_poll_id: pollId,
    p_status: status,
  })

  if (error) throw new Error(errorMessage(error))
}

export async function castPollVote(pollId: string, optionIds: readonly string[]): Promise<void> {
  const { error } = await getSupabaseClient().rpc('cast_poll_vote', {
    p_poll_id: pollId,
    p_option_ids: [...optionIds],
  })

  if (error) throw new Error(errorMessage(error))
}
