import type { Team } from '@time-manager/sdk'

import { ClockIcon, TargetIcon, UserIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { TeamFormat } from '@/features/teams/lib/team-format'

export type TeamDetailsProps = {
  managerName?: string
  team: Team
}

export function TeamDetails({ managerName, team }: TeamDetailsProps) {
  const { t } = useTranslation('teams')

  return (
    <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <UserIcon aria-hidden className="size-4" />
          {t('detail.manager')}
        </dt>
        <dd className="font-medium">{managerName ?? t('common:state.unknown')}</dd>
      </div>
      <div>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <UsersIcon aria-hidden className="size-4" />
          {t('detail.members')}
        </dt>
        <dd className="font-medium">{team.memberCount}</dd>
      </div>
      <div>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <ClockIcon aria-hidden className="size-4" />
          {t('detail.schedule')}
        </dt>
        <dd className="font-medium">{TeamFormat.schedule(team)}</dd>
      </div>
      <div>
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <TargetIcon aria-hidden className="size-4" />
          {t('detail.weekly_target')}
        </dt>
        <dd className="font-medium">{t('detail.hours', { count: team.weeklyHoursTarget })}</dd>
      </div>
    </dl>
  )
}
