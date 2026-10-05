import type { ReactNode } from 'react'

import { useTranslation } from 'react-i18next'

import type { UserOption } from '@/features/clocks/hooks/use-clock-users'
import type { RangePreset } from '@/features/clocks/lib/clock-range'

import { ListToolbar } from '@/components/shared/list-toolbar'
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
import { ClockRange } from '@/features/clocks/lib/clock-range'

export type ClocksToolbarProps = {
  actions?: ReactNode
  from: string
  invalid: boolean
  onFromChange: (value: string) => void
  onPresetChange: (preset: RangePreset) => void
  onToChange: (value: string) => void
  onUserChange?: (userId: string) => void
  ownId: string
  preset: RangePreset
  to: string
  userId: string
  users: UserOption[]
}

export function ClocksToolbar({
  actions,
  from,
  invalid,
  onFromChange,
  onPresetChange,
  onToChange,
  onUserChange,
  ownId,
  preset,
  to,
  userId,
  users,
}: ClocksToolbarProps) {
  const { t } = useTranslation('clocks')

  return (
    <ListToolbar
      actions={actions}
      filters={
        <>
          {onUserChange ? (
            <div className="space-y-1">
              <Label htmlFor="clocks-user">{t('toolbar.user')}</Label>
              <Select onValueChange={onUserChange} value={userId}>
                <SelectTrigger className="w-56" id="clocks-user">
                  <SelectValue placeholder={t('toolbar.user_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.id === ownId ? t('toolbar.me', { name: option.label }) : option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div aria-label={t('toolbar.range')} className="flex flex-wrap gap-1" role="group">
            {ClockRange.presets.map((option) => (
              <Button
                aria-pressed={preset === option}
                className="pointer-coarse:h-11"
                key={option}
                onClick={() => {
                  onPresetChange(option)
                }}
                size="sm"
                variant={preset === option ? 'default' : 'outline'}
              >
                {t(`range.${option}`)}
              </Button>
            ))}
          </div>
          {preset === 'custom' ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="clocks-from">{t('toolbar.from')}</Label>
                <Input
                  id="clocks-from"
                  onChange={(event) => {
                    onFromChange(event.target.value)
                  }}
                  type="date"
                  value={from}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="clocks-to">{t('toolbar.to')}</Label>
                <Input
                  aria-invalid={invalid}
                  id="clocks-to"
                  min={from || undefined}
                  onChange={(event) => {
                    onToChange(event.target.value)
                  }}
                  type="date"
                  value={to}
                />
              </div>
              {invalid ? (
                <p className="text-sm text-destructive" role="alert">
                  {t('toolbar.invalid_range')}
                </p>
              ) : null}
            </>
          ) : null}
        </>
      }
    />
  )
}
