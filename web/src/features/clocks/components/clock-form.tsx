import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircleIcon } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { UserOption } from '@/features/clocks/hooks/use-clock-users'
import type { ClockFormValues } from '@/features/clocks/lib/clock-schema'
import type { ClockEntry } from '@/features/clocks/lib/clock-values'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/config/limits'
import { clockSchema } from '@/features/clocks/lib/clock-schema'
import { ClockValues } from '@/features/clocks/lib/clock-values'

export type ClockFormProps = {
  defaultValues: ClockFormValues
  editing: boolean
  onSubmit: (entry: ClockEntry) => void
  pending: boolean
  users: UserOption[]
}

export function ClockForm({ defaultValues, editing, onSubmit, pending, users }: ClockFormProps) {
  const { t } = useTranslation('clocks')
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
  } = useForm<ClockFormValues>({
    defaultValues,
    mode: 'onChange',
    resolver: zodResolver(clockSchema),
  })

  function submit(values: ClockFormValues) {
    const entry = ClockValues.toEntry(values)
    if (entry !== null) {
      onSubmit(entry)
    }
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={(event) => void handleSubmit(submit)(event)}>
      <p className="text-sm text-muted-foreground">{t('form.hint')}</p>
      <div className="space-y-2">
        <Label htmlFor="clock-user">{t('form.user')}</Label>
        <Controller
          control={control}
          name="userId"
          render={({ field }) => (
            <Select disabled={editing} onValueChange={field.onChange} value={field.value}>
              <SelectTrigger aria-invalid={Boolean(errors.userId)} id="clock-user">
                <SelectValue placeholder={t('form.user_placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.userId?.message ? (
          <p className="text-sm text-destructive" role="alert">
            {t(errors.userId.message)}
          </p>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="clock-in">{t('form.clocked_in_at')}</Label>
          <Input
            aria-invalid={Boolean(errors.clockedInAt)}
            id="clock-in"
            type="datetime-local"
            {...register('clockedInAt')}
          />
          {errors.clockedInAt?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {t(errors.clockedInAt.message)}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="clock-out">{t('form.clocked_out_at')}</Label>
          <Input
            aria-invalid={Boolean(errors.clockedOutAt)}
            id="clock-out"
            type="datetime-local"
            {...register('clockedOutAt')}
          />
          {errors.clockedOutAt?.message ? (
            <p className="text-sm text-destructive" role="alert">
              {t(errors.clockedOutAt.message)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="clock-entry-note">{t('form.note')}</Label>
        <Textarea
          aria-invalid={Boolean(errors.note)}
          id="clock-entry-note"
          maxLength={LIMITS.note}
          {...register('note')}
        />
        {errors.note?.message ? (
          <p className="text-sm text-destructive" role="alert">
            {t(errors.note.message)}
          </p>
        ) : null}
      </div>
      <Button disabled={pending || !isValid} type="submit">
        {pending ? <LoaderCircleIcon aria-hidden className="animate-spin" /> : null}
        {editing ? t('edit.submit') : t('create.submit')}
      </Button>
    </form>
  )
}
