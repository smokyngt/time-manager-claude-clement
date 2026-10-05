import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react'

import { FOCUS_RING } from '@/components/ui/focus'
import { TableHead } from '@/components/ui/table'
import { cn } from '@/lib/cn'

export type SortDirection = 'asc' | 'desc'

export type SortableHeaderProps = {
  align?: 'left' | 'right'
  className?: string
  direction?: SortDirection
  label: string
  onSort: () => void
  sorted?: boolean
}

export function SortableHeader({
  align = 'left',
  className,
  direction = 'asc',
  label,
  onSort,
  sorted = false,
}: SortableHeaderProps) {
  const Icon = sorted ? (direction === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ChevronsUpDownIcon
  const ariaSort = sorted ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <TableHead aria-sort={ariaSort} className={cn(align === 'right' && 'text-right', className)}>
      <button
        className={cn(
          '-mx-2 inline-flex h-8 items-center gap-1 rounded-sm px-2 text-xs font-medium tracking-wide uppercase transition-colors hover:bg-muted hover:text-foreground pointer-coarse:h-11',
          align === 'right' && 'flex-row-reverse',
          sorted && 'text-foreground',
          FOCUS_RING,
        )}
        onClick={onSort}
        type="button"
      >
        {label}
        <Icon aria-hidden className={cn('size-3.5 shrink-0', !sorted && 'opacity-50')} />
      </button>
    </TableHead>
  )
}
