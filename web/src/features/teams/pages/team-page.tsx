import { AlertCircleIcon, ArrowLeftIcon } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AddMembersDialog } from '@/features/teams/components/add-members-dialog'
import { MembersTable } from '@/features/teams/components/members-table'
import { StateMessage } from '@/features/teams/components/state-message'
import { TeamHeader } from '@/features/teams/components/team-header'
import { useTeam } from '@/features/teams/hooks/use-teams'
import { canManageTeam } from '@/features/teams/permissions'
import { ApiError, getErrorMessage } from '@/lib/api/errors'
import { useAuth } from '@/lib/auth/use-auth'

export function TeamPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const { data: team, error, isError, isPending, refetch } = useTeam(id)

  const back = (
    <Button asChild className="w-fit" variant="ghost">
      <Link to="/teams">
        <ArrowLeftIcon />
        All teams
      </Link>
    </Button>
  )

  if (isPending) {
    return (
      <div className="space-y-4">
        {back}
        <Skeleton aria-busy className="h-40 w-full" role="status">
          <span className="sr-only">Loading team</span>
        </Skeleton>
      </div>
    )
  }

  if (isError) {
    const not_found = error instanceof ApiError && (error.status === 404 || error.status === 403)
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <StateMessage
            action={
              not_found ? null : (
                <Button
                  onClick={() => {
                    void refetch()
                  }}
                  variant="outline"
                >
                  Try again
                </Button>
              )
            }
            description={
              not_found ? 'This team does not exist or you cannot see it.' : getErrorMessage(error)
            }
            icon={AlertCircleIcon}
            title={not_found ? 'Team not found' : 'Could not load team'}
          />
        </Card>
      </div>
    )
  }

  const can_manage = canManageTeam(user, team) && !team.archived_at

  return (
    <div className="space-y-6">
      {back}
      <TeamHeader team={team} />
      <section aria-labelledby="members-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold" id="members-heading">
            Members
          </h2>
          {can_manage ? <AddMembersDialog team_id={team.id} /> : null}
        </div>
        <MembersTable can_manage={can_manage} team_id={team.id} />
      </section>
    </div>
  )
}
