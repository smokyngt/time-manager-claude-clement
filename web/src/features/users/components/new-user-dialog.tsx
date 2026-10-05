import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { NewUserValues } from '@/features/users/schemas'
import type { Role } from '@/features/users/types'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FormField } from '@/features/users/components/form-field'
import { RoleSelect } from '@/features/users/components/role-select'
import { useCreateUser } from '@/features/users/hooks/use-users'
import { assignableRoles } from '@/features/users/permissions'
import { newUserSchema, PASSWORD_MIN_LENGTH } from '@/features/users/schemas'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

export function NewUserDialog({ actorRole }: { actorRole: Role }) {
  const [open, setOpen] = useState(false)
  const [form_error, setFormError] = useState<null | string>(null)
  const { isPending, mutateAsync } = useCreateUser()
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
  } = useForm<NewUserValues>({
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      phone_number: '',
      role: 'employee',
    },
    resolver: zodResolver(newUserSchema),
  })

  async function onSubmit(values: NewUserValues) {
    setFormError(null)
    try {
      await mutateAsync({
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
        password: values.password === '' ? undefined : values.password,
        phone_number: values.phone_number === '' ? undefined : values.phone_number,
        role: actorRole === 'admin' ? values.role : 'employee',
      })
      toast.success(`${values.first_name} ${values.last_name} was created`)
      reset()
      setOpen(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setError('email', { message: 'This email is already in use' })
        return
      }
      const message = getErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          reset()
          setFormError(null)
        }
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            {actorRole === 'admin'
              ? 'Create an account and choose its role.'
              : 'Create an employee account.'}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => void handleSubmit(onSubmit)(event)}
        >
          {form_error ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {form_error}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              error={errors.first_name?.message}
              id="new-user-first_name"
              label="First name"
            >
              <Input
                aria-invalid={Boolean(errors.first_name)}
                autoComplete="off"
                id="new-user-first_name"
                {...register('first_name')}
              />
            </FormField>
            <FormField error={errors.last_name?.message} id="new-user-last_name" label="Last name">
              <Input
                aria-invalid={Boolean(errors.last_name)}
                autoComplete="off"
                id="new-user-last_name"
                {...register('last_name')}
              />
            </FormField>
            <FormField
              className="sm:col-span-2"
              error={errors.email?.message}
              id="new-user-email"
              label="Email"
            >
              <Input
                aria-invalid={Boolean(errors.email)}
                autoComplete="off"
                id="new-user-email"
                type="email"
                {...register('email')}
              />
            </FormField>
            <FormField
              className="sm:col-span-2"
              error={errors.phone_number?.message}
              id="new-user-phone_number"
              label="Phone number (optional)"
            >
              <Input
                aria-invalid={Boolean(errors.phone_number)}
                autoComplete="off"
                id="new-user-phone_number"
                type="tel"
                {...register('phone_number')}
              />
            </FormField>
            {actorRole === 'admin' ? (
              <FormField className="sm:col-span-2" id="new-user-role" label="Role">
                <Controller
                  control={control}
                  name="role"
                  render={({ field }) => (
                    <RoleSelect
                      id="new-user-role"
                      onChange={field.onChange}
                      roles={assignableRoles(actorRole)}
                      value={field.value}
                    />
                  )}
                />
              </FormField>
            ) : null}
            <FormField
              className="sm:col-span-2"
              error={errors.password?.message}
              hint={`Optional, minimum ${PASSWORD_MIN_LENGTH} characters. Leave empty if the user signs in with Microsoft only.`}
              id="new-user-password"
              label="Initial password"
            >
              <Input
                aria-invalid={Boolean(errors.password)}
                autoComplete="new-password"
                id="new-user-password"
                type="password"
                {...register('password')}
              />
            </FormField>
          </div>
          <DialogFooter>
            <Button disabled={isPending} type="submit">
              {isPending ? <Loader2Icon className="animate-spin" /> : null}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
