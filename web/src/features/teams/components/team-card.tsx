import { ClockIcon, TargetIcon, UsersIcon } from 'lucide-react'
import { Link } from 'react-router'

import type { Team } from '@/features/teams/api/types'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ManagerName } from '@/features/teams/components/manager-name'
import { formatSchedule, formatWeeklyTarget } from '@/features/teams/format'

export function TeamCard({ team }: { team: Team }) {
  return (
    <Card className="relative transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 hover:bg-accent/40">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold">
            <Link className="outline-none after:absolute after:inset-0" to={`/teams/${team.id}`}>
              {team.name}
            </Link>
          </h2>
          {team.archived_at ? <Badge variant="outline">Archived</Badge> : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Manager: <ManagerName manager_id={team.manager_id} />
        </p>
        <dl className="grid gap-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <UsersIcon aria-hidden className="size-4" />
            <dt className="sr-only">Members</dt>
            <dd>{team.member_count} member(s)</dd>
          </div>
          <div className="flex items-center gap-2">
            <ClockIcon aria-hidden className="size-4" />
            <dt className="sr-only">Schedule</dt>
            <dd>{formatSchedule(team)}</dd>
          </div>
          <div className="flex items-center gap-2">
            <TargetIcon aria-hidden className="size-4" />
            <dt className="sr-only">Weekly target</dt>
            <dd>{formatWeeklyTarget(team)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
