import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon, PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import type { NewUserValues } from '@/features/users/new-user-schema'

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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateUser } from '@/features/users/hooks/use-users'
import { newUserSchema } from '@/features/users/new-user-schema'
import { ApiError, getErrorMessage } from '@/lib/api/errors'

const TEXT_FIELDS = [
  { autoComplete: 'off', label: 'First name', name: 'first_name', type: 'text' },
  { autoComplete: 'off', label: 'Last name', name: 'last_name', type: 'text' },
  { autoComplete: 'off', label: 'Email', name: 'email', type: 'email' },
  { autoComplete: 'off', label: 'Phone number', name: 'phone_number', type: 'tel' },
] as const

export function NewUserDialog() {
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
    defaultValues: { email: '', first_name: '', last_name: '', phone_number: '', role: 'employee' },
    resolver: zodResolver(newUserSchema),
  })

  async function onSubmit(values: NewUserValues) {
    setFormError(null)
    try {
      await mutateAsync(values)
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
            Create an account. The user can then sign in with their email.
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
            {TEXT_FIELDS.map((field) => (
              <div
                className={field.name === 'email' ? 'space-y-2 sm:col-span-2' : 'space-y-2'}
                key={field.name}
              >
                <Label htmlFor={`new-user-${field.name}`}>{field.label}</Label>
                <Input
                  aria-invalid={Boolean(errors[field.name])}
                  autoComplete={field.autoComplete}
                  id={`new-user-${field.name}`}
                  type={field.type}
                  {...register(field.name)}
                />
                {errors[field.name] ? (
                  <p className="text-sm text-destructive">{errors[field.name]?.message}</p>
                ) : null}
              </div>
            ))}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-user-role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger id="new-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
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
