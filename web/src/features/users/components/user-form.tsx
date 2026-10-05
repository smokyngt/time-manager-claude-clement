import type { Role, User } from '@time-manager/sdk'

import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { UserActor, UserField } from '@/features/users/lib/user-permissions'
import type { UserFormValues } from '@/features/users/lib/user-schema'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LIMITS } from '@/config/limits'
import { UserFormField } from '@/features/users/components/user-form-field'
import { UserPayload } from '@/features/users/lib/user-payload'
import { UserPermissions } from '@/features/users/lib/user-permissions'
import { UserSchema } from '@/features/users/lib/user-schema'

export type UserFormProps = {
  actor: UserActor
  emailTaken?: boolean
  idPrefix?: string
  onCancel: () => void
  onSubmit: (values: UserFormValues) => void
  pending?: boolean
  user?: User
}

function isRole(value: string): value is Role {
  return value === 'admin' || value === 'employee' || value === 'manager'
}

export function UserForm({
  actor,
  emailTaken = false,
  idPrefix = 'user-form',
  onCancel,
  onSubmit,
  pending = false,
  user,
}: UserFormProps) {
  const { t } = useTranslation('users')
  const { t: tc } = useTranslation('common')
  const editing = user !== undefined
  const fields: UserField[] = useMemo(
    () => (user ? UserPermissions.fields(actor, user) : UserPermissions.createFields(actor)),
    [actor, user],
  )
  const schema = useMemo(() => UserSchema.form(fields), [fields])
  const {
    control,
    formState: { errors, isDirty, isValid },
    handleSubmit,
    register,
  } = useForm<UserFormValues>({
    defaultValues: UserPayload.defaults(user),
    mode: 'onChange',
    resolver: zodResolver(schema),
  })
  const shown = (field: UserField) => fields.includes(field)
  const message = (key: string | undefined) => (key === undefined ? undefined : t(key))
  const emailError = emailTaken ? t('form.errors.email_taken') : message(errors.email?.message)
  const roles = UserPermissions.roles(actor)

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {shown('firstName') ? (
          <UserFormField
            error={message(errors.firstName?.message)}
            id={`${idPrefix}-first-name`}
            label={t('form.first_name')}
          >
            <Input
              aria-invalid={errors.firstName !== undefined}
              autoComplete="off"
              id={`${idPrefix}-first-name`}
              maxLength={LIMITS.firstName}
              {...register('firstName')}
            />
          </UserFormField>
        ) : null}
        {shown('lastName') ? (
          <UserFormField
            error={message(errors.lastName?.message)}
            id={`${idPrefix}-last-name`}
            label={t('form.last_name')}
          >
            <Input
              aria-invalid={errors.lastName !== undefined}
              autoComplete="off"
              id={`${idPrefix}-last-name`}
              maxLength={LIMITS.lastName}
              {...register('lastName')}
            />
          </UserFormField>
        ) : null}
        {shown('email') ? (
          <UserFormField
            className="sm:col-span-2"
            error={emailError}
            id={`${idPrefix}-email`}
            label={t('form.email')}
          >
            <Input
              aria-invalid={emailError !== undefined}
              autoComplete="off"
              id={`${idPrefix}-email`}
              maxLength={LIMITS.email}
              type="email"
              {...register('email')}
            />
          </UserFormField>
        ) : null}
        {shown('phoneNumber') ? (
          <UserFormField
            className="sm:col-span-2"
            error={message(errors.phoneNumber?.message)}
            id={`${idPrefix}-phone`}
            label={t('form.phone')}
          >
            <Input
              aria-invalid={errors.phoneNumber !== undefined}
              autoComplete="off"
              id={`${idPrefix}-phone`}
              maxLength={LIMITS.phone.max}
              type="tel"
              {...register('phoneNumber')}
            />
          </UserFormField>
        ) : null}
        {shown('role') ? (
          <UserFormField className="sm:col-span-2" id={`${idPrefix}-role`} label={t('form.role')}>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select
                  onValueChange={(value) => {
                    if (isRole(value)) {
                      field.onChange(value)
                    }
                  }}
                  value={field.value}
                >
                  <SelectTrigger id={`${idPrefix}-role`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {tc(`roles.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </UserFormField>
        ) : null}
        {shown('password') ? (
          <UserFormField
            className="sm:col-span-2"
            error={message(errors.password?.message)}
            hint={t(editing ? 'form.password_hint_edit' : 'form.password_hint_create', {
              max: LIMITS.password.max,
              min: LIMITS.password.min,
            })}
            id={`${idPrefix}-password`}
            label={t(editing ? 'form.password_edit' : 'form.password_create')}
          >
            <Input
              aria-describedby={`${idPrefix}-password-hint`}
              aria-invalid={errors.password !== undefined}
              autoComplete="new-password"
              id={`${idPrefix}-password`}
              maxLength={LIMITS.password.max}
              type="password"
              {...register('password')}
            />
          </UserFormField>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel} type="button" variant="outline">
          {tc('actions.cancel')}
        </Button>
        <Button disabled={pending || !isValid || (editing && !isDirty)} type="submit">
          {pending ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
          {editing ? t('edit.submit') : t('create.submit')}
        </Button>
      </div>
    </form>
  )
}
