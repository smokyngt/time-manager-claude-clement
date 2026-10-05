import type { Clock } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import { ClockRow } from '@/features/clocks/components/clock-row'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Duration } from '@/lib/duration'

export type ClocksTableProps = {
  allSelected: boolean
  clocks: Clock[]
  onDelete?: (clock: Clock) => void
  onEdit?: (clock: Clock) => void
  onToggle?: (id: string) => void
  onToggleAll?: () => void
  selectedIds: ReadonlySet<string>
  someSelected: boolean
  totalMs: number
}

export function ClocksTable({
  allSelected,
  clocks,
  onDelete,
  onEdit,
  onToggle,
  onToggleAll,
  selectedIds,
  someSelected,
  totalMs,
}: ClocksTableProps) {
  const { t } = useTranslation('clocks')
  const selectable = onToggle !== undefined && onToggleAll !== undefined
  const actions = onEdit !== undefined || onDelete !== undefined
  const columns = 6 + (selectable ? 1 : 0) + (actions ? 1 : 0)

  return (
    <Card className="overflow-x-auto py-2">
      <Table aria-label={t('table.label')}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectable ? (
              <TableHead className="w-10">
                <Checkbox
                  aria-label={t('table.select_all')}
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  className="pointer-coarse:size-6"
                  onCheckedChange={onToggleAll}
                />
              </TableHead>
            ) : null}
            <TableHead>{t('table.date')}</TableHead>
            <TableHead>{t('table.in')}</TableHead>
            <TableHead>{t('table.out')}</TableHead>
            <TableHead>{t('table.duration')}</TableHead>
            <TableHead>{t('table.source')}</TableHead>
            <TableHead>{t('table.note')}</TableHead>
            {actions ? (
              <TableHead>
                <span className="sr-only">{t('table.actions')}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {clocks.map((clock) => (
            <ClockRow
              clock={clock}
              key={clock.id}
              onDelete={onDelete}
              onEdit={onEdit}
              onToggle={onToggle}
              selected={selectedIds.has(clock.id)}
            />
          ))}
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableCell className="font-semibold" colSpan={selectable ? 4 : 3}>
              {t('table.total')}
            </TableCell>
            <TableCell className="font-semibold tabular-nums">{Duration.format(totalMs)}</TableCell>
            <TableCell colSpan={columns - (selectable ? 5 : 4)} />
          </TableRow>
        </TableBody>
      </Table>
    </Card>
  )
}
