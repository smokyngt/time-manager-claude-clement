import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useForm } from 'react-hook-form'

import type { ProfileValues } from '@/features/profile/schemas'
import type { UserRecord } from '@/features/users/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { profileSchema } from '@/features/profile/schemas'
import { FormField } from '@/features/users/components/form-field'

export function ProfileEditForm({
  formError,
  onSubmit,
  pending,
  user,
}: {
  formError?: null | string
  onSubmit: (values: ProfileValues) => void
  pending: boolean
  user: UserRecord
}) {
  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = useForm<ProfileValues>({
    defaultValues: {
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number ?? '',
    },
    resolver: zodResolver(profileSchema),
  })

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(onSubmit)(event)}
    >
      {formError ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField error={errors.first_name?.message} id="profile-first-name" label="First name">
          <Input
            aria-invalid={Boolean(errors.first_name)}
            autoComplete="given-name"
            id="profile-first-name"
            {...register('first_name')}
          />
        </FormField>
        <FormField error={errors.last_name?.message} id="profile-last-name" label="Last name">
          <Input
            aria-invalid={Boolean(errors.last_name)}
            autoComplete="family-name"
            id="profile-last-name"
            {...register('last_name')}
          />
        </FormField>
        <FormField
          className="sm:col-span-2"
          error={errors.phone_number?.message}
          id="profile-phone"
          label="Phone number"
        >
          <Input
            aria-invalid={Boolean(errors.phone_number)}
            autoComplete="tel"
            id="profile-phone"
            type="tel"
            {...register('phone_number')}
          />
        </FormField>
      </div>
      <div className="flex sm:justify-end">
        <Button disabled={pending || !isDirty} type="submit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  )
}
