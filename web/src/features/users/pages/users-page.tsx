import { PageHeader } from '@/components/layout/page-header'
import { NewUserDialog } from '@/features/users/components/new-user-dialog'
import { UsersTable } from '@/features/users/components/users-table'
import { useAuth } from '@/lib/auth/use-auth'

export function UsersPage() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        actions={user ? <NewUserDialog actorRole={user.role} /> : null}
        description="Manage the people in your organization"
        title="Users"
      />
      <UsersTable />
    </>
  )
}
