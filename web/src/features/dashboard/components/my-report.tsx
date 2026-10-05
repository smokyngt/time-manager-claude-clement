import { useTranslation } from 'react-i18next'

import { UserReportView } from '@/features/reports/components'

export type MyReportProps = {
  userId: string
}

export function MyReport({ userId }: MyReportProps) {
  const { t } = useTranslation('dashboard')

  return (
    <section aria-labelledby="my-report-title" className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight" id="my-report-title">
        {t('my_report.title')}
      </h2>
      <UserReportView userId={userId} />
    </section>
  )
}
