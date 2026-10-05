import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { PasswordValues } from '@/features/profile/lib/schemas'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/features/profile/components/field'
import { PasswordStrengthHint } from '@/features/profile/components/password-strength-hint'
import { ProfileSchemas } from '@/features/profile/lib/schemas'

export type ChangePasswordFormProps = {
  onSubmit: (values: PasswordValues) => Promise<boolean>
  pending: boolean
  wrongPassword: boolean
}

export function ChangePasswordForm({ onSubmit, pending, wrongPassword }: ChangePasswordFormProps) {
  const { t } = useTranslation('profile')
  const { t: tErrors } = useTranslation('errors')
  const schema = useMemo(() => ProfileSchemas.password(t), [t])
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
  } = useForm<PasswordValues>({
    defaultValues: { confirmPassword: '', currentPassword: '', newPassword: '' },
    resolver: zodResolver(schema),
  })
  const newPassword = useWatch({ control, name: 'newPassword' })

  async function submit(values: PasswordValues) {
    if (await onSubmit(values)) {
      reset()
    }
  }

  const currentError = wrongPassword ? tErrors('user.password.invalid') : errors.currentPassword?.message

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void handleSubmit(submit)(event)}>
      <Field error={currentError} id="profile-current-password" label={t('password.current')}>
        <Input
          aria-invalid={Boolean(currentError)}
          autoComplete="current-password"
          id="profile-current-password"
          type="password"
          {...register('currentPassword')}
        />
      </Field>
      <Field error={errors.newPassword?.message} id="profile-new-password" label={t('password.new')}>
        <Input
          aria-invalid={Boolean(errors.newPassword)}
          autoComplete="new-password"
          id="profile-new-password"
          type="password"
          {...register('newPassword')}
        />
        <PasswordStrengthHint password={newPassword} />
      </Field>
      <Field
        error={errors.confirmPassword?.message}
        id="profile-confirm-password"
        label={t('password.confirm')}
      >
        <Input
          aria-invalid={Boolean(errors.confirmPassword)}
          autoComplete="new-password"
          id="profile-confirm-password"
          type="password"
          {...register('confirmPassword')}
        />
      </Field>
      <div className="flex sm:justify-end">
        <Button disabled={pending} type="submit">
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          {t('password.submit')}
        </Button>
      </div>
    </form>
  )
}
