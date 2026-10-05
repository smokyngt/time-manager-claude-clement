import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/shared'
import { ClockCard } from '@/features/clocks/components'
import { MyReport } from '@/features/dashboard/components'
import { useDocumentTitle } from '@/hooks'
import { Permission } from '@/lib/permission'
import { RESOURCE_SCOPES } from '@/lib/scopes'
import { useAuth } from '@/providers/use-auth'

export function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const { scopes, user } = useAuth()
  useDocumentTitle(t('title'))
  const canViewReports = Permission.scope.any(scopes, [RESOURCE_SCOPES.reports.read])

  return (
    <div className="space-y-6">
      <PageHeader
        description={t('subtitle')}
        title={user ? t('greeting', { name: user.firstName }) : t('title')}
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ClockCard />
        </div>
        {user && canViewReports ? (
          <div className="lg:col-span-3">
            <MyReport userId={user.id} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
