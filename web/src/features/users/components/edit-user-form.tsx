import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'

import type { EditUserValues } from '@/features/users/schemas'
import type { Role, UserRecord } from '@/features/users/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/features/users/components/form-field'
import { RoleSelect } from '@/features/users/components/role-select'
import { assignableRoles, editableFields } from '@/features/users/permissions'
import { editUserSchema, PASSWORD_MIN_LENGTH } from '@/features/users/schemas'

export function EditUserForm({
  actor,
  formError,
  onCancel,
  onSubmit,
  pending,
  user,
}: {
  actor: { id: string; role: Role }
  formError?: null | string
  onCancel: () => void
  onSubmit: (values: EditUserValues) => void
  pending: boolean
  user: UserRecord
}) {
  const fields = editableFields(actor, user)
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<EditUserValues>({
    defaultValues: {
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      password: '',
      phone_number: user.phone_number ?? '',
      role: user.role,
    },
    resolver: zodResolver(editUserSchema),
  })

  function show(name: (typeof fields)[number]) {
    return fields.includes(name)
  }

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
        {show('first_name') ? (
          <FormField error={errors.first_name?.message} id="edit-user-first_name" label="First name">
            <Input
              aria-invalid={Boolean(errors.first_name)}
              id="edit-user-first_name"
              {...register('first_name')}
            />
          </FormField>
        ) : null}
        {show('last_name') ? (
          <FormField error={errors.last_name?.message} id="edit-user-last_name" label="Last name">
            <Input
              aria-invalid={Boolean(errors.last_name)}
              id="edit-user-last_name"
              {...register('last_name')}
            />
          </FormField>
        ) : null}
        {show('email') ? (
          <FormField
            className="sm:col-span-2"
            error={errors.email?.message}
            id="edit-user-email"
            label="Email"
          >
            <Input
              aria-invalid={Boolean(errors.email)}
              autoComplete="off"
              id="edit-user-email"
              type="email"
              {...register('email')}
            />
          </FormField>
        ) : null}
        {show('phone_number') ? (
          <FormField
            className="sm:col-span-2"
            error={errors.phone_number?.message}
            id="edit-user-phone_number"
            label="Phone number"
          >
            <Input
              aria-invalid={Boolean(errors.phone_number)}
              autoComplete="off"
              id="edit-user-phone_number"
              type="tel"
              {...register('phone_number')}
            />
          </FormField>
        ) : null}
        {show('role') ? (
          <FormField className="sm:col-span-2" id="edit-user-role" label="Role">
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <RoleSelect
                  id="edit-user-role"
                  onChange={field.onChange}
                  roles={assignableRoles(actor.role)}
                  value={field.value ?? user.role}
                />
              )}
            />
          </FormField>
        ) : null}
        {show('password') ? (
          <FormField
            className="sm:col-span-2"
            error={errors.password?.message}
            hint={`Leave empty to keep the current password. Minimum ${PASSWORD_MIN_LENGTH} characters.`}
            id="edit-user-password"
            label="New password"
          >
            <Input
              aria-invalid={Boolean(errors.password)}
              autoComplete="new-password"
              id="edit-user-password"
              type="password"
              {...register('password')}
            />
          </FormField>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Save changes
        </Button>
      </div>
    </form>
  )
}
