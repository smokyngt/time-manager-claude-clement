import { AlertCircleIcon, UsersRoundIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateMessage } from '@/features/teams/components/state-message'
import { TeamCard } from '@/features/teams/components/team-card'
import { useTeams } from '@/features/teams/hooks/use-teams'
import { getErrorMessage } from '@/lib/api/errors'

export function TeamsGrid({ archived }: { archived: boolean }) {
  const { data, error, isError, isPending, refetch } = useTeams(archived)

  if (isPending) {
    return (
      <div aria-busy className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" role="status">
        <span className="sr-only">Loading teams</span>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-36 w-full" key={index} />
        ))}
      </div>
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
          title="Could not load teams"
        />
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <StateMessage
          description={
            archived ? 'There are no archived teams.' : 'Create a team to start organizing people.'
          }
          icon={UsersRoundIcon}
          title={archived ? 'No archived teams' : 'No teams yet'}
        />
      </Card>
    )
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {data.map((team) => (
        <li key={team.id}>
          <TeamCard team={team} />
        </li>
      ))}
    </ul>
  )
}
