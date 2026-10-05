import { AlertCircleIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import type { PasswordValues, ProfileValues } from '@/features/profile/schemas'

import { PageHeader } from '@/components/layout/page-header'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountCard } from '@/features/profile/components/account-card'
import { ChangePasswordForm } from '@/features/profile/components/change-password-form'
import { ProfileEditForm } from '@/features/profile/components/profile-edit-form'
import { useUpdateProfile } from '@/features/profile/hooks/use-profile'
import { useUser } from '@/features/users/hooks/use-users'
import { getErrorMessage } from '@/lib/api/errors'
import { useAuth } from '@/lib/auth/use-auth'
import { getInitials } from '@/lib/utils'

export function ProfilePage() {
  const { user: me } = useAuth()
  const query = useUser(me?.id)
  const update = useUpdateProfile(me?.id ?? '')
  const [profile_error, setProfileError] = useState<null | string>(null)
  const [password_error, setPasswordError] = useState<null | string>(null)
  const user = query.data

  async function saveProfile(values: ProfileValues) {
    setProfileError(null)
    try {
      await update.mutateAsync({
        first_name: values.first_name,
        last_name: values.last_name,
        phone_number: values.phone_number === '' ? null : values.phone_number,
      })
      toast.success('Profile updated')
    } catch (error) {
      setProfileError(getErrorMessage(error))
    }
  }

  async function savePassword(values: PasswordValues) {
    setPasswordError(null)
    try {
      await update.mutateAsync({ password: values.new_password })
      toast.success('Password changed')
      return true
    } catch (error) {
      setPasswordError(getErrorMessage(error))
      return false
    }
  }

  return (
    <>
      <PageHeader description="Your account information" title="My profile" />
      {query.isError ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircleIcon aria-hidden className="size-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{getErrorMessage(query.error)}</p>
            <Button
              onClick={() => {
                void query.refetch()
              }}
              variant="outline"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !user ? (
        <Card aria-busy className="gap-3 p-5" role="status">
          <span className="sr-only">Loading profile</span>
          <Skeleton className="h-32 w-full" />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Avatar className="size-14">
                  <AvatarFallback className="text-lg">
                    {getInitials(user.first_name, user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle>
                    {user.first_name} {user.last_name}
                  </CardTitle>
                  <CardDescription className="break-all">{user.email}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ProfileEditForm
                formError={profile_error}
                key={user.updated_at ?? user.created_at}
                onSubmit={(values) => void saveProfile(values)}
                pending={update.isPending}
                user={user}
              />
            </CardContent>
          </Card>
          <div className="space-y-6">
            <AccountCard user={user} />
            <Card>
              <CardHeader>
                <CardTitle>Password</CardTitle>
                <CardDescription>Choose a new password for your account.</CardDescription>
              </CardHeader>
              <CardContent>
                <ChangePasswordForm
                  formError={password_error}
                  onSubmit={savePassword}
                  pending={update.isPending}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}
