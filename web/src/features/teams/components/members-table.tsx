import type { TeamMember } from '@time-manager/sdk'

import { UserMinusIcon, UsersIcon } from 'lucide-react'
import { memo } from 'react'
import { useTranslation } from 'react-i18next'

import { Empty } from '@/components/shared/empty'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TeamFormat } from '@/features/teams/lib/team-format'

export type MembersTableProps = {
  loading?: boolean
  members: readonly TeamMember[]
  onRemove?: (member: TeamMember) => void
}

type MemberRowProps = {
  member: TeamMember
  onRemove?: (member: TeamMember) => void
}

const MemberRow = memo(function MemberRow({ member, onRemove }: MemberRowProps) {
  const { t } = useTranslation('teams')
  const name = TeamFormat.userName(member)

  return (
    <TableRow>
      <TableCell className="font-medium">{name}</TableCell>
      <TableCell>{member.email}</TableCell>
      <TableCell>
        <Badge>{t(`common:roles.${member.role}`)}</Badge>
      </TableCell>
      {onRemove ? (
        <TableCell>
          <Button
            aria-label={t('members.remove.label', { name })}
            onClick={() => {
              onRemove(member)
            }}
            size="icon"
            variant="ghost"
          >
            <UserMinusIcon />
          </Button>
        </TableCell>
      ) : null}
    </TableRow>
  )
})

export function MembersTable({ loading = false, members, onRemove }: MembersTableProps) {
  const { t } = useTranslation('teams')

  if (loading) {
    return (
      <Card aria-busy className="gap-3 p-5" role="status">
        <span className="sr-only">{t('common:state.loading')}</span>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton className="h-10 w-full" key={index} />
        ))}
      </Card>
    )
  }

  if (members.length === 0) {
    return (
      <Empty
        description={onRemove ? t('members.empty_manage') : t('members.empty')}
        icon={UsersIcon}
        title={t('members.empty_title')}
      />
    )
  }

  return (
    <Card className="py-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>{t('members.columns.name')}</TableHead>
            <TableHead>{t('members.columns.email')}</TableHead>
            <TableHead>{t('members.columns.role')}</TableHead>
            {onRemove ? (
              <TableHead className="w-12">
                <span className="sr-only">{t('members.columns.actions')}</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((member) => (
            <MemberRow key={member.id} member={member} onRemove={onRemove} />
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
