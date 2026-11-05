import { UserPlus, Users } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { errorMessage } from '@/features/auth/api'
import { listPlayers } from '@/features/players/api'
import {
  buildFriendEntries,
  listFriendships,
  removeFriend,
  respondFriendRequest,
  sendFriendRequest,
} from '@/features/players/friends'
import type { FriendEntry, PlayerRecord } from '@/features/players/types'

interface FriendsCardProps {
  player: PlayerRecord
  /** Renders the body only, for a page that already names the section. */
  embedded?: boolean
}

/**
 * Shows the signed-in player's ID and manages friendships. A friend request is
 * sent by ID; the other player must accept before they appear in the doubles
 * partner picker.
 */
export function FriendsCard({ player, embedded = false }: FriendsCardProps) {
  const [entries, setEntries] = React.useState<FriendEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [code, setCode] = React.useState('')
  const [sending, setSending] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true

    void Promise.all([listFriendships(), listPlayers()])
      .then(([friendships, players]) => {
        if (!active) return

        const playersById = new Map(players.map((record) => [record.id, record]))
        setEntries(buildFriendEntries(friendships, playersById, player.id))
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [player.id, reloadKey])

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = code.trim().toUpperCase()

    if (trimmed === '') return

    setSending(true)

    try {
      const outcome = await sendFriendRequest(trimmed)

      if (outcome.already_friends) {
        toast.success('You are already friends.')
      } else if (outcome.status === 'pending') {
        toast.success('Friend request sent. They must accept it first.')
      }

      setCode('')
      reload()
    } catch (sendError) {
      toast.error(errorMessage(sendError))
    } finally {
      setSending(false)
    }
  }

  async function handleRespond(entry: FriendEntry, accept: boolean) {
    setBusyId(entry.friendshipId)

    try {
      await respondFriendRequest(entry.friendshipId, accept)
      toast.success(accept ? 'Friend request accepted.' : 'Friend request declined.')
      reload()
    } catch (respondError) {
      toast.error(errorMessage(respondError))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(entry: FriendEntry) {
    setBusyId(entry.friendshipId)

    try {
      await removeFriend(entry.player.id)
      toast.success(entry.status === 'accepted' ? 'Friend removed.' : 'Request removed.')
      reload()
    } catch (removeError) {
      toast.error(errorMessage(removeError))
    } finally {
      setBusyId(null)
    }
  }

  const incoming = entries.filter((entry) => entry.status === 'pending' && !entry.outgoing)
  const accepted = entries.filter((entry) => entry.status === 'accepted')
  const outgoing = entries.filter((entry) => entry.status === 'pending' && entry.outgoing)

  const body = (
    <div className="flex flex-col gap-5">
      <form
        onSubmit={(event) => void handleSend(event)}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="flex-1">
          <label htmlFor="friend-code" className="sr-only">
            Add a friend by player ID
          </label>
          <Input
            id="friend-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="MBC-XXXXXXXX"
            autoComplete="off"
            maxLength={12}
            className="font-mono uppercase"
          />
        </div>
        <Button type="submit" loading={sending} disabled={code.trim() === ''}>
          <UserPlus aria-hidden="true" />
          Add friend
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-text-muted">Loading friends…</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No friends yet"
          description="Add a member by their player ID. They will appear here after they accept."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {incoming.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
                Requests for you
              </h3>
              <ul className="flex flex-col gap-2">
                {incoming.map((entry) => (
                  <li
                    key={entry.friendshipId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium text-text">{entry.player.full_name}</span>
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void handleRespond(entry, true)}
                        loading={busyId === entry.friendshipId}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => void handleRespond(entry, false)}
                        disabled={busyId === entry.friendshipId}
                      >
                        Decline
                      </Button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {accepted.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
                Friends
              </h3>
              <ul className="flex flex-col gap-2">
                {accepted.map((entry) => (
                  <li
                    key={entry.friendshipId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-3 py-2"
                  >
                    <span className="text-sm font-medium text-text">
                      {entry.player.full_name}
                      <span className="ml-2 font-mono text-xs font-normal text-text-faint">
                        {entry.player.player_code}
                      </span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRemove(entry)}
                      loading={busyId === entry.friendshipId}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {outgoing.length > 0 ? (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.06em] text-text-faint">
                Sent requests
              </h3>
              <ul className="flex flex-col gap-2">
                {outgoing.map((entry) => (
                  <li
                    key={entry.friendshipId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border px-3 py-2"
                  >
                    <span className="text-sm text-text-muted">
                      {entry.player.full_name} — awaiting reply
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void handleRemove(entry)}
                      loading={busyId === entry.friendshipId}
                    >
                      Cancel
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )

  if (embedded) return body

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-accent" aria-hidden="true" />
          Player ID and friends
        </CardTitle>
        <CardDescription>
          Share your ID so another member can add you. Friends can be chosen as doubles partners.
        </CardDescription>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  )
}
