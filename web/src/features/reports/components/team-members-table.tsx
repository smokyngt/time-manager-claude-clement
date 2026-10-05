import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import type { TeamMemberReport } from '@/features/reports/api/types'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDuration, formatSignedDuration } from '@/features/reports/lib/format'
import { cn } from '@/lib/utils'

export type MemberSortKey = 'late_days' | 'overtime_ms' | 'worked_ms'

const COLUMNS: { key: MemberSortKey; label: string }[] = [
  { key: 'worked_ms', label: 'Worked' },
  { key: 'overtime_ms', label: 'Overtime' },
  { key: 'late_days', label: 'Late days' },
]

export function sortMembers(
  members: TeamMemberReport[],
  key: MemberSortKey,
  direction: 'asc' | 'desc',
) {
  const factor = direction === 'asc' ? 1 : -1
  return [...members].sort((a, b) => (a[key] - b[key]) * factor)
}

export function TeamMembersTable({ members }: { members: TeamMemberReport[] }) {
  const [sort, setSort] = useState<{ direction: 'asc' | 'desc'; key: MemberSortKey }>({
    direction: 'desc',
    key: 'worked_ms',
  })
  const rows = sortMembers(members, sort.key, sort.direction)

  function toggle(key: MemberSortKey) {
    setSort((current) => ({
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
      key,
    }))
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            {COLUMNS.map((column) => (
              <TableHead
                aria-sort={
                  sort.key === column.key
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
                className="text-right"
                key={column.key}
              >
                <Button
                  className="-mr-2.5"
                  onClick={() => toggle(column.key)}
                  size="sm"
                  variant="ghost"
                >
                  {column.label}
                  {sort.key === column.key ? (
                    sort.direction === 'asc' ? (
                      <ArrowUpIcon aria-hidden className="size-3.5" />
                    ) : (
                      <ArrowDownIcon aria-hidden className="size-3.5" />
                    )
                  ) : null}
                </Button>
              </TableHead>
            ))}
            <TableHead className="text-right">Days worked</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((member) => (
            <TableRow key={member.user_id}>
              <TableCell className="font-medium">
                <Link
                  className="underline-offset-4 hover:underline"
                  to={`/reports/users/${member.user_id}`}
                >
                  {member.first_name} {member.last_name}
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatDuration(member.worked_ms)}
              </TableCell>
              <TableCell
                className={cn(
                  'text-right tabular-nums',
                  member.overtime_ms < 0 && 'text-destructive',
                  member.overtime_ms > 0 && 'text-emerald-700 dark:text-emerald-400',
                )}
              >
                {formatSignedDuration(member.overtime_ms)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{member.late_days}</TableCell>
              <TableCell className="text-right tabular-nums">{member.days_worked}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
