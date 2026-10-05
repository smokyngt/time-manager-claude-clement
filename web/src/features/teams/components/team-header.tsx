import { ClockIcon, LayoutDashboardIcon, TargetIcon, UsersIcon } from 'lucide-react'
import { Link } from 'react-router'

import type { Team } from '@/features/teams/api/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ManagerName } from '@/features/teams/components/manager-name'
import { TeamActions } from '@/features/teams/components/team-actions'
import { formatSchedule, formatWeeklyTarget } from '@/features/teams/format'

export function TeamHeader({ team }: { team: Team }) {
  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
              {team.archived_at ? <Badge variant="outline">Archived</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">{team.description ?? 'No description'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to={`/teams/${team.id}/dashboard`}>
                <LayoutDashboardIcon />
                View dashboard
              </Link>
            </Button>
            <TeamActions team={team} />
          </div>
        </div>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Manager</dt>
            <dd className="font-medium">
              <ManagerName manager_id={team.manager_id} />
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <UsersIcon aria-hidden className="size-4" />
              Members
            </dt>
            <dd className="font-medium">{team.member_count}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <ClockIcon aria-hidden className="size-4" />
              Schedule
            </dt>
            <dd className="font-medium">{formatSchedule(team)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <TargetIcon aria-hidden className="size-4" />
              Weekly target
            </dt>
            <dd className="font-medium">{formatWeeklyTarget(team)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
