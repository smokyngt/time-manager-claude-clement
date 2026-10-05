import { PageHeader } from '@/components/layout/page-header'
import { ClockCard } from '@/features/dashboard/components/clock-card'
import { KpiCards } from '@/features/dashboard/components/kpi-cards'
import { WeeklyHoursChart } from '@/features/dashboard/components/weekly-hours-chart'
import { useAuth } from '@/lib/auth/use-auth'

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        description="Here is an overview of your working time"
        title={user ? `Hello, ${user.first_name}` : 'Dashboard'}
      />
      <KpiCards />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <ClockCard />
        </div>
        <div className="lg:col-span-3">
          <WeeklyHoursChart />
        </div>
      </div>
    </>
  )
}
