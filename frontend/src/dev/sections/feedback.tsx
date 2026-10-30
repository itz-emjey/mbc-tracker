import { CalendarX, MoreHorizontal, Pencil, Trash2, UserX } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/form-field'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LoadingState } from '@/components/shared/loading-state'
import { Panel, Row, Section } from '@/dev/gallery-ui'

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function DialogsSection() {
  return (
    <Section
      id="dialogs"
      title="Dialogs and confirmation"
      description="Focus is trapped and returned to the trigger. Escape closes; the backdrop is not a decorative blur, just a flat overlay."
    >
      <Row label="Standard dialog">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Record payment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record payment</DialogTitle>
              <DialogDescription>
                Manual recordkeeping only. This does not charge the player.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField id="dlg-amount" label="Amount" required>
                {(field) => <Input {...field} inputMode="decimal" placeholder="500.00" />}
              </FormField>
              <FormField id="dlg-month" label="Covered month" required>
                {(field) => <Input {...field} type="month" defaultValue="2026-10" />}
              </FormField>
            </div>

            <DialogFooter>
              <Button variant="secondary">Cancel</Button>
              <Button onClick={() => toast.success('Payment recorded')}>Save payment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Row>

      <Row label="Destructive confirmation" hint="Stays open while the action runs.">
        <ConfirmDialog
          trigger={
            <Button variant="danger">
              <UserX aria-hidden="true" />
              Suspend player
            </Button>
          }
          title="Suspend this player?"
          description="Maria Santos will lose access until reactivated. Match history, SP ledger entries, and payment records are kept."
          confirmLabel="Suspend player"
          onConfirm={async () => {
            await wait(600)
            toast.success('Player suspended')
          }}
        />
      </Row>
    </Section>
  )
}

function MenusSection() {
  const [notify, setNotify] = React.useState(true)

  return (
    <Section
      id="menus"
      title="Dropdown menus"
      description="Keyboard navigable with arrow keys, Home/End, and Escape (Radix). Destructive items are the only red affordance in a menu."
    >
      <Row label="Row actions menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Row actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Player</DropdownMenuLabel>
            <DropdownMenuItem>
              <Pencil aria-hidden="true" />
              Edit profile
            </DropdownMenuItem>
            <DropdownMenuCheckboxItem checked={notify} onCheckedChange={setNotify}>
              Match notifications
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive>
              <Trash2 aria-hidden="true" />
              Delete record
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Row>
    </Section>
  )
}

function ToastsSection() {
  return (
    <Section
      id="toasts"
      title="Toasts"
      description="Bottom-right, 400px max width, no coloured glow. Errors carry a danger border only."
    >
      <Row label="Variants">
        <Button variant="secondary" onClick={() => toast('Result submitted')}>
          Default
        </Button>
        <Button variant="secondary" onClick={() => toast.success('Payment recorded')}>
          Success
        </Button>
        <Button variant="secondary" onClick={() => toast.error('Could not save the result')}>
          Error
        </Button>
        <Button
          variant="secondary"
          onClick={() => toast.warning('Approval window closes in 2 hours')}
        >
          Warning
        </Button>
        <Button variant="secondary" onClick={() => toast.info('Season ends in 9 days')}>
          Info
        </Button>
      </Row>

      <Row label="With action">
        <Button
          variant="secondary"
          onClick={() =>
            toast('Match result submitted', {
              description: 'The losing player has 24 hours to approve or dispute.',
              action: { label: 'View', onClick: () => toast('Opening match') },
            })
          }
        >
          Toast with action
        </Button>
      </Row>
    </Section>
  )
}

function StatesSection() {
  return (
    <Section
      id="states"
      title="Loading, empty, and error states"
      description="Every list and panel needs all three. Empty states always explain the next action; errors never expose raw messages."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Loading — skeleton">
          <LoadingState rows={4} />
        </Panel>

        <Panel title="Loading — spinner">
          <LoadingState variant="spinner" label="Loading standings" />
        </Panel>

        <Panel title="Empty">
          <EmptyState
            icon={CalendarX}
            title="No training sessions yet"
            description="Create the first session to start recording attendance."
            action={<Button size="sm">Create session</Button>}
          />
        </Panel>

        <Panel title="Error">
          <ErrorState
            description="The standings could not be loaded. Check your connection and try again."
            onRetry={() => toast('Retrying')}
          />
        </Panel>

        <Panel title="Error — inline field">
          <div className="max-w-sm">
            <FormField
              id="state-inline"
              label="Player name"
              error="A player with this name already exists."
            >
              {(field) => <Input {...field} defaultValue="Maria Santos" />}
            </FormField>
          </div>
        </Panel>

        <Panel title="Error — compact">
          <ErrorState description="This result was disputed and cannot award SP yet." />
        </Panel>
      </div>
    </Section>
  )
}

export { DialogsSection, MenusSection, ToastsSection, StatesSection }
