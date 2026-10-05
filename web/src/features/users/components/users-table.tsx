import type { ReactNode } from 'react'

import { AlertCircleIcon, Loader2Icon, UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { BulkResult, Role, UserFilters, UserRecord } from '@/features/users/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { describeBulk } from '@/features/users/bulk-message'
import { roleLabel } from '@/features/users/components/role-select'
import { Checkbox } from '@/features/users/components/ui/checkbox'
import { UserRowActions } from '@/features/users/components/user-row-actions'
import { UsersBulkToolbar } from '@/features/users/components/users-bulk-toolbar'
import { UsersFilters } from '@/features/users/components/users-filters'
import {
  useArchiveUsers,
  useDeleteUsers,
  useRestoreUsers,
  useUsers,
} from '@/features/users/hooks/use-users'
import { canArchive } from '@/features/users/permissions'
import { getErrorMessage } from '@/lib/api/errors'
import { useAuth } from '@/lib/auth/use-auth'

const DEFAULT_FILTERS: UserFilters = { archived: false, role: 'all' }

function StateMessage({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode
  description: string
  icon: typeof UsersIcon
  title: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden className="size-6" />
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action}
    </div>
  )
}

export function UsersTable() {
  const { user: me } = useAuth()
  const [filters, setFilters] = useState<UserFilters>(DEFAULT_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const query = useUsers(filters)
  const archive = useArchiveUsers()
  const restore = useRestoreUsers()
  const remove = useDeleteUsers()

  if (!me) return null

  const actor: { id: string; role: Role } = { id: me.id, role: me.role }
  const users: UserRecord[] = query.data?.pages.flatMap((page) => page.items) ?? []
  const total = query.data?.pages[0]?.total ?? 0
  const selectable = users.filter((user) => canArchive(actor, user))
  const all_selected = selectable.length > 0 && selectable.every((user) => selected.includes(user.id))
  const bulk_pending = archive.isPending || restore.isPending || remove.isPending

  function changeFilters(next: UserFilters) {
    setFilters(next)
    setSelected([])
  }

  function toggle(id: string, checked: boolean) {
    setSelected((current) => (checked ? [...current, id] : current.filter((item) => item !== id)))
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? selectable.map((user) => user.id) : [])
  }

  async function run(action: (ids: string[]) => Promise<BulkResult>, ids: string[], verb: string) {
    try {
      const result = await action(ids)
      const message = describeBulk(result, verb)
      if (result.failed.length > 0) toast.warning(message)
      else toast.success(message)
      setSelected((current) => current.filter((id) => !result.succeeded.includes(id)))
    } catch (error) {
      toast.error(getErrorMessage(error))
    }
  }

  const filtersView = <UsersFilters filters={filters} onChange={changeFilters} />

  if (query.isPending) {
    return (
      <div className="space-y-4">
        {filtersView}
        <Card aria-busy className="gap-3 p-5" role="status">
          <span className="sr-only">Loading users</span>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton className="h-10 w-full" key={index} />
          ))}
        </Card>
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="space-y-4">
        {filtersView}
        <Card>
          <StateMessage
            action={
              <Button
                onClick={() => {
                  void query.refetch()
                }}
                variant="outline"
              >
                Try again
              </Button>
            }
            description={getErrorMessage(query.error)}
            icon={AlertCircleIcon}
            title="Could not load users"
          />
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {filtersView}
      <UsersBulkToolbar
        actorRole={actor.role}
        archived={filters.archived}
        count={selected.length}
        onArchive={() => void run(archive.mutateAsync, selected, 'archived')}
        onClear={() => {
          setSelected([])
        }}
        onDelete={() => void run(remove.mutateAsync, selected, 'deleted')}
        onRestore={() => void run(restore.mutateAsync, selected, 'restored')}
        pending={bulk_pending}
      />
      {users.length === 0 ? (
        <Card>
          <StateMessage
            description={
              filters.archived
                ? 'No archived users match these filters.'
                : 'No users match these filters. Create a user to get started.'
            }
            icon={UsersIcon}
            title="No users found"
          />
        </Card>
      ) : (
        <Card className="py-2">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Select all users"
                    checked={all_selected}
                    disabled={selectable.length === 0}
                    onCheckedChange={(checked) => {
                      toggleAll(checked === true)
                    }}
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow data-state={selected.includes(user.id) ? 'selected' : undefined} key={user.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Select ${user.first_name} ${user.last_name}`}
                      checked={selected.includes(user.id)}
                      disabled={!canArchive(actor, user)}
                      onCheckedChange={(checked) => {
                        toggle(user.id, checked === true)
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {user.first_name} {user.last_name}
                    {user.archived_at !== null ? (
                      <Badge className="ml-2" variant="outline">
                        Archived
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell className="break-all">{user.email}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {user.phone_number ?? '-'}
                  </TableCell>
                  <TableCell>
                    <Badge>{roleLabel(user.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      actor={actor}
                      onArchive={(id) => void run(archive.mutateAsync, [id], 'archived')}
                      onDelete={(id) => void run(remove.mutateAsync, [id], 'deleted')}
                      onRestore={(id) => void run(restore.mutateAsync, [id], 'restored')}
                      user={user}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-3 px-4 pt-2 text-sm text-muted-foreground">
            <p>
              Showing {users.length} of {total}
            </p>
            {query.hasNextPage ? (
              <Button
                disabled={query.isFetchingNextPage}
                onClick={() => {
                  void query.fetchNextPage()
                }}
                size="sm"
                variant="outline"
              >
                {query.isFetchingNextPage ? <Loader2Icon className="animate-spin" /> : null}
                Load more
              </Button>
            ) : null}
          </div>
        </Card>
      )}
    </div>
  )
}
