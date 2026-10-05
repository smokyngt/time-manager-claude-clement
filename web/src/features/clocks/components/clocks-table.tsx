import { PencilIcon, Trash2Icon } from 'lucide-react'

import type { Clock } from '@/features/clocks/api/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatClockTime, formatDateLabel, formatDurationMs } from '@/features/clocks/lib/format'

export function ClocksTable({
  can_manage,
  clocks,
  more,
  onDelete,
  onEdit,
  total_ms,
}: {
  can_manage: boolean
  clocks: Clock[]
  more: boolean
  onDelete: (clock: Clock) => void
  onEdit: (clock: Clock) => void
  total_ms: number
}) {
  return (
    <Card className="py-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Date</TableHead>
            <TableHead>In</TableHead>
            <TableHead>Out</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Note</TableHead>
            {can_manage ? (
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clocks.map((clock) => (
            <TableRow key={clock.id}>
              <TableCell className="font-medium whitespace-nowrap">
                {formatDateLabel(clock.clocked_in_at)}
              </TableCell>
              <TableCell className="tabular-nums">{formatClockTime(clock.clocked_in_at)}</TableCell>
              <TableCell className="tabular-nums">
                {clock.clocked_out_at === null ? (
                  <Badge variant="success">In progress</Badge>
                ) : (
                  formatClockTime(clock.clocked_out_at)
                )}
              </TableCell>
              <TableCell className="tabular-nums">{formatDurationMs(clock.duration_ms)}</TableCell>
              <TableCell>
                <Badge
                  className="capitalize"
                  variant={clock.source === 'manual' ? 'default' : 'outline'}
                >
                  {clock.source}
                </Badge>
              </TableCell>
              <TableCell
                className="max-w-48 truncate text-muted-foreground"
                title={clock.note ?? undefined}
              >
                {clock.note ?? '-'}
              </TableCell>
              {can_manage ? (
                <TableCell className="text-right whitespace-nowrap">
                  <Button
                    aria-label={`Edit entry of ${formatDateLabel(clock.clocked_in_at)}`}
                    disabled={clock.clocked_out_at === null}
                    onClick={() => {
                      onEdit(clock)
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    aria-label={`Delete entry of ${formatDateLabel(clock.clocked_in_at)}`}
                    onClick={() => {
                      onDelete(clock)
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2Icon />
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          ))}
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell className="font-semibold" colSpan={3}>
              {more ? 'Total (loaded entries)' : 'Total'}
            </TableCell>
            <TableCell className="font-semibold tabular-nums">
              {formatDurationMs(total_ms)}
            </TableCell>
            <TableCell colSpan={can_manage ? 3 : 2} />
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  )
}
