import type { ReactNode } from 'react'

import { Fragment } from 'react'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/cn'

export type ResponsiveTableColumn<T> = {
  align?: 'left' | 'right'
  cardLabel?: string
  cell: (row: T) => ReactNode
  header: ReactNode
  hideOnCard?: boolean
  id: string
  primary?: boolean
}

export type ResponsiveTableProps<T> = {
  actions?: (row: T) => ReactNode
  actionsLabel?: string
  caption: string
  columns: ResponsiveTableColumn<T>[]
  getRowKey: (row: T) => string
  rows: T[]
  selectCell?: (row: T) => ReactNode
  selectHeader?: ReactNode
}

export function ResponsiveTable<T>({
  actions,
  actionsLabel,
  caption,
  columns,
  getRowKey,
  rows,
  selectCell,
  selectHeader,
}: ResponsiveTableProps<T>) {
  const wide = useMediaQuery('(min-width: 768px)')

  if (wide) {
    return (
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {selectCell ? <TableHead className="w-10">{selectHeader}</TableHead> : null}
            {columns.map((column) =>
              typeof column.header === 'string' ? (
                <TableHead className={cn(column.align === 'right' && 'text-right')} key={column.id}>
                  {column.header}
                </TableHead>
              ) : (
                <Fragment key={column.id}>{column.header}</Fragment>
              ),
            )}
            {actions ? (
              <TableHead className="w-12 text-right">
                <span className="sr-only">{actionsLabel}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowKey(row)}>
              {selectCell ? <TableCell className="w-10">{selectCell(row)}</TableCell> : null}
              {columns.map((column) => (
                <TableCell
                  className={cn(column.align === 'right' && 'text-right tabular-nums')}
                  key={column.id}
                >
                  {column.cell(row)}
                </TableCell>
              ))}
              {actions ? <TableCell className="text-right">{actions(row)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    )
  }

  const primary = columns.find((column) => column.primary) ?? columns[0]
  const details = columns.filter((column) => column !== primary && column.hideOnCard !== true)

  return (
    <ul aria-label={caption} className="space-y-3">
      {rows.map((row) => (
        <li
          className="flex items-start gap-3 rounded-lg border bg-card p-4 text-card-foreground"
          key={getRowKey(row)}
        >
          {selectCell ? <div className="shrink-0">{selectCell(row)}</div> : null}
          <div className="min-w-0 flex-1 space-y-2">
            {primary ? <div className="min-w-0 font-medium">{primary.cell(row)}</div> : null}
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
              {details.map((column) => (
                <div className="col-span-2 grid grid-cols-subgrid items-center" key={column.id}>
                  <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {column.cardLabel ?? (typeof column.header === 'string' ? column.header : '')}
                  </dt>
                  <dd className="min-w-0 tabular-nums">{column.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
          {actions ? <div className="shrink-0">{actions(row)}</div> : null}
        </li>
      ))}
    </ul>
  )
}
