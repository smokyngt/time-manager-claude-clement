import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/shared'
import { UserReportView } from '@/features/reports/components/user-report-view'
import { useReportUser } from '@/features/reports/hooks/use-report-subject'
import { useDocumentTitle } from '@/hooks'

type UserReportContentProps = {
  userId: string
}

function UserReportContent({ userId }: UserReportContentProps) {
  const { t } = useTranslation('reports')
  const { user } = useReportUser(userId)
  const title = user ? `${user.firstName} ${user.lastName}` : t('user.title')
  useDocumentTitle(title)

  return (
    <div className="space-y-6">
      <PageHeader description={t('user.description')} title={title} />
      <UserReportView userId={userId} />
    </div>
  )
}

export function UserReportPage() {
  const { userId } = useParams()
  return userId ? <UserReportContent userId={userId} /> : null
}
