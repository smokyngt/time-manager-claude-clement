import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/shared'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AccountCard,
  ChangePasswordForm,
  PreferencesCard,
  ProfileEditForm,
} from '@/features/profile/components'
import { useChangePassword, useUpdateProfile } from '@/features/profile/hooks'
import { useDocumentTitle } from '@/hooks'
import { useAuth } from '@/providers/use-auth'

export function ProfilePage() {
  const { t } = useTranslation('profile')
  useDocumentTitle(t('title'))
  const { user } = useAuth()
  const id = user?.id ?? ''
  const profile = useUpdateProfile(id)
  const password = useChangePassword(id)

  if (!user) {
    return (
      <div aria-busy className="space-y-6" role="status">
        <span className="sr-only">{t('loading')}</span>
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader description={t('description')} title={t('title')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="text-lg">
                  {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <CardTitle>{`${user.firstName} ${user.lastName}`}</CardTitle>
                <CardDescription className="break-all">{user.email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ProfileEditForm
              defaults={{
                firstName: user.firstName,
                lastName: user.lastName,
                phoneNumber: user.phoneNumber ?? '',
              }}
              key={user.updatedAt ?? user.createdAt}
              onSubmit={(values) => {
                void profile.update({
                  firstName: values.firstName,
                  lastName: values.lastName,
                  phoneNumber: values.phoneNumber === '' ? null : values.phoneNumber,
                })
              }}
              pending={profile.pending}
            />
          </CardContent>
        </Card>
        <div className="space-y-6">
          <AccountCard user={user} />
          <Card>
            <CardHeader>
              <CardTitle>{t('password.title')}</CardTitle>
              <CardDescription>{t('password.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm
                onSubmit={async (values) => {
                  try {
                    await password.change({
                      currentPassword: values.currentPassword,
                      password: values.newPassword,
                    })
                    return true
                  } catch {
                    return false
                  }
                }}
                pending={password.pending}
                wrongPassword={password.wrongPassword}
              />
            </CardContent>
          </Card>
          <PreferencesCard />
        </div>
      </div>
    </div>
  )
}
