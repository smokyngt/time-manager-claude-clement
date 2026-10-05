import type { Team, User } from '@time-manager/sdk'

import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import type { TeamValues } from '@/features/teams/lib/team-schema'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LIMITS } from '@/config/limits'
import { CharCount } from '@/features/teams/components/char-count'
import { ManagerSelect } from '@/features/teams/components/manager-select'
import { TeamMapper } from '@/features/teams/lib/team-mapper'
import { teamSchema } from '@/features/teams/lib/team-schema'

export type TeamFormProps = {
  canPickManager: boolean
  defaultManagerId: string
  idPrefix?: string
  managers?: readonly User[]
  managersLoading?: boolean
  onCancel: () => void
  onSubmit: (values: TeamValues) => void
  submitting?: boolean
  team?: Team
}

const NO_MANAGERS: readonly User[] = []

export function TeamForm({
  canPickManager,
  defaultManagerId,
  idPrefix = 'team',
  managers = NO_MANAGERS,
  managersLoading = false,
  onCancel,
  onSubmit,
  submitting = false,
  team,
}: TeamFormProps) {
  const { t } = useTranslation('teams')
  const {
    control,
    formState: { errors, isValid },
    handleSubmit,
    register,
    watch,
  } = useForm<TeamValues>({
    defaultValues: team ? TeamMapper.fromTeam(team) : TeamMapper.defaults(defaultManagerId),
    mode: 'onChange',
    resolver: zodResolver(teamSchema),
  })
  const nameLength = watch('name').trim().length
  const descriptionLength = watch('description').trim().length

  const message = (key: string | undefined) => (key === undefined ? null : t(key))

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event)
      }}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${idPrefix}-name`}>{t('form.name')}</Label>
          <CharCount id={`${idPrefix}-name-count`} length={nameLength} max={LIMITS.name} />
        </div>
        <Input
          aria-describedby={`${idPrefix}-name-count`}
          aria-invalid={errors.name !== undefined}
          autoComplete="off"
          id={`${idPrefix}-name`}
          {...register('name')}
        />
        {errors.name ? (
          <p className="text-sm text-destructive" role="alert">
            {message(errors.name.message)}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`${idPrefix}-description`}>{t('form.description')}</Label>
          <CharCount
            id={`${idPrefix}-description-count`}
            length={descriptionLength}
            max={LIMITS.description}
          />
        </div>
        <Textarea
          aria-describedby={`${idPrefix}-description-count`}
          aria-invalid={errors.description !== undefined}
          id={`${idPrefix}-description`}
          rows={3}
          {...register('description')}
        />
        {errors.description ? (
          <p className="text-sm text-destructive" role="alert">
            {message(errors.description.message)}
          </p>
        ) : null}
      </div>

      {canPickManager ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-manager`}>{t('form.manager')}</Label>
          <Controller
            control={control}
            name="managerId"
            render={({ field }) => (
              <ManagerSelect
                id={`${idPrefix}-manager`}
                loading={managersLoading}
                managers={managers}
                onChange={field.onChange}
                value={field.value}
              />
            )}
          />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-work-start`}>{t('form.work_start')}</Label>
          <Input
            aria-invalid={errors.workStart !== undefined}
            id={`${idPrefix}-work-start`}
            type="time"
            {...register('workStart')}
          />
          {errors.workStart ? (
            <p className="text-sm text-destructive" role="alert">
              {message(errors.workStart.message)}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-work-end`}>{t('form.work_end')}</Label>
          <Input
            aria-invalid={errors.workEnd !== undefined}
            id={`${idPrefix}-work-end`}
            type="time"
            {...register('workEnd')}
          />
          {errors.workEnd ? (
            <p className="text-sm text-destructive" role="alert">
              {message(errors.workEnd.message)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-hours`}>{t('form.weekly_hours')}</Label>
        <Input
          aria-invalid={errors.weeklyHoursTarget !== undefined}
          id={`${idPrefix}-hours`}
          inputMode="numeric"
          max={LIMITS.weeklyHours.max}
          min={LIMITS.weeklyHours.min}
          type="number"
          {...register('weeklyHoursTarget', { valueAsNumber: true })}
        />
        {errors.weeklyHoursTarget ? (
          <p className="text-sm text-destructive" role="alert">
            {message(errors.weeklyHoursTarget.message)}
          </p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={onCancel} type="button" variant="outline">
          {t('common:actions.cancel')}
        </Button>
        <Button disabled={!isValid || submitting} type="submit">
          {team ? t('edit.submit') : t('create.submit')}
        </Button>
      </div>
    </form>
  )
}
