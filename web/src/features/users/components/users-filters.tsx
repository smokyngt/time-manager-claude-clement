import type { Role, Team } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type UsersFiltersValue = { archived: boolean; role: string; teamId: string }

export type UsersFiltersProps = {
  onChange: (patch: Partial<UsersFiltersValue>) => void
  showRole: boolean
  teams: readonly Team[]
  value: UsersFiltersValue
}

const ROLES: Role[] = ['employee', 'manager', 'admin']

export function UsersFilters({ onChange, showRole, teams, value }: UsersFiltersProps) {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')

  return (
    <>
      {showRole ? (
        <Select
          onValueChange={(role) => {
            onChange({ role })
          }}
          value={value.role}
        >
          <SelectTrigger aria-label={t('filters.role')} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.role_all')}</SelectItem>
            {ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {tc(`roles.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      <Select
        onValueChange={(status) => {
          onChange({ archived: status === 'archived' })
        }}
        value={value.archived ? 'archived' : 'active'}
      >
        <SelectTrigger aria-label={t('filters.status')} className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">{tc('state.active')}</SelectItem>
          <SelectItem value="archived">{tc('state.archived')}</SelectItem>
        </SelectContent>
      </Select>
      <Select
        onValueChange={(teamId) => {
          onChange({ teamId: teamId === 'all' ? '' : teamId })
        }}
        value={value.teamId === '' ? 'all' : value.teamId}
      >
        <SelectTrigger aria-label={t('filters.team')} className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('filters.team_all')}</SelectItem>
          {teams.map((team) => (
            <SelectItem key={team.id} value={team.id}>
              {team.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
