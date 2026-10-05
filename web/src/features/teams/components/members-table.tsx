import { AlertCircleIcon, UserMinusIcon, UsersIcon } from 'lucide-react'

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
import { userName } from '@/features/teams/api/users'
import { ConfirmDialog } from '@/features/teams/components/confirm-dialog'
import { StateMessage } from '@/features/teams/components/state-message'
import { useRemoveTeamMember, useTeamMembers } from '@/features/teams/hooks/use-team-members'
import { getErrorMessage } from '@/lib/api/errors'

export function MembersTable({ can_manage, team_id }: { can_manage: boolean; team_id: string }) {
  const { data, error, isError, isPending, refetch } = useTeamMembers(team_id)
  const remove = useRemoveTeamMember(team_id)

  if (isPending) {
    return (
      <Card aria-busy className="gap-3 p-5" role="status">
        <span className="sr-only">Loading members</span>
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton className="h-10 w-full" key={index} />
        ))}
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <StateMessage
          action={
            <Button
              onClick={() => {
                void refetch()
              }}
              variant="outline"
            >
              Try again
            </Button>
          }
          description={getErrorMessage(error)}
          icon={AlertCircleIcon}
          title="Could not load members"
        />
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <StateMessage
          description={can_manage ? 'Add employees to this team.' : 'This team has no members yet.'}
          icon={UsersIcon}
          title="No members"
        />
      </Card>
    )
  }

  return (
    <Card className="py-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            {can_manage ? (
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((member) => (
            <TableRow key={member.id}>
              <TableCell className="font-medium">{userName(member)}</TableCell>
              <TableCell>{member.email}</TableCell>
              <TableCell>
                <Badge className="capitalize">{member.role}</Badge>
              </TableCell>
              {can_manage ? (
                <TableCell>
                  <ConfirmDialog
                    confirm_label="Remove"
                    description="They will no longer be part of this team."
                    destructive
                    on_confirm={() => {
                      remove.mutate(member.id)
                    }}
                    title={`Remove ${userName(member)}?`}
                    trigger={
                      <Button aria-label={`Remove ${userName(member)}`} size="icon" variant="ghost">
                        <UserMinusIcon />
                      </Button>
                    }
                  />
                </TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
