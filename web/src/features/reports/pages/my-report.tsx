import { UserReportView } from '@/features/reports/components/user-report-view'
import { useAuth } from '@/lib/auth/use-auth'

export function MyReport() {
  const { user } = useAuth()
  if (!user) return null

  return (
    <section aria-labelledby="my-report-title" className="space-y-4">
      <h2 className="text-lg font-semibold tracking-tight" id="my-report-title">
        My time
      </h2>
      <UserReportView userId={user.id} />
    </section>
  )
}
