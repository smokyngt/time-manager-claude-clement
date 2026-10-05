import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircleIcon, Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { LoginValues } from '@/features/auth/login-schema'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getLoginErrorMessage } from '@/features/auth/auth-errors'
import { loginSchema } from '@/features/auth/login-schema'
import { useAuth } from '@/lib/auth/use-auth'

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { login } = useAuth()
  const [form_error, setFormError] = useState<null | string>(null)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(values: LoginValues) {
    setFormError(null)
    try {
      await login(values)
      onSuccess()
    } catch (error) {
      const message = getLoginErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <form className="space-y-4" noValidate onSubmit={(event) => void handleSubmit(onSubmit)(event)}>
      {form_error ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{form_error}</span>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          aria-describedby={errors.email ? 'email-error' : undefined}
          aria-invalid={Boolean(errors.email)}
          autoComplete="email"
          id="email"
          inputMode="email"
          placeholder="you@company.com"
          type="email"
          {...register('email')}
        />
        {errors.email ? (
          <p className="text-sm text-destructive" id="email-error">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          aria-describedby={errors.password ? 'password-error' : undefined}
          aria-invalid={Boolean(errors.password)}
          autoComplete="current-password"
          id="password"
          type="password"
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-sm text-destructive" id="password-error">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      <Button className="w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? <Loader2Icon className="animate-spin" /> : null}
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  )
}
