import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'

import type { PasswordValues } from '@/features/profile/schemas'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordStrengthHint } from '@/features/profile/components/password-strength-hint'
import { passwordSchema } from '@/features/profile/schemas'
import { FormField } from '@/features/users/components/form-field'

export function ChangePasswordForm({
  formError,
  onSubmit,
  pending,
}: {
  formError?: null | string
  onSubmit: (values: PasswordValues) => Promise<boolean>
  pending: boolean
}) {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<PasswordValues>({
    defaultValues: { confirm_password: '', new_password: '' },
    resolver: zodResolver(passwordSchema),
  })
  const new_password = useWatch({ control, name: 'new_password' })

  async function submit(values: PasswordValues) {
    if (await onSubmit(values)) reset()
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => void handleSubmit(submit)(event)}
    >
      {formError ? (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      <FormField error={errors.new_password?.message} id="profile-new-password" label="New password">
        <Input
          aria-invalid={Boolean(errors.new_password)}
          autoComplete="new-password"
          id="profile-new-password"
          type="password"
          {...register('new_password')}
        />
        <PasswordStrengthHint password={new_password} />
      </FormField>
      <FormField
        error={errors.confirm_password?.message}
        id="profile-confirm-password"
        label="Confirm password"
      >
        <Input
          aria-invalid={Boolean(errors.confirm_password)}
          autoComplete="new-password"
          id="profile-confirm-password"
          type="password"
          {...register('confirm_password')}
        />
      </FormField>
      <div className="flex sm:justify-end">
        <Button disabled={pending} type="submit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Change password
        </Button>
      </div>
    </form>
  )
}
