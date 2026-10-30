import { Plus, Search, Trash2 } from 'lucide-react'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/shared/form-field'
import { StatusBadge } from '@/components/shared/status-badge'
import { Section, Row, StateCell, Panel } from '@/dev/gallery-ui'
import { cn } from '@/lib/cn'
import { STATUS_LABELS } from '@/dev/status-labels'

function ButtonsSection() {
  return (
    <Section
      id="buttons"
      title="Buttons"
      description="Five intent variants, four sizes. Loading disables the control and sets aria-busy. Hover and focus are shown forced for documentation."
    >
      <Row label="Variants">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
      </Row>

      <Row label="Sizes">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Add">
          <Plus aria-hidden="true" />
        </Button>
      </Row>

      <Row label="With icons">
        <Button>
          <Plus aria-hidden="true" />
          Add player
        </Button>
        <Button variant="secondary">
          <Search aria-hidden="true" />
          Search
        </Button>
        <Button variant="danger" size="sm">
          <Trash2 aria-hidden="true" />
          Delete
        </Button>
      </Row>

      <Row
        label="State matrix"
        hint="Simulated states are labelled — real hover/focus require interaction."
      >
        <StateCell label="Normal">
          <Button>Primary</Button>
        </StateCell>
        <StateCell label="Hover (simulated)">
          <Button className="bg-accent-hover">Primary</Button>
        </StateCell>
        <StateCell label="Focus (simulated)">
          <Button className="ring-2 ring-accent-ring">Primary</Button>
        </StateCell>
        <StateCell label="Disabled">
          <Button disabled>Primary</Button>
        </StateCell>
        <StateCell label="Loading">
          <Button loading>Saving</Button>
        </StateCell>
      </Row>

      <Row label="Disabled variants">
        <Button disabled>Primary</Button>
        <Button variant="secondary" disabled>
          Secondary
        </Button>
        <Button variant="ghost" disabled>
          Ghost
        </Button>
        <Button variant="danger" disabled>
          Danger
        </Button>
      </Row>

      <Panel title="Full width on mobile" description="Buttons never overflow their container.">
        <Button className="w-full sm:w-auto">Continue</Button>
      </Panel>
    </Section>
  )
}

function FormsSection() {
  const [email, setEmail] = React.useState('')
  const [error, setError] = React.useState<string | undefined>()
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!email.trim()) {
      setError('Enter an email address.')
      return
    }

    setError(undefined)
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setDone(true)
    }, 700)
  }

  return (
    <Section
      id="forms"
      title="Inputs, selects, and validation"
      description="FormField wires id, aria-describedby, and aria-invalid through a render prop so a control cannot be built without its accessibility attributes."
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="gallery-name"
          label="Player name"
          description="As it appears on the club roster."
        >
          {(field) => <Input {...field} placeholder="Juan Dela Cruz" />}
        </FormField>

        <FormField
          id="gallery-required"
          label="Contact number"
          required
          description="Visible to trainers only."
        >
          {(field) => <Input {...field} type="tel" placeholder="09xx xxx xxxx" />}
        </FormField>

        <FormField
          id="gallery-error"
          label="Email"
          error="That email is already registered."
          required
        >
          {(field) => <Input {...field} type="email" defaultValue="maria@example.com" />}
        </FormField>

        <FormField
          id="gallery-disabled"
          label="Account link"
          disabled
          description="Set by an admin after approval."
        >
          {(field) => <Input {...field} value="Not linked" readOnly />}
        </FormField>

        <FormField
          id="gallery-notes"
          label="Session notes"
          description="Optional, visible to trainers."
          className="sm:col-span-2"
        >
          {(field) => <Textarea {...field} placeholder="Focus on footwork and net play." />}
        </FormField>

        <FormField id="gallery-discipline" label="Discipline" required>
          {(field) => (
            <Select defaultValue="singles">
              <SelectTrigger id={field.id} aria-describedby={field['aria-describedby']}>
                <SelectValue placeholder="Choose a discipline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="singles">Singles</SelectItem>
                <SelectItem value="mens-doubles">Men&apos;s Doubles</SelectItem>
                <SelectItem value="womens-doubles">Women&apos;s Doubles</SelectItem>
                <SelectItem value="mixed-doubles">Mixed Doubles</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>

        <FormField
          id="gallery-select-error"
          label="Payment method"
          error="Select how the payment was received."
        >
          {(field) => (
            <Select>
              <SelectTrigger
                id={field.id}
                aria-invalid={field['aria-invalid']}
                aria-describedby={field['aria-describedby']}
              >
                <SelectValue placeholder="Choose a method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="gcash">GCash</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>

      <Panel
        title="Interactive validation"
        description="Submitting empty shows the error state; success shows a confirmation."
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:max-w-sm" noValidate>
          <FormField id="gallery-live-email" label="Email" error={error} required>
            {(field) => (
              <Input
                {...field}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="player@example.com"
              />
            )}
          </FormField>

          <div className="flex items-center gap-2">
            <Button type="submit" loading={submitting}>
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEmail('')
                setError(undefined)
                setDone(false)
              }}
            >
              Reset
            </Button>
            {done ? <span className="text-xs text-accent">Saved</span> : null}
          </div>
        </form>
      </Panel>
    </Section>
  )
}

function BadgesSection() {
  return (
    <Section
      id="badges"
      title="Badges and status indicators"
      description="Tones come from tokens only. StatusBadge draws from the shared status vocabulary, so a new status never needs a new colour."
    >
      <Row label="Tones">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="accent">Accent</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
        <Badge tone="info">Info</Badge>
        <Badge tone="outline">Outline</Badge>
      </Row>

      <Row label="Sizes">
        <Badge size="sm" tone="accent">
          Small
        </Badge>
        <Badge size="md" tone="accent">
          Medium
        </Badge>
      </Row>

      <Row label="Status vocabulary">
        {STATUS_LABELS.map((status) => (
          <StatusBadge key={status} status={status} />
        ))}
      </Row>

      <Row label="Inline indicator with dot">
        <span className="inline-flex items-center gap-2 text-xs text-text-muted">
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
          Live
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-text-muted">
          <span className="size-1.5 rounded-full bg-warning" aria-hidden="true" />
          Awaiting approval
        </span>
        <span className="inline-flex items-center gap-2 text-xs text-text-muted">
          <span className="size-1.5 rounded-full bg-danger" aria-hidden="true" />
          Disputed
        </span>
      </Row>

      <Row label="Link-styled action">
        <a href="#badges" className={cn(buttonVariants({ variant: 'link', size: 'sm' }))}>
          View all statuses
        </a>
      </Row>
    </Section>
  )
}

export { ButtonsSection, FormsSection, BadgesSection }
