import type { ReactNode } from 'react'

import { AlertCircleIcon, UsersIcon } from 'lucide-react'

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
import { useUsers } from '@/features/users/hooks/use-users'
import { getErrorMessage } from '@/lib/api/errors'

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
  const { data, error, isError, isPending, refetch } = useUsers()

  if (isPending) {
    return (
      <Card aria-busy className="gap-3 p-5" role="status">
        <span className="sr-only">Loading users</span>
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-10 w-full" key={index} />
        ))}
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <StateMessage
          action={
            <Button
              onClick={() => {
                void refetch()
              }}
              variant="outline"
            >
              Try again
            </Button>
          }
          description={getErrorMessage(error)}
          icon={AlertCircleIcon}
          title="Could not load users"
        />
      </Card>
    )
  }

  if (data.length === 0) {
    return (
      <Card>
        <StateMessage
          description="Create the first user to get started."
          icon={UsersIcon}
          title="No users yet"
        />
      </Card>
    )
  }

  return (
    <Card className="py-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((user) => (
            <TableRow key={user.id}>
              <TableCell className="font-medium">
                {user.first_name} {user.last_name}
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell className="text-muted-foreground">{user.phone_number ?? '-'}</TableCell>
              <TableCell>
                <Badge className="capitalize">{user.role}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
