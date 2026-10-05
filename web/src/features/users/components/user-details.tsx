import type { User } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { RoleBadge } from '@/features/users/components/role-badge'
import { Dates } from '@/lib/dates'

export type UserDetailsProps = { user: User }

export function UserDetails({ user }: UserDetailsProps) {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  const archived = user.archivedAt !== null

  return (
    <dl className="grid gap-4 text-sm sm:grid-cols-2">
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('detail.email')}</dt>
        <dd className="break-all">{user.email}</dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('detail.phone')}</dt>
        <dd>{user.phoneNumber ?? tc('state.none')}</dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('detail.role')}</dt>
        <dd>
          <RoleBadge role={user.role} />
        </dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('detail.status')}</dt>
        <dd>
          <Badge variant={archived ? 'outline' : 'success'}>
            {archived ? tc('state.archived') : tc('state.active')}
          </Badge>
        </dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('detail.created')}</dt>
        <dd>{Dates.dateTime(user.createdAt)}</dd>
      </div>
      <div className="space-y-1">
        <dt className="text-muted-foreground">{t('detail.updated')}</dt>
        <dd>{user.updatedAt === null ? tc('state.none') : Dates.dateTime(user.updatedAt)}</dd>
      </div>
    </dl>
  )
}
