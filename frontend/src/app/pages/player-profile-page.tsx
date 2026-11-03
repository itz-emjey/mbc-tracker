import { ArrowLeft, Pencil, Unlink, Zap } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ArenaAvatar, PowerMeter, RankBadge } from '@/components/arena/arena-ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { tierFor } from '@/domain/arena'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole, ROLE_LABELS, type Role } from '@/features/auth/types'
import {
  getLinkedProfile,
  getPlayer,
  getPlayerByProfile,
  getPlayerSp,
  getProfileRoles,
  unlinkPlayerAccount,
} from '@/features/players/api'
import { PlayerFormDialog } from '@/features/players/player-form-dialog'
import { FriendsCard } from '@/features/players/friends-card'
import {
  PLAYER_GENDER_LABELS,
  PLAYER_STAFF_ROLES,
  type LinkedProfile,
  type PlayerRecord,
} from '@/features/players/types'
import { formatDate } from '@/lib/format'

interface PlayerProfilePageProps {
  /** `/profile` — resolve the signed-in account's own player record. */
  self?: boolean
}

export function PlayerProfilePage({ self = false }: PlayerProfilePageProps) {
  const { user } = useSession()
  const { id } = useParams<{ id: string }>()
  const [player, setPlayer] = React.useState<PlayerRecord | null>(null)
  const [sp, setSp] = React.useState<number | null>(null)
  const [linkedProfile, setLinkedProfile] = React.useState<LinkedProfile | null>(null)
  const [roles, setRoles] = React.useState<Role[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [editOpen, setEditOpen] = React.useState(false)

  const canEdit = hasAnyRole(user?.roles ?? [], PLAYER_STAFF_ROLES)
  const canLink = hasAnyRole(user?.roles ?? [], ['super_admin'])

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)
      setPlayer(null)
      setSp(null)
      setLinkedProfile(null)
      setRoles([])

      try {
        if (self && !user) return

        const record = self && user ? await getPlayerByProfile(user.id) : await getPlayer(id ?? '')

        if (!active) return
        setPlayer(record)

        if (!record) {
          setLoading(false)
          return
        }

        const [balance, profile] = await Promise.all([
          getPlayerSp(record.id),
          record.profile_id ? getLinkedProfile(record.profile_id) : Promise.resolve(null),
        ])

        const profileRoles = profile ? await getProfileRoles(profile.id) : []

        if (!active) return

        setSp(balance)
        setLinkedProfile(profile)
        setRoles(profileRoles)
      } catch (loadError) {
        if (active) setError(errorMessage(loadError))
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [self, user, id, reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  async function unlink() {
    if (!player) return

    try {
      await unlinkPlayerAccount(player.id)
      toast.success('Account unlinked. The player record and history are unchanged.')
      reload()
    } catch (unlinkError) {
      throw new Error(errorMessage(unlinkError), { cause: unlinkError })
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title={self ? 'Your profile' : 'Player profile'} />
        <LoadingState className="mt-6" label="Loading player profile" rows={4} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title={self ? 'Your profile' : 'Player profile'} />
        <ErrorState
          className="mt-6"
          title="Could not load this profile"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  if (!player) {
    return (
      <>
        <PageHeader title={self ? 'Your profile' : 'Player profile'} />
        <EmptyState
          className="mt-6"
          title={self ? 'No player record is linked to your account yet' : 'Player not found'}
          description={
            self
              ? 'Ask a Super Admin to link your account to a player record from Administration → Members.'
              : 'This record may have been removed, or the link is out of date.'
          }
          action={
            <Button variant="secondary" asChild>
              <Link to="/players">Back to players</Link>
            </Button>
          }
        />
      </>
    )
  }

  const progress = sp === null ? null : tierFor(sp)

  return (
    <>
      {!self ? (
        <Link
          to="/players"
          className="mb-3 inline-flex items-center gap-1.5 rounded-sm text-sm text-text-muted transition-colors duration-fast hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All players
        </Link>
      ) : null}

      <PageHeader
        kicker={self ? 'Your fighter' : 'Fighter profile'}
        title={player.full_name}
        description={
          self
            ? 'Your player record, rating rank, and club account.'
            : 'Club record, rank, and account link for this player.'
        }
        actions={
          canEdit ? (
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil aria-hidden="true" />
              Edit details
            </Button>
          ) : null
        }
      />

      <Card className="mt-5 border-t-2 border-t-accent">
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <ArenaAvatar
              name={player.full_name}
              size="xl"
              tone={progress?.tier.tone ?? 'neutral'}
              ring
            />

            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
                {player.player_code}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {progress ? <RankBadge tier={progress.tier} /> : null}
                <StatusBadge status={player.status} />
              </div>
              <p className="mt-1.5 text-[11px] text-text-muted">
                {player.gender ? PLAYER_GENDER_LABELS[player.gender] : 'Gender not recorded'} ·
                joined {formatDate(player.joined_on)}
              </p>
            </div>
          </div>

          {sp !== null && progress ? (
            <div className="sm:min-w-56">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">
                ShuttlePower
              </p>
              <p className="mt-1 font-mono text-3xl font-semibold leading-none tabular-nums text-text">
                {sp.toLocaleString()}
              </p>
              <PowerMeter
                className="mt-2"
                progress={progress.progress}
                label={`${progress.tier.rankTitle} rank progress`}
              />
              <p className="mt-1 text-[11px] text-text-muted">
                {progress.next
                  ? `${progress.spToNext} SP to ${progress.next.rankTitle}`
                  : `${progress.tier.rankTitle} — the top rank`}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Directory record</CardTitle>
            <CardDescription>
              Staff maintain these details. Players cannot edit their own record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-[0.06em] text-text-faint">Player ID</dt>
                <dd className="mt-1 font-mono text-sm text-text">{player.player_code}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.06em] text-text-faint">Joined</dt>
                <dd className="mt-1 text-sm text-text">{formatDate(player.joined_on)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.06em] text-text-faint">Gender</dt>
                <dd className="mt-1 text-sm text-text">
                  {player.gender ? PLAYER_GENDER_LABELS[player.gender] : 'Not specified'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.06em] text-text-faint">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={player.status} />
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.06em] text-text-faint">Roles</dt>
                <dd className="mt-1">
                  {player.profile_id === null ? (
                    <span className="text-sm text-text-muted">No account linked</span>
                  ) : linkedProfile === null ? (
                    <span className="text-sm text-text-muted">
                      Visible to the player and Super Admin
                    </span>
                  ) : roles.length === 0 ? (
                    <span className="text-sm text-text-muted">No roles assigned</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {roles.map((role) => (
                        <Badge key={role} tone="neutral">
                          {ROLE_LABELS[role]}
                        </Badge>
                      ))}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          {sp !== null ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="size-4 text-accent" aria-hidden="true" />
                  ShuttlePower
                </CardTitle>
                <CardDescription>
                  Current balance. History arrives with the SP module.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums text-text">
                  {sp.toLocaleString()}
                  <span className="ml-1 text-sm font-normal text-text-muted">SP</span>
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Club account</CardTitle>
              <CardDescription>
                {player.profile_id
                  ? 'This record is linked to an approved account.'
                  : 'This record has no account yet.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {player.profile_id === null ? (
                <p className="text-sm text-text-muted">
                  {canLink
                    ? 'Link an approved account from Administration → Members.'
                    : 'Staff can link an approved account to this record.'}
                </p>
              ) : linkedProfile ? (
                <div className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm font-medium text-text">{linkedProfile.full_name}</p>
                    <div className="mt-1">
                      <StatusBadge status={linkedProfile.status} />
                    </div>
                  </div>

                  {canLink ? (
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="sm" className="self-start">
                          <Unlink aria-hidden="true" />
                          Unlink account
                        </Button>
                      }
                      title={`Unlink ${linkedProfile.full_name}?`}
                      description="The account keeps its roles and can still sign in, but it will no longer be attached to this player record. Player history is retained."
                      confirmLabel="Unlink account"
                      onConfirm={unlink}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-text-muted">
                  An account is linked. Only the player and a Super Admin can see its details.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {self ? (
        <div className="mt-4">
          <FriendsCard player={player} />
        </div>
      ) : null}

      {canEdit ? (
        <PlayerFormDialog
          key={editOpen ? `edit-${player.id}` : 'edit-closed'}
          open={editOpen}
          player={player}
          onOpenChange={setEditOpen}
          onSaved={(saved) => setPlayer(saved)}
        />
      ) : null}
    </>
  )
}
