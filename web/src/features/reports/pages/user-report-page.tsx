import { useParams } from 'react-router'

import { PageHeader } from '@/components/layout/page-header'
import { UserReportView } from '@/features/reports/components/user-report-view'
import { useUser } from '@/features/users/hooks/use-users'

export function UserReportPage() {
  const { id = '' } = useParams()
  const { data: user } = useUser(id)
  const title = user ? `${user.first_name} ${user.last_name}` : 'Employee report'

  return (
    <>
      <PageHeader description="Time tracking KPIs" title={title} />
      <UserReportView user_id={id} />
    </>
  )
}
