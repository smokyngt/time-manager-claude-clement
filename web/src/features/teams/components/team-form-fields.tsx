import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form'

import { Controller } from 'react-hook-form'

import type { TeamValues } from '@/features/teams/team-schema'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ManagerSelect } from '@/features/teams/components/manager-select'
import { Textarea } from '@/features/teams/components/ui/textarea'

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-sm text-destructive">{message}</p> : null
}

export function TeamFormFields({
  control,
  errors,
  id_prefix,
  register,
  show_manager,
}: {
  control: Control<TeamValues>
  errors: FieldErrors<TeamValues>
  id_prefix: string
  register: UseFormRegister<TeamValues>
  show_manager: boolean
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${id_prefix}-name`}>Name</Label>
        <Input
          aria-invalid={Boolean(errors.name)}
          autoComplete="off"
          id={`${id_prefix}-name`}
          {...register('name')}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${id_prefix}-description`}>Description</Label>
        <Textarea
          aria-invalid={Boolean(errors.description)}
          id={`${id_prefix}-description`}
          {...register('description')}
        />
        <FieldError message={errors.description?.message} />
      </div>
      {show_manager ? (
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${id_prefix}-manager`}>Manager</Label>
          <Controller
            control={control}
            name="manager_id"
            render={({ field }) => (
              <ManagerSelect
                id={`${id_prefix}-manager`}
                invalid={Boolean(errors.manager_id)}
                onChange={field.onChange}
                value={field.value}
              />
            )}
          />
          <FieldError message={errors.manager_id?.message} />
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${id_prefix}-work-start`}>Work start</Label>
        <Input
          aria-invalid={Boolean(errors.work_start)}
          id={`${id_prefix}-work-start`}
          type="time"
          {...register('work_start')}
        />
        <FieldError message={errors.work_start?.message} />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id_prefix}-work-end`}>Work end</Label>
        <Input
          aria-invalid={Boolean(errors.work_end)}
          id={`${id_prefix}-work-end`}
          type="time"
          {...register('work_end')}
        />
        <FieldError message={errors.work_end?.message} />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor={`${id_prefix}-target`}>Weekly hours target</Label>
        <Input
          aria-invalid={Boolean(errors.weekly_hours_target)}
          id={`${id_prefix}-target`}
          inputMode="numeric"
          max={80}
          min={1}
          type="number"
          {...register('weekly_hours_target', { valueAsNumber: true })}
        />
        <FieldError message={errors.weekly_hours_target?.message} />
      </div>
    </div>
  )
}
