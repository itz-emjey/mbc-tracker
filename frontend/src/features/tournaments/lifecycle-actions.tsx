import { Archive, Flag, Play, Send } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/features/auth/api'

import { setTournamentStatus } from './api'
import type { TournamentEventRecord, TournamentRecord, TournamentStatus } from './types'

interface LifecycleActionsProps {
  tournament: TournamentRecord
  events: readonly TournamentEventRecord[]
  onChanged: () => void
}

interface LifecycleAction {
  status: TournamentStatus
  label: string
  title: string
  description: string
  confirmLabel: string
  tone: 'primary' | 'danger'
  icon: React.ReactNode
}

function actionsFor(
  tournament: TournamentRecord,
  missingDraws: readonly TournamentEventRecord[],
): LifecycleAction[] {
  switch (tournament.status) {
    case 'draft':
      return [
        {
          status: 'published',
          label: 'Publish',
          title: 'Publish this tournament?',
          description:
            'Published tournaments become visible to active club members and can accept entries. The lifecycle is forward-only, so it cannot return to draft.',
          confirmLabel: 'Publish tournament',
          tone: 'primary',
          icon: <Send aria-hidden="true" />,
        },
        {
          status: 'archived',
          label: 'Archive',
          title: 'Archive this draft?',
          description:
            'Archived tournaments leave the active list. The draft, its events, and its history are kept.',
          confirmLabel: 'Archive tournament',
          tone: 'danger',
          icon: <Archive aria-hidden="true" />,
        },
      ]
    case 'published':
      return [
        {
          status: 'in_progress',
          label: 'Start tournament',
          title: 'Start this tournament?',
          description:
            missingDraws.length > 0
              ? 'Every event needs a generated draw before the tournament can start.'
              : 'Starting opens result recording and locks the draw and entry lists. It cannot return to published.',
          confirmLabel: 'Start tournament',
          tone: 'primary',
          icon: <Play aria-hidden="true" />,
        },
        {
          status: 'archived',
          label: 'Archive',
          title: 'Archive this tournament?',
          description:
            'Archived tournaments leave the active list. Published events, entries, and results are kept in history.',
          confirmLabel: 'Archive tournament',
          tone: 'danger',
          icon: <Archive aria-hidden="true" />,
        },
      ]
    case 'in_progress':
      return [
        {
          status: 'completed',
          label: 'Complete tournament',
          title: 'Mark this tournament complete?',
          description:
            'Completing freezes the official record. Results can no longer be recorded or corrected in the app.',
          confirmLabel: 'Complete tournament',
          tone: 'primary',
          icon: <Flag aria-hidden="true" />,
        },
      ]
    case 'completed':
      return [
        {
          status: 'archived',
          label: 'Archive',
          title: 'Archive this tournament?',
          description:
            'Archived tournaments leave the active list. The completed bracket, standings, and results are kept.',
          confirmLabel: 'Archive tournament',
          tone: 'danger',
          icon: <Archive aria-hidden="true" />,
        },
      ]
    case 'archived':
      return []
  }
}

/**
 * Forward-only lifecycle controls. The database enforces the same transitions;
 * this component only decides which confirmed action to offer and blocks a
 * start before every event has a draw.
 */
export function LifecycleActions({ tournament, events, onChanged }: LifecycleActionsProps) {
  const missingDraws = events.filter((event) => event.draw_generated_at === null)
  const actions = actionsFor(tournament, missingDraws)
  const startBlocked =
    tournament.status === 'published' && (events.length === 0 || missingDraws.length > 0)

  async function changeStatus(status: TournamentStatus) {
    try {
      await setTournamentStatus(tournament.id, status)
      toast.success(
        status === 'in_progress'
          ? 'Tournament started. Results can now be recorded.'
          : status === 'published'
            ? 'Tournament published.'
            : status === 'completed'
              ? 'Tournament completed.'
              : 'Tournament archived.',
      )
      onChanged()
    } catch (statusError) {
      throw new Error(errorMessage(statusError), { cause: statusError })
    }
  }

  if (actions.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        This tournament is archived. Its record stays available as history.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action) => {
          const blocked = action.status === 'in_progress' && startBlocked

          return (
            <ConfirmDialog
              key={action.status}
              trigger={
                <Button
                  variant={action.tone === 'primary' ? 'primary' : 'secondary'}
                  disabled={blocked}
                >
                  {action.icon}
                  {action.label}
                </Button>
              }
              title={action.title}
              description={action.description}
              confirmLabel={action.confirmLabel}
              tone={action.tone}
              onConfirm={() => changeStatus(action.status)}
            />
          )
        })}
      </div>

      {startBlocked ? (
        <p className="text-xs text-text-muted">
          {events.length === 0
            ? 'Add at least one event, then generate its draw.'
            : `Generate a draw for ${missingDraws.length} event${
                missingDraws.length === 1 ? '' : 's'
              } before starting.`}
        </p>
      ) : null}
    </div>
  )
}
