import { BarChart3, Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ArenaStatStrip } from '@/components/arena/arena-ui'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/features/auth/api'
import { useSession } from '@/features/auth/session-context'
import { hasAnyRole } from '@/features/auth/types'
import { getPlayerByProfile } from '@/features/players/api'
import {
  castPollVote,
  createPoll,
  getPollResults,
  listPollOptions,
  listPolls,
  setPollStatus,
} from '@/features/polls/api'
import {
  POLL_MODE_LABELS,
  POLL_STAFF_ROLES,
  POLL_STATUS_LABELS,
  type PollMode,
  type PollOptionRecord,
  type PollRecord,
  type PollResults,
} from '@/features/polls/types'
import { formatDateTime } from '@/lib/format'

interface PollView {
  poll: PollRecord
  options: PollOptionRecord[]
  results: PollResults
}

export function PollsPage() {
  const { user } = useSession()
  const isStaff = hasAnyRole(user?.roles ?? [], POLL_STAFF_ROLES)

  const [views, setViews] = React.useState<PollView[]>([])
  const [hasPlayer, setHasPlayer] = React.useState(false)
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
        const [polls, options] = await Promise.all([listPolls(), listPollOptions()])
        const results = await Promise.all(polls.map((poll) => getPollResults(poll.id)))
        const player = user ? await getPlayerByProfile(user.id) : null

        if (!active) return

        setViews(
          polls.map((poll, index) => ({
            poll,
            options: options.filter((option) => option.poll_id === poll.id),
            results: results[index]!,
          })),
        )
        setHasPlayer(player !== null)
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
  }, [user, reloadKey])

  const reload = React.useCallback(() => setReloadKey((current) => current + 1), [])

  const openPolls = views.filter((view) => view.poll.status === 'open').length
  const voted = views.filter((view) => view.results.my_option_ids.length > 0).length

  async function closePoll(poll: PollRecord) {
    try {
      await setPollStatus(poll.id, 'closed')
      toast.success('Poll closed.')
      reload()
    } catch (closeError) {
      toast.error(errorMessage(closeError))
    }
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Polls" />
        <LoadingState className="mt-6" label="Loading polls" rows={4} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Polls" />
        <ErrorState
          className="mt-6"
          title="Could not load polls"
          description={error}
          onRetry={reload}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        kicker="Club vote"
        title="Polls"
        description="Club votes. One response per player; tallies never reveal who voted unless the poll says otherwise."
        actions={
          isStaff ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus aria-hidden="true" />
              New poll
            </Button>
          ) : null
        }
      />

      <ArenaStatStrip
        className="mt-5"
        stats={[
          { label: 'Polls', value: String(views.length), detail: 'On the club record' },
          { label: 'Open', value: String(openPolls), detail: 'Taking responses' },
          { label: 'Closed', value: String(views.length - openPolls), detail: 'Results final' },
          { label: 'You voted', value: String(voted), detail: 'Responses recorded' },
        ]}
      />

      {views.length === 0 ? (
        <Card className="mt-4">
          <CardContent className="p-5">
            <EmptyState
              icon={BarChart3}
              title="No polls yet"
              description={
                isStaff
                  ? 'Create a poll with at least two options and open it for the club.'
                  : 'Club staff have not opened a poll yet.'
              }
              action={
                isStaff ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus aria-hidden="true" />
                    New poll
                  </Button>
                ) : null
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {views.map(({ poll, options, results }) => (
            <Card key={poll.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle>{poll.question}</CardTitle>
                  <div className="flex items-center gap-1.5">
                    {poll.is_anonymous ? <Badge tone="neutral">Anonymous</Badge> : null}
                    <Badge tone={poll.status === 'open' ? 'accent' : 'neutral'}>
                      {POLL_STATUS_LABELS[poll.status]}
                    </Badge>
                  </div>
                </div>
                <CardDescription>
                  {poll.description ?? `${POLL_MODE_LABELS[poll.mode]} poll.`}
                  {poll.closes_at ? ` Closes ${formatDateTime(poll.closes_at)}.` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <PollBallot
                  poll={poll}
                  options={options}
                  results={results}
                  canVote={hasPlayer && poll.status === 'open'}
                  onVoted={reload}
                />

                {results.results_visible ? (
                  <div className="flex flex-col gap-2">
                    {results.options.map((option) => {
                      const total = results.options.reduce(
                        (sum, entry) => sum + (entry.count ?? 0),
                        0,
                      )
                      const share =
                        total === 0 ? 0 : Math.round(((option.count ?? 0) / total) * 100)

                      return (
                        <div key={option.id} className="flex items-center gap-2 text-sm">
                          <span className="w-40 truncate text-text-muted">{option.label}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full bg-accent" style={{ width: `${share}%` }} />
                          </div>
                          <span className="w-16 text-right font-mono text-xs tabular-nums text-text-muted">
                            {option.count} · {share}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-text-muted">
                    Results stay hidden until the poll closes.
                  </p>
                )}

                {isStaff && poll.status === 'open' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="self-start"
                    onClick={() => void closePoll(poll)}
                  >
                    Close poll
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {createOpen ? (
        <PollFormDialog
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

function PollBallot({
  poll,
  options,
  results,
  canVote,
  onVoted,
}: {
  poll: PollRecord
  options: readonly PollOptionRecord[]
  results: PollResults
  canVote: boolean
  onVoted: () => void
}) {
  const [selected, setSelected] = React.useState<string[]>(results.my_option_ids)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const voted = results.my_option_ids.length > 0

  function toggle(optionId: string) {
    if (poll.mode === 'single') {
      setSelected([optionId])
      return
    }

    setSelected((current) =>
      current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId],
    )
  }

  async function vote() {
    setError(null)

    if (selected.length === 0) {
      setError('Choose at least one option.')
      return
    }

    setSubmitting(true)

    try {
      await castPollVote(poll.id, selected)
      toast.success(voted ? 'Vote updated.' : 'Vote recorded.')
      onVoted()
    } catch (voteError) {
      setError(errorMessage(voteError))
    } finally {
      setSubmitting(false)
    }
  }

  if (!canVote) {
    return voted ? (
      <p className="text-xs text-text-muted">Your response is recorded.</p>
    ) : (
      <p className="text-xs text-text-muted">
        {poll.status === 'open' ? 'Link a player record to vote.' : 'Voting is closed.'}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5" role="group" aria-label={poll.question}>
        {options.map((option) => {
          const active = selected.includes(option.id)

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(option.id)}
              className={`flex items-center justify-between rounded-sm border px-3 py-2 text-left text-sm transition-colors duration-fast ${
                active
                  ? 'border-accent bg-accent-soft text-text'
                  : 'border-border bg-surface-2 text-text-muted hover:text-text'
              }`}
            >
              <span className="truncate">{option.label}</span>
              {active ? <span className="text-xs text-accent">Selected</span> : null}
            </button>
          )
        })}
      </div>

      <Button size="sm" className="self-start" loading={submitting} onClick={() => void vote()}>
        {voted ? 'Update vote' : 'Submit vote'}
      </Button>
    </div>
  )
}

function PollFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [question, setQuestion] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [mode, setMode] = React.useState<PollMode>('single')
  const [anonymous, setAnonymous] = React.useState<'yes' | 'no'>('no')
  const [showResults, setShowResults] = React.useState<'yes' | 'no'>('no')
  const [closesAt, setClosesAt] = React.useState('')
  const [optionText, setOptionText] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const options = optionText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '')

    if (question.trim() === '') {
      setError('Enter a question.')
      return
    }

    if (options.length < 2) {
      setError('Add at least two options, one per line.')
      return
    }

    setSubmitting(true)

    try {
      const created = await createPoll({
        question: question.trim(),
        description: description.trim() === '' ? null : description.trim(),
        mode,
        is_anonymous: anonymous === 'yes',
        show_results: showResults === 'yes',
        opens_at: null,
        closes_at: closesAt === '' ? null : new Date(closesAt).toISOString(),
        options,
      })
      await setPollStatus(created.id, 'open')
      toast.success('Poll created and opened.')
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
          <DialogTitle>New poll</DialogTitle>
          <DialogDescription>It is created and opened immediately.</DialogDescription>
        </DialogHeader>

        <form onSubmit={(event) => void submit(event)} noValidate>
          <div className="mt-5 flex flex-col gap-4">
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="poll-question">Question</Label>
              <Input
                id="poll-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="poll-description">Description</Label>
              <Textarea
                id="poll-description"
                value={description}
                maxLength={2000}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="poll-mode">Mode</Label>
                <Select value={mode} onValueChange={(value) => setMode(value as PollMode)}>
                  <SelectTrigger id="poll-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single choice</SelectItem>
                    <SelectItem value="multiple">Multiple choice</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="poll-closes">Closes at</Label>
                <Input
                  id="poll-closes"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(event) => setClosesAt(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="poll-anonymous">Anonymous</Label>
                <Select
                  value={anonymous}
                  onValueChange={(value) => setAnonymous(value as 'yes' | 'no')}
                >
                  <SelectTrigger id="poll-anonymous">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Show who voted</SelectItem>
                    <SelectItem value="yes">Anonymous</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="poll-results">Results while open</Label>
                <Select
                  value={showResults}
                  onValueChange={(value) => setShowResults(value as 'yes' | 'no')}
                >
                  <SelectTrigger id="poll-results">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="no">Hide until closed</SelectItem>
                    <SelectItem value="yes">Show live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="poll-options">Options (one per line)</Label>
              <Textarea
                id="poll-options"
                value={optionText}
                placeholder={'Design A\nDesign B'}
                onChange={(event) => setOptionText(event.target.value)}
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
              Create and open
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
