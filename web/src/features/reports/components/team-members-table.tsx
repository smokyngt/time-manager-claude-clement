import type { TeamReportMember } from '@time-manager/sdk'

import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import type { MemberSortKey, SortDirection } from '@/features/reports/lib/sort-members'

import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { signedDuration } from '@/features/reports/lib/kpi'
import { sortMembers } from '@/features/reports/lib/sort-members'
import { Duration } from '@/lib/duration'
import { Permission } from '@/lib/permission'
import { RESOURCE_SCOPES } from '@/lib/scopes'
import { useAuth } from '@/providers/use-auth'

const COLUMNS: { key: MemberSortKey; label: string }[] = [
  { key: 'workedMs', label: 'worked' },
  { key: 'overtimeMs', label: 'overtime' },
  { key: 'lateDays', label: 'late_days' },
]

type MemberRowProps = {
  canOpen: boolean
  member: TeamReportMember
}

const MemberRow = memo(function MemberRow({ canOpen, member }: MemberRowProps) {
  const name = `${member.firstName} ${member.lastName}`

  return (
    <TableRow>
      <TableCell className="font-medium">
        {canOpen ? (
          <Link
            className="underline-offset-4 hover:underline"
            to={`/reports/users/${member.userId}`}
          >
            {name}
          </Link>
        ) : (
          name
        )}
      </TableCell>
      <TableCell className="text-right tabular-nums">{Duration.short(member.workedMs)}</TableCell>
      <TableCell className="text-right tabular-nums">{signedDuration(member.overtimeMs)}</TableCell>
      <TableCell className="text-right tabular-nums">{member.lateDays}</TableCell>
      <TableCell className="text-right tabular-nums">{member.daysWorked}</TableCell>
    </TableRow>
  )
})

export type TeamMembersTableProps = {
  members: TeamReportMember[]
}

export function TeamMembersTable({ members }: TeamMembersTableProps) {
  const { t } = useTranslation('reports')
  const { scopes } = useAuth()
  const canOpen = Permission.scope.any(scopes, [RESOURCE_SCOPES.reports.read])
  const [sort, setSort] = useState<{ direction: SortDirection; key: MemberSortKey }>({
    direction: 'desc',
    key: 'workedMs',
  })
  const rows = useMemo(
    () => sortMembers(members, sort.key, sort.direction),
    [members, sort.direction, sort.key],
  )

  const toggle = useCallback((key: MemberSortKey) => {
    setSort((current) => ({
      direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc',
      key,
    }))
  }, [])

  return (
    <div className="rounded-xl border bg-card">
      <Table aria-label={t('members.label')}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('members.member')}</TableHead>
            {COLUMNS.map((column) => {
              const active = sort.key === column.key
              return (
                <TableHead
                  aria-sort={
                    active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                  }
                  className="text-right"
                  key={column.key}
                >
                  <Button
                    className="-mr-2.5"
                    onClick={() => {
                      toggle(column.key)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    {t(`members.${column.label}`)}
                    {active ? (
                      sort.direction === 'asc' ? (
                        <ArrowUpIcon aria-hidden className="size-3.5" />
                      ) : (
                        <ArrowDownIcon aria-hidden className="size-3.5" />
                      )
                    ) : null}
                  </Button>
                </TableHead>
              )
            })}
            <TableHead className="text-right">{t('members.days_worked')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((member) => (
            <MemberRow canOpen={canOpen} key={member.userId} member={member} />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
