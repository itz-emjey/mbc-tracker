import type { PlayerRecord, PlayerStatus } from './types'

export type PlayerStatusFilter = 'all' | PlayerStatus
export type PlayerSort = 'name' | 'joined' | 'status'

export interface PlayerFilters {
  query: string
  status: PlayerStatusFilter
  sort: PlayerSort
}

const STATUS_ORDER: Record<PlayerStatus, number> = {
  active: 0,
  inactive: 1,
  suspended: 2,
}

/**
 * Search, filter, and sort the directory in memory. The club roster is small,
 * and client-side filtering keeps typing instant without a query per keystroke.
 * Pure so the rules can be tested without a DOM.
 */
export function visiblePlayers(
  players: readonly PlayerRecord[],
  { query, status, sort }: PlayerFilters,
): PlayerRecord[] {
  const needle = query.trim().toLowerCase()

  return players
    .filter((player) => {
      if (status !== 'all' && player.status !== status) return false
      if (needle === '') return true

      return player.full_name.toLowerCase().includes(needle)
    })
    .sort((left, right) => {
      switch (sort) {
        case 'joined':
          return (
            right.joined_on.localeCompare(left.joined_on) ||
            left.full_name.localeCompare(right.full_name)
          )
        case 'status':
          return (
            STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
            left.full_name.localeCompare(right.full_name)
          )
        default:
          return left.full_name.localeCompare(right.full_name)
      }
    })
}
