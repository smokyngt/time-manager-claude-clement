import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/lib/auth/use-auth'
import { getInitials } from '@/lib/utils'

export function ProfilePage() {
  const { user } = useAuth()

  const fields = user
    ? [
        { label: 'First name', value: user.first_name },
        { label: 'Last name', value: user.last_name },
        { label: 'Email', value: user.email },
        { label: 'Phone', value: user.phone_number ?? 'Not provided' },
      ]
    : []

  return (
    <>
      <PageHeader description="Your account information" title="My profile" />
      <Card>
        <CardHeader>
          <CardTitle>Personal information</CardTitle>
        </CardHeader>
        <CardContent>
          {user ? (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarFallback className="text-lg">
                    {getInitials(user.first_name, user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <p className="font-medium">
                    {user.first_name} {user.last_name}
                  </p>
                  <Badge className="capitalize">{user.role}</Badge>
                </div>
              </div>
              <dl className="grid gap-4 sm:grid-cols-2">
                {fields.map((field) => (
                  <div className="space-y-1" key={field.label}>
                    <dt className="text-sm text-muted-foreground">{field.label}</dt>
                    <dd className="text-sm font-medium break-all">{field.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </CardContent>
      </Card>
    </>
  )
}
