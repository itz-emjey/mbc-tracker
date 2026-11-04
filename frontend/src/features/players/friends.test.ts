import { describe, expect, it } from 'vitest'

import type { FriendshipRecord, PlayerRecord } from './types'
import { acceptedFriendPlayerIds, buildFriendEntries } from './friends'

function player(id: string, fullName: string): PlayerRecord {
  return {
    id,
    player_code: `MBC-${id.toUpperCase()}`,
    profile_id: null,
    full_name: fullName,
    gender: null,
    status: 'active',
    rating_status: 'rated',
    joined_on: '2026-01-01',
  }
}

function friendship(
  overrides: Partial<FriendshipRecord> & Pick<FriendshipRecord, 'id'>,
): FriendshipRecord {
  return {
    requester_player_id: 'me',
    addressee_player_id: 'other',
    status: 'accepted',
    requested_at: '2026-01-01T00:00:00Z',
    responded_at: null,
    ...overrides,
  }
}

const me = player('me', 'Me Player')
const zara = player('zara', 'Zara Lim')
const bong = player('bong', 'Bong Cruz')
const playersById = new Map([
  [me.id, me],
  [zara.id, zara],
  [bong.id, bong],
])

describe('buildFriendEntries', () => {
  it('pairs each row with the other player and flags direction', () => {
    const entries = buildFriendEntries(
      [
        friendship({ id: 'out', requester_player_id: 'me', addressee_player_id: 'zara' }),
        friendship({ id: 'in', requester_player_id: 'bong', addressee_player_id: 'me' }),
      ],
      playersById,
      'me',
    )

    expect(entries.map((entry) => [entry.player.full_name, entry.outgoing])).toEqual([
      ['Bong Cruz', false],
      ['Zara Lim', true],
    ])
  })

  it('drops declined, removed, and invisible players', () => {
    const entries = buildFriendEntries(
      [
        friendship({ id: 'declined', status: 'declined', addressee_player_id: 'zara' }),
        friendship({ id: 'removed', status: 'removed', addressee_player_id: 'zara' }),
        friendship({ id: 'hidden', addressee_player_id: 'missing' }),
      ],
      playersById,
      'me',
    )

    expect(entries).toEqual([])
  })
})

describe('acceptedFriendPlayerIds', () => {
  it('offers only accepted friends as doubles partners', () => {
    const entries = buildFriendEntries(
      [
        friendship({ id: 'accepted', addressee_player_id: 'zara' }),
        friendship({ id: 'pending', status: 'pending', addressee_player_id: 'bong' }),
      ],
      playersById,
      'me',
    )

    expect(acceptedFriendPlayerIds(entries)).toEqual(['zara'])
  })
})
