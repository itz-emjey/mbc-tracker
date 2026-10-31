import { Megaphone, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import {
  createAnnouncement,
  listAnnouncements,
  setAnnouncementStatus,
} from '@/features/announcements/api'
import {
  ANNOUNCEMENT_STAFF_ROLES,
  ANNOUNCEMENT_STATUS_LABELS,
  type AnnouncementRecord,
} from '@/features/announcements/types'
import { formatDateTime } from '@/lib/format'

export function AnnouncementsPage() {
  const { user } = useSession()
  const isStaff = hasAnyRole(user?.roles ?? [], ANNOUNCEMENT_STAFF_ROLES)

  const [announcements, setAnnouncements] = React.useState<AnnouncementRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadKey, setReloadKey] = React.useState(0)
  const [createOpen, setCreateOpen] = React.useState(false)

  React.useEffect(() => {
    let active = true

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const next = await listAnnouncements()
        if (active) setAnnouncements(next)
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
  }, [reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  async function moveStatus(announcement: AnnouncementRecord, status: 'published' | 'archived') {
    try {
      await setAnnouncementStatus(announcement.id, status)
      toast.success(status === 'published' ? 'Announcement published.' : 'Announcement archived.')
      reload()
    } catch (statusError) {
      toast.error(errorMessage(statusError))
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Announcements" />
        <LoadingState className="mt-6" label="Loading announcements" rows={4} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Announcements" />
        <ErrorState
          className="mt-6"
          title="Could not load announcements"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Club news. Members see published announcements; staff also see drafts."
        actions={
          isStaff ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              New announcement
            </Button>
          ) : null
        }
      />

      {announcements.length === 0 ? (
        <Card className="mt-5">
          <CardContent className="p-5">
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              description={
                isStaff
                  ? 'Write an announcement and publish it for the club.'
                  : 'There is no club news right now.'
              }
              action={
                isStaff ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden="true" />
                    New announcement
                  </Button>
                ) : null
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {announcements.map((announcement) => (
            <Card key={announcement.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{announcement.title}</CardTitle>
                  <Badge tone={announcement.status === 'published' ? 'accent' : 'neutral'}>
                    {ANNOUNCEMENT_STATUS_LABELS[announcement.status]}
                  </Badge>
                </div>
                <CardDescription>
                  {announcement.published_at
                    ? `Published ${formatDateTime(announcement.published_at)}`
                    : 'Not published yet'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <p className="whitespace-pre-line text-sm text-text-muted">{announcement.body}</p>

                {isStaff ? (
                  <div className="flex flex-wrap gap-2">
                    {announcement.status === 'draft' ? (
                      <Button size="sm" onClick={() => void moveStatus(announcement, 'published')}>
                        Publish
                      </Button>
                    ) : null}
                    {announcement.status !== 'archived' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void moveStatus(announcement, 'archived')}
                      >
                        Archive
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createOpen ? (
        <AnnouncementFormDialog
          open
          onOpenChange={setCreateOpen}
          onCreated={() => {
            setCreateOpen(false)
            reload()
          }}
        />
      ) : null}
    </>
  )
}

function AnnouncementFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [title, setTitle] = React.useState('')
  const [body, setBody] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (title.trim() === '' || body.trim() === '') {
      setError('Enter a title and a body.')
      return
    }

    setSubmitting(true)

    try {
      await createAnnouncement(title.trim(), body.trim())
      toast.success('Draft saved. Publish it when it is ready.')
      onCreated()
    } catch (createError) {
      setError(errorMessage(createError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New announcement</DialogTitle>
          <DialogDescription>It is saved as a draft until you publish it.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="mt-5 flex flex-col gap-4">
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="announcement-title">Title</Label>
              <Input
                id="announcement-title"
                value={title}
                maxLength={160}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="announcement-body">Body</Label>
              <Textarea
                id="announcement-body"
                value={body}
                maxLength={10000}
                onChange={(event) => setBody(event.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Save draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
