import { ArrowLeft, Check, Copy, Pencil, Unlink } from 'lucide-react'
import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  ArenaAvatar,
  LevelRing,
  PowerMeter,
  RankBadge,
  SectionHeading,
} from '@/components/arena/arena-ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { FriendsCard } from '@/features/players/friends-card'
import { PlayerFormDialog } from '@/features/players/player-form-dialog'
import {
  PLAYER_GENDER_LABELS,
  PLAYER_RATING_STATUS_LABELS,
  PLAYER_STAFF_ROLES,
  type LinkedProfile,
  type PlayerRecord,
} from '@/features/players/types'
import { getPlacementProgress } from '@/features/shuttlepower/api'
import type { PlacementProgressRecord } from '@/features/shuttlepower/types'
import { formatDate } from '@/lib/format'

interface PlayerProfilePageProps {
  /** `/profile` — resolve the signed-in account's own player record. */
  self?: boolean
}

/** One field of the record, as a label/value pair inside a `dl`. */
function RecordItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-medium uppercase tracking-[0.1em] text-text-faint">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-text">{children}</dd>
    </div>
  )
}

export function PlayerProfilePage({ self = false }: PlayerProfilePageProps) {
  const { user } = useSession()
  const { id } = useParams<{ id: string }>()
  const [player, setPlayer] = React.useState<PlayerRecord | null>(null)
  const [sp, setSp] = React.useState<number | null>(null)
  const [placement, setPlacement] = React.useState<PlacementProgressRecord | null>(null)
  const [linkedProfile, setLinkedProfile] = React.useState<LinkedProfile | null>(null)
  const [roles, setRoles] = React.useState<Role[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [editOpen, setEditOpen] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  const canEdit = hasAnyRole(user?.roles ?? [], PLAYER_STAFF_ROLES)
  const canLink = hasAnyRole(user?.roles ?? [], ['super_admin'])

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)
      setPlayer(null)
      setSp(null)
      setPlacement(null)
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

        const [balance, placementProgress, profile] = await Promise.all([
          getPlayerSp(record.id),
          getPlacementProgress(record.id),
          record.profile_id ? getLinkedProfile(record.profile_id) : Promise.resolve(null),
        ])

        const profileRoles = profile ? await getProfileRoles(profile.id) : []

        if (!active) return

        setSp(balance)
        setPlacement(placementProgress)
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

  async function copyCode() {
    if (!player) return

    try {
      await navigator.clipboard.writeText(player.player_code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy the player ID. Select it manually instead.')
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
  const unrated = player.rating_status === 'unrated'
  const placementCredits = placement?.credits ?? 0
  const placementRequired = placement?.required ?? 10
  const placementRatio =
    placementRequired > 0 ? Math.min(1, placementCredits / placementRequired) : 0

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
      >
        <div className="flex flex-col gap-4 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3.5">
            <LevelRing
              progress={progress?.progress ?? 0}
              tone={progress?.tier.tone ?? 'neutral'}
              size={64}
            >
              <ArenaAvatar
                name={player.full_name}
                size="md"
                tone={progress?.tier.tone ?? 'neutral'}
              />
            </LevelRing>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-text-faint">
                  {player.player_code}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => void copyCode()}
                >
                  {copied ? (
                    <Check className="size-3" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3" aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy ID'}
                </Button>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {progress ? <RankBadge tier={progress.tier} /> : null}
                {unrated ? <Badge tone="warning">Unrated</Badge> : null}
                <StatusBadge status={player.status} />
              </div>

              <p className="mt-1.5 text-[11px] text-text-muted">
                {player.gender ? PLAYER_GENDER_LABELS[player.gender] : 'Gender not recorded'} ·
                joined {formatDate(player.joined_on)}
              </p>
            </div>
          </div>

          {unrated ? (
            <div className="sm:min-w-56">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">
                ShuttlePower
              </p>
              <p className="mt-1 font-mono text-3xl font-semibold leading-none tabular-nums text-text-muted">
                Hidden
              </p>
              <PowerMeter
                className="mt-2"
                progress={placementRatio}
                label={`${placementCredits} of ${placementRequired} placement matches`}
              />
              <p className="mt-1 text-[11px] text-text-muted">
                {placementCredits}/{placementRequired} placement matches · published unchanged at
                qualification
              </p>
            </div>
          ) : sp !== null && progress ? (
            <div className="sm:min-w-56">
              <p className="text-[10px] uppercase tracking-[0.14em] text-text-faint">
                ShuttlePower
              </p>
              <p className="mt-1 animate-score-pop font-mono text-3xl font-semibold leading-none tabular-nums text-text">
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
        </div>
      </PageHeader>

      <section className="mt-8" aria-label="Record">
        <SectionHeading
          index="01"
          title="Record"
          description={
            canEdit
              ? 'Directory facts, with the account and its roles beside them.'
              : 'Directory facts for this player. Staff maintain them.'
          }
        />

        <div className="mt-5 grid gap-6 lg:grid-cols-3">
          <dl className="grid content-start gap-x-6 gap-y-4 sm:grid-cols-2 lg:col-span-2">
            <RecordItem label="Joined">{formatDate(player.joined_on)}</RecordItem>

            <RecordItem label="Gender">
              {player.gender ? PLAYER_GENDER_LABELS[player.gender] : 'Not specified'}
            </RecordItem>

            <RecordItem label="Status">
              <StatusBadge status={player.status} />
            </RecordItem>

            <RecordItem label="Rating">
              <span className="inline-flex flex-wrap items-center gap-2">
                <Badge tone={unrated ? 'warning' : 'neutral'}>
                  {PLAYER_RATING_STATUS_LABELS[player.rating_status]}
                </Badge>
                {unrated ? (
                  <span className="text-xs text-text-muted">
                    {placementCredits}/{placementRequired} placement matches
                  </span>
                ) : null}
              </span>
            </RecordItem>
          </dl>

          <div className="flex flex-col gap-5 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <div>
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-faint">
                Club account
              </h3>

              <div className="mt-2">
                {player.profile_id === null ? (
                  <p className="text-sm leading-relaxed text-text-muted">
                    {canLink
                      ? 'Link an approved account from Administration → Members.'
                      : 'Staff can link an approved account to this record.'}
                  </p>
                ) : linkedProfile ? (
                  <div className="flex flex-col gap-2.5">
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
                  <p className="text-sm leading-relaxed text-text-muted">
                    An account is linked. Only the player and a Super Admin can see its details.
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-text-faint">
                Roles
              </h3>

              <div className="mt-2">
                {player.profile_id === null ? (
                  <p className="text-sm text-text-muted">No account linked</p>
                ) : linkedProfile === null ? (
                  <p className="text-sm text-text-muted">Visible to the player and Super Admin</p>
                ) : roles.length === 0 ? (
                  <p className="text-sm text-text-muted">No roles assigned</p>
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {roles.map((role) => (
                      <Badge key={role} tone="neutral">
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {self ? (
        <section className="mt-8" aria-label="Connections">
          <SectionHeading
            index="02"
            title="Connections"
            description="Add members by player ID. Friends can be picked as doubles partners in tournament entries."
          />
          <div className="mt-4">
            <FriendsCard player={player} embedded />
          </div>
        </section>
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
