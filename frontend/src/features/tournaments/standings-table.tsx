import type { StandingsRow } from '@/domain/standings'

import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface StandingsTableProps {
  rows: readonly StandingsRow[]
  labelForEntry: (entryId: string) => string
  unresolvedGroups: readonly (readonly string[])[]
}

export function StandingsTable({ rows, labelForEntry, unresolvedGroups }: StandingsTableProps) {
  return (
    <div className="flex flex-col gap-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">Pos</TableHead>
            <TableHead>Entry</TableHead>
            <TableHead className="text-right">P</TableHead>
            <TableHead className="text-right">W</TableHead>
            <TableHead className="text-right">L</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Games</TableHead>
            <TableHead className="text-right">Game diff</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Point diff</TableHead>
            <TableHead className="text-right">Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.entryId}>
              <TableCell className="tabular-nums text-text-muted">{row.position}</TableCell>
              <TableCell className="max-w-64 truncate font-medium text-text">
                {labelForEntry(row.entryId)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.played}</TableCell>
              <TableCell className="text-right tabular-nums">{row.wins}</TableCell>
              <TableCell className="text-right tabular-nums">{row.losses}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {row.gamesWon}–{row.gamesLost}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.gameDifference > 0 ? `+${row.gameDifference}` : row.gameDifference}
              </TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">
                {row.pointDifference > 0 ? `+${row.pointDifference}` : row.pointDifference}
              </TableCell>
              <TableCell className="text-right">
                {row.playoffRequired ? <Badge tone="warning">Playoff</Badge> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {unresolvedGroups.length > 0 ? (
        <p className="text-xs text-text-muted">
          D9 is still level for:{' '}
          {unresolvedGroups
            .map((group) => group.map((entryId) => labelForEntry(entryId)).join(' / '))
            .join('; ')}
          . A playoff decides those places.
        </p>
      ) : null}
    </div>
  )
}
