import type { Clock } from '@time-manager/sdk'

import { PencilIcon, Trash2Icon } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { TableCell, TableRow } from '@/components/ui/table'
import { Dates } from '@/lib/dates'
import { Duration } from '@/lib/duration'

export type ClockRowProps = {
  clock: Clock
  onDelete?: (clock: Clock) => void
  onEdit?: (clock: Clock) => void
  onToggle?: (id: string) => void
  selected: boolean
}

export const ClockRow = memo(function ClockRow({
  clock,
  onDelete,
  onEdit,
  onToggle,
  selected,
}: ClockRowProps) {
  const { t } = useTranslation('clocks')
  const date = Dates.date(clock.clockedInAt)
  const open = clock.clockedOutAt === null

  return (
    <TableRow data-state={selected ? 'selected' : undefined}>
      {onToggle ? (
        <TableCell>
          <Checkbox
            aria-label={t('table.select_row', { date })}
            checked={selected}
            className="pointer-coarse:size-6"
            onCheckedChange={() => {
              onToggle(clock.id)
            }}
          />
        </TableCell>
      ) : null}
      <TableCell className="font-medium whitespace-nowrap">{date}</TableCell>
      <TableCell className="tabular-nums">{Dates.time(clock.clockedInAt)}</TableCell>
      <TableCell className="tabular-nums">
        {clock.clockedOutAt === null ? (
          <Badge variant="success">{t('table.in_progress')}</Badge>
        ) : (
          Dates.time(clock.clockedOutAt)
        )}
      </TableCell>
      <TableCell className="tabular-nums">
        {clock.durationMs === null ? '-' : Duration.format(clock.durationMs)}
      </TableCell>
      <TableCell>
        <Badge variant={clock.source === 'manual' ? 'default' : 'outline'}>
          {t(`source.${clock.source}`)}
        </Badge>
      </TableCell>
      <TableCell
        className="max-w-48 truncate text-muted-foreground"
        title={clock.note ?? undefined}
      >
        {clock.note ?? '-'}
      </TableCell>
      {onEdit || onDelete ? (
        <TableCell className="text-right whitespace-nowrap">
          {onEdit ? (
            <Button
              aria-label={t('actions.edit', { date })}
              className="pointer-coarse:size-11"
              disabled={open}
              onClick={() => {
                onEdit(clock)
              }}
              size="icon"
              variant="ghost"
            >
              <PencilIcon aria-hidden />
            </Button>
          ) : null}
          {onDelete ? (
            <Button
              aria-label={t('actions.delete', { date })}
              className="pointer-coarse:size-11"
              onClick={() => {
                onDelete(clock)
              }}
              size="icon"
              variant="ghost"
            >
              <Trash2Icon aria-hidden />
            </Button>
          ) : null}
        </TableCell>
      ) : null}
    </TableRow>
  )
})
