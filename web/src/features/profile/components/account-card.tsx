import { format } from 'date-fns'

import type { UserRecord } from '@/features/users/types'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { roleLabel } from '@/features/users/role-label'

export function AccountCard({
  microsoftLinked,
  user,
}: {
  microsoftLinked?: boolean
  user: UserRecord
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            <dt className="text-muted-foreground">Role</dt>
            <dd>
              <Badge>{roleLabel(user.role)}</Badge>
            </dd>
          </div>
          <div className="space-y-1">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="font-medium">{format(user.created_at, 'PPP')}</dd>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
          {microsoftLinked ? (
            <div className="space-y-1 sm:col-span-2">
              <dt className="text-muted-foreground">Sign-in</dt>
              <dd>
                <Badge variant="outline">Microsoft linked</Badge>
              </dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  )
}
