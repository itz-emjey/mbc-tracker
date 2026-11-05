import {
  CalendarRange,
  Clock,
  Inbox,
  Link2,
  ListChecks,
  ShieldCheck,
  Unlink,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import * as React from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { SectionHeading } from '@/components/arena/arena-ui'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ApproveRegistrationDialog } from '@/features/admin/approve-registration-dialog'
import { EditRolesDialog } from '@/features/admin/edit-roles-dialog'
import { LinkPlayerDialog } from '@/features/admin/link-player-dialog'
import { RejectRegistrationDialog } from '@/features/admin/reject-registration-dialog'
import {
  errorMessage,
  listMembers,
  listPendingRegistrations,
  listUnlinkedPlayers,
  setProfileStatus,
  type MemberSummary,
  type RegistrationRequestSummary,
  type UnlinkedPlayer,
} from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { ROLE_LABELS } from '@/features/auth/types'
import { unlinkPlayerAccount } from '@/features/players/api'

type MemberStatus = 'active' | 'suspended' | 'deactivated'

function formatRequested(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function AdminPage() {
  const { user, refresh } = useSession()
  const [pending, setPending] = React.useState<RegistrationRequestSummary[]>([])
  const [members, setMembers] = React.useState<MemberSummary[]>([])
  const [players, setPlayers] = React.useState<UnlinkedPlayer[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [tab, setTab] = React.useState('pending')
  const [approving, setApproving] = React.useState<RegistrationRequestSummary | null>(null)
  const [rejecting, setRejecting] = React.useState<RegistrationRequestSummary | null>(null)
  const [editingRoles, setEditingRoles] = React.useState<MemberSummary | null>(null)
  const [linking, setLinking] = React.useState<MemberSummary | null>(null)

  const reload = React.useCallback(() => {
    setLoading(true)
    setError(null)
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true

    void Promise.all([listPendingRegistrations(), listMembers(), listUnlinkedPlayers()])
      .then(([nextPending, nextMembers, nextPlayers]) => {
        if (!active) return

        setPending(nextPending)
        setMembers(nextMembers)
        setPlayers(nextPlayers)
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
  }, [reloadKey])

  async function changeStatus(member: MemberSummary, status: MemberStatus) {
    try {
      await setProfileStatus(member.id, status)
      toast.success(`${member.full_name} is now ${status}.`)
      reload()
    } catch (statusError) {
      throw new Error(errorMessage(statusError), { cause: statusError })
    }
  }

  async function unlink(member: MemberSummary) {
    if (!member.player_id) return

    try {
      await unlinkPlayerAccount(member.player_id)
      toast.success(`${member.full_name} is no longer linked to a player record.`)
      reload()
    } catch (unlinkError) {
      throw new Error(errorMessage(unlinkError), { cause: unlinkError })
    }
  }

  function handleRolesSaved() {
    reload()
    void refresh()
  }

  const isSelf = (member: MemberSummary) => member.id === user?.id
  const activeMembers = members.filter((member) => member.status === 'active').length

  return (
    <>
      <PageHeader
        kicker="Operations"
        title="Administration"
        description="Approve registrations, link player records, assign roles, and manage account access."
        stats={[
          { label: 'Pending', value: String(pending.length) },
          { label: 'Members', value: String(members.length) },
          { label: 'Active', value: String(activeMembers) },
          { label: 'Unlinked players', value: String(players.length) },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link to="/admin/seasons">
                <CalendarRange aria-hidden="true" />
                Seasons
              </Link>
            </Button>
            <Badge tone={pending.length > 0 ? 'warning' : 'neutral'}>
              {pending.length} pending
            </Badge>
          </div>
        }
      />

      {error ? (
        <ErrorState
          className="mt-5"
          title="Could not load administration data"
          description={error}
          onRetry={reload}
        />
      ) : null}

      <div className="mt-6">
        <SectionHeading
          index="01"
          title="Members & access"
          description="Approvals, roles, and account links for the club roster."
        />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-4">
        <TabsList>
          <TabsTrigger value="pending">
            <Inbox className="size-3.5" aria-hidden="true" />
            Pending requests
            {pending.length > 0 ? (
              <Badge tone="warning" className="ml-1">
                {pending.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="members">
            <Users className="size-3.5" aria-hidden="true" />
            Members
            <Badge tone="neutral" className="ml-1">
              {members.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {loading ? (
            <LoadingState label="Loading registration requests" />
          ) : pending.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No pending requests"
              description="New registrations appear here for review. Approving is idempotent, so a double-click cannot create a second player or SP award."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-text-faint" aria-hidden="true" />
                        <span className="font-medium text-text">{request.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-text-muted">{request.email}</TableCell>
                    <TableCell className="whitespace-nowrap text-text-muted">
                      {formatRequested(request.requested_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => setApproving(request)}>
                          Review
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRejecting(request)}>
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="members">
          {loading ? (
            <LoadingState label="Loading members" />
          ) : members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No approved members yet"
              description="Approved accounts appear here. Their roles and access status are managed from this tab."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table containerClassName="rounded-none border-0">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead>Player record</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Access</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <span className="font-medium text-text">{member.full_name}</span>
                          {isSelf(member) ? (
                            <Badge tone="accent" className="ml-2">
                              You
                            </Badge>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {member.roles.length === 0 ? (
                              <span className="text-xs text-text-faint">No roles</span>
                            ) : (
                              member.roles.map((role) => (
                                <Badge key={role} tone="neutral">
                                  {ROLE_LABELS[role]}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.player_id && member.player_name ? (
                            <Link
                              to={`/players/${member.player_id}`}
                              className="rounded-sm text-sm font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                            >
                              {member.player_name}
                            </Link>
                          ) : (
                            <span className="text-xs text-text-faint">Not linked</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={member.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingRoles(member)}
                            >
                              <ListChecks aria-hidden="true" />
                              Roles
                            </Button>

                            {member.player_id ? (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="ghost" size="sm">
                                    <Unlink aria-hidden="true" />
                                    Unlink
                                  </Button>
                                }
                                title={`Unlink ${member.full_name} from ${member.player_name ?? 'the player record'}?`}
                                description="The account keeps its roles and can still sign in, but it will no longer be attached to this player record. Player history is retained."
                                confirmLabel="Unlink account"
                                onConfirm={() => unlink(member)}
                              />
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => setLinking(member)}>
                                <Link2 aria-hidden="true" />
                                Link
                              </Button>
                            )}

                            {isSelf(member) ? (
                              <span className="self-center text-xs text-text-faint">
                                Manage another admin
                              </span>
                            ) : member.status === 'active' ? (
                              <>
                                <ConfirmDialog
                                  trigger={
                                    <Button variant="ghost" size="sm">
                                      <UserX aria-hidden="true" />
                                      Suspend
                                    </Button>
                                  }
                                  title={`Suspend ${member.full_name}?`}
                                  description="Role-based access stops immediately. Records and history are retained, and the account can be reactivated later."
                                  confirmLabel="Suspend account"
                                  onConfirm={() => changeStatus(member, 'suspended')}
                                />
                                <ConfirmDialog
                                  trigger={
                                    <Button variant="ghost" size="sm">
                                      <ShieldCheck aria-hidden="true" />
                                      Deactivate
                                    </Button>
                                  }
                                  title={`Deactivate ${member.full_name}?`}
                                  description="Access closes immediately and stays closed until a Super Admin reactivates the account. Records and history are retained."
                                  confirmLabel="Deactivate account"
                                  onConfirm={() => changeStatus(member, 'deactivated')}
                                />
                              </>
                            ) : (
                              <ConfirmDialog
                                trigger={
                                  <Button variant="secondary" size="sm">
                                    <UserCheck aria-hidden="true" />
                                    Reactivate
                                  </Button>
                                }
                                title={`Reactivate ${member.full_name}?`}
                                description="The account returns to active status with its existing role assignments. Audit history is retained."
                                confirmLabel="Reactivate account"
                                tone="primary"
                                onConfirm={() => changeStatus(member, 'active')}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <ApproveRegistrationDialog
        key={approving?.id ?? 'approve-none'}
        request={approving}
        players={players}
        onOpenChange={(open) => {
          if (!open) setApproving(null)
        }}
        onApproved={reload}
      />

      <RejectRegistrationDialog
        key={rejecting?.id ?? 'reject-none'}
        request={rejecting}
        onOpenChange={(open) => {
          if (!open) setRejecting(null)
        }}
        onRejected={reload}
      />

      <EditRolesDialog
        key={editingRoles?.id ?? 'roles-none'}
        member={editingRoles}
        isSelf={editingRoles?.id === user?.id}
        onOpenChange={(open) => {
          if (!open) setEditingRoles(null)
        }}
        onSaved={handleRolesSaved}
      />

      <LinkPlayerDialog
        key={linking?.id ?? 'link-none'}
        member={linking}
        players={players}
        onOpenChange={(open) => {
          if (!open) setLinking(null)
        }}
        onLinked={reload}
      />
    </>
  )
}
