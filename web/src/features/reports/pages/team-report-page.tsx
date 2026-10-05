import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/shared'
import { TeamReportView } from '@/features/reports/components/team-report-view'
import { useReportTeam } from '@/features/reports/hooks/use-report-subject'
import { useDocumentTitle } from '@/hooks'

type TeamReportContentProps = {
  teamId: string
}

function TeamReportContent({ teamId }: TeamReportContentProps) {
  const { t } = useTranslation('reports')
  const { team } = useReportTeam(teamId)
  const title = team ? team.name : t('team.title')
  useDocumentTitle(title)

  return (
    <div className="space-y-6">
      <PageHeader description={t('team.description')} title={title} />
      <TeamReportView teamId={teamId} />
    </div>
  )
}

export function TeamReportPage() {
  const { teamId } = useParams()
  return teamId ? <TeamReportContent teamId={teamId} /> : null
}
