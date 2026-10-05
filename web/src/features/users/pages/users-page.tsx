import { PageHeader } from '@/components/layout/page-header'
import { NewUserDialog } from '@/features/users/components/new-user-dialog'
import { UsersTable } from '@/features/users/components/users-table'

export function UsersPage() {
  return (
    <>
      <PageHeader
        actions={<NewUserDialog />}
        description="Manage the people in your organization"
        title="Users"
      />
      <UsersTable />
    </>
  )
}
