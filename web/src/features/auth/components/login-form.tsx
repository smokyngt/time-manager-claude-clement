import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircleIcon, EyeIcon, EyeOffIcon, Loader2Icon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { LoginValues } from '@/features/auth/lib/login-schema'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LIMITS } from '@/config/limits'
import { createLoginSchema } from '@/features/auth/lib/login-schema'
import { Errors } from '@/lib/errors'
import { useAuth } from '@/providers/use-auth'

type LoginFormProps = {
  onSuccess: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { t } = useTranslation('auth')
  const { login } = useAuth()
  const [formError, setFormError] = useState<null | string>(null)
  const [reveal, setReveal] = useState(false)
  const schema = useMemo(() => createLoginSchema(t), [t])
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(schema),
  })

  async function submit(values: LoginValues) {
    setFormError(null)
    try {
      await login(values)
      onSuccess()
    } catch (error) {
      setFormError(Errors.translate(error))
    }
  }

  return (
    <form
      aria-busy={isSubmitting}
      className="space-y-4"
      noValidate
      onSubmit={(event) => void handleSubmit(submit)(event)}
    >
      <div aria-live="assertive" role="alert">
        {formError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{formError}</span>
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-email">{t('form.email')}</Label>
        <Input
          aria-describedby={errors.email ? 'login-email-error' : undefined}
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          id="login-email"
          inputMode="email"
          maxLength={LIMITS.email}
          placeholder={t('form.email_placeholder')}
          type="email"
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-sm text-destructive" id="login-email-error" role="alert">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="login-password">{t('form.password')}</Label>
        <div className="relative">
          <Input
            aria-describedby={errors.password ? 'login-password-error' : undefined}
            aria-invalid={Boolean(errors.password)}
            autoComplete="current-password"
            className="pr-10"
            id="login-password"
            maxLength={LIMITS.password.max}
            type={reveal ? 'text' : 'password'}
            {...register('password')}
          />
          <Button
            aria-label={reveal ? t('form.hide_password') : t('form.show_password')}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0"
            onClick={() => {
              setReveal((value) => !value)
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            {reveal ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          </Button>
        </div>
        {errors.password ? (
          <p className="text-sm text-destructive" id="login-password-error" role="alert">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
        {isSubmitting ? t('form.submitting') : t('form.submit')}
      </Button>
    </form>
  )
}
