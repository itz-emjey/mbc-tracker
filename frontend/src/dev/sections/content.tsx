import { Trophy, UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PlayerIdentity } from '@/components/shared/player-identity'
import { StatusBadge } from '@/components/shared/status-badge'
import { Panel, Row, Section } from '@/dev/gallery-ui'

const leaderboard = [
  { rank: 1, name: 'Maria Santos', sp: 1245, movement: 'up', status: 'active' },
  { rank: 2, name: 'Juan Dela Cruz', sp: 1180, movement: 'same', status: 'active' },
  { rank: 3, name: 'Ana Reyes', sp: 1102, movement: 'down', status: 'pending' },
  { rank: 4, name: 'Bong Villanueva', sp: 967, movement: 'up', status: 'active' },
] as const

function CardsSection() {
  return (
    <Section
      id="cards"
      title="Cards"
      description="Flat surfaces with a single 1px border. No shadows, no gradients — hierarchy comes from surface level and spacing."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Club Night</CardTitle>
            <CardDescription>Saturday, 7:00 PM · Matag-ob Sports Center</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted">
              Open play for all active members. Bring your own shuttlecocks.
            </p>
          </CardContent>
          <CardFooter>
            <Button size="sm">Join session</Button>
            <Button size="sm" variant="ghost">
              Details
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>ShuttlePower</CardTitle>
              <StatusBadge status="active" />
            </div>
            <CardDescription>Current season standing</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-3xl font-semibold text-text tabular-nums">1,245</p>
            <p className="mt-1 text-xs text-text-muted">
              <span className="text-accent">+18</span> from 3 matches this week
            </p>
          </CardContent>
        </Card>
      </div>

      <Row label="Empty card slot">
        <Card className="w-full border-dashed bg-transparent">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <Trophy className="size-5 text-text-faint" aria-hidden="true" />
            <p className="text-sm text-text-muted">No tournaments yet this season.</p>
            <Button size="sm" variant="secondary">
              Create tournament
            </Button>
          </CardContent>
        </Card>
      </Row>
    </Section>
  )
}

function TabsSection() {
  return (
    <Section
      id="tabs"
      title="Tabs"
      description="Underline tabs, keyboard navigable with arrow keys (Radix). The active tab is marked by accent border and full-contrast text."
    >
      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="archived">Archived</TabsTrigger>
          <TabsTrigger value="locked" disabled>
            Locked
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          <Panel description="Registration opens 14 days before the event.">
            <p className="text-sm text-text-muted">No upcoming tournaments.</p>
          </Panel>
        </TabsContent>

        <TabsContent value="active">
          <Panel description="Two events in progress.">
            <p className="text-sm text-text-muted">Club Championship · Men&apos;s Doubles</p>
          </Panel>
        </TabsContent>

        <TabsContent value="archived">
          <Panel description="Completed seasons are preserved permanently.">
            <p className="text-sm text-text-muted">Summer Season 2026</p>
          </Panel>
        </TabsContent>
      </Tabs>
    </Section>
  )
}

function TableSection() {
  return (
    <Section
      id="tables"
      title="Tables"
      description="The wrapper owns horizontal scrolling on mobile so the page never scrolls sideways. Numbers use tabular figures."
    >
      <Table>
        <TableCaption>Provisional standings for documentation. Not real club data.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-right">#</TableHead>
            <TableHead>Player</TableHead>
            <TableHead className="text-right">SP</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leaderboard.map((row) => (
            <TableRow key={row.rank}>
              <TableCell className="text-right font-mono text-text-muted tabular-nums">
                {row.rank}
              </TableCell>
              <TableCell>
                <PlayerIdentity name={row.name} size="sm" />
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">
                {row.sp.toLocaleString('en-US')}
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Section>
  )
}

function IdentitySection() {
  const avatarSvg =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="%231d242d"/><circle cx="32" cy="24" r="11" fill="%232ed47a"/><path d="M10 64c0-13 10-20 22-20s22 7 22 20" fill="%232ed47a"/></svg>',
    )

  return (
    <Section
      id="identity"
      title="Avatars and player identity"
      description="Initials fall back automatically when no photo exists. The identity block truncates long names instead of wrapping the layout."
    >
      <Row label="Sizes">
        <div className="w-full max-w-xs rounded-md border border-border bg-surface-1 p-3">
          <PlayerIdentity name="Maria Santos" size="sm" meta="1,245 SP" />
        </div>
        <div className="w-full max-w-xs rounded-md border border-border bg-surface-1 p-3">
          <PlayerIdentity name="Juan Dela Cruz" size="md" meta="1,180 SP" />
        </div>
        <div className="w-full max-w-xs rounded-md border border-border bg-surface-1 p-3">
          <PlayerIdentity name="Ana Reyes" size="lg" meta="1,102 SP" />
        </div>
      </Row>

      <Row label="With photo, status, and action">
        <div className="w-full max-w-sm space-y-3 rounded-md border border-border bg-surface-1 p-4">
          <PlayerIdentity
            name="Bong Villanueva"
            avatarUrl={avatarSvg}
            meta="Doubles · 967 SP"
            trailing={<StatusBadge status="active" />}
          />
          <PlayerIdentity
            name="Ana Reyes"
            meta="Pending approval"
            trailing={
              <Button size="sm" variant="secondary">
                <UserPlus aria-hidden="true" />
                Approve
              </Button>
            }
          />
        </div>
      </Row>

      <Row label="Long name handling">
        <div className="w-64 rounded-md border border-border bg-surface-1 p-3">
          <PlayerIdentity name="Maria Cristina Dela Cruz-Santos" meta="Women's Doubles" />
        </div>
      </Row>
    </Section>
  )
}

export { CardsSection, TabsSection, TableSection, IdentitySection }
