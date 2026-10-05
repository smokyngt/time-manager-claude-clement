import type { User } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dates } from '@/lib/dates'

export type AccountCardProps = { user: User }

export function AccountCard({ user }: AccountCardProps) {
  const { t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('account.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground">{t('account.role')}</dt>
            <dd>
              <Badge>{tCommon(`roles.${user.role}`)}</Badge>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">{t('account.member_since')}</dt>
            <dd className="font-medium">{Dates.date(user.createdAt)}</dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">{t('account.email')}</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  )
}
