import type { Granularity } from '@time-manager/sdk'

import { useTranslation } from 'react-i18next'

import type { PeriodError, PeriodState } from '@/features/reports/lib/period'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  GRANULARITIES,
  isGranularityChoice,
  isPreset,
  MAX_RANGE_DAYS,
  PERIOD_PRESETS,
} from '@/features/reports/lib/period'

export type PeriodPickerProps = {
  autoGranularity: Granularity
  error: null | PeriodError
  onChange: (patch: Partial<PeriodState>) => void
  value: PeriodState
}

export function PeriodPicker({ autoGranularity, error, onChange, value }: PeriodPickerProps) {
  const { t } = useTranslation('reports')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="period-preset">{t('period.label')}</Label>
          <Select
            onValueChange={(preset) => {
              if (isPreset(preset)) {
                onChange({ preset })
              }
            }}
            value={value.preset}
          >
            <SelectTrigger className="w-48" id="period-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((preset) => (
                <SelectItem key={preset} value={preset}>
                  {t(`period.presets.${preset}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="period-granularity">{t('period.group')}</Label>
          <Select
            onValueChange={(granularity) => {
              if (isGranularityChoice(granularity)) {
                onChange({ granularity })
              }
            }}
            value={value.granularity}
          >
            <SelectTrigger className="w-44" id="period-granularity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                {t('period.auto', { granularity: t(`unit.${autoGranularity}`) })}
              </SelectItem>
              {GRANULARITIES.map((granularity) => (
                <SelectItem key={granularity} value={granularity}>
                  {t(`period.granularity.${granularity}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {value.preset === 'custom' ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="period-from">{t('period.from')}</Label>
              <Input
                id="period-from"
                onChange={(event) => {
                  onChange({ from: event.target.value })
                }}
                type="date"
                value={value.from}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period-to">{t('period.to')}</Label>
              <Input
                id="period-to"
                onChange={(event) => {
                  onChange({ to: event.target.value })
                }}
                type="date"
                value={value.to}
              />
            </div>
          </>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {t(`period.errors.${error}`, { days: MAX_RANGE_DAYS })}
        </p>
      ) : null}
    </div>
  )
}
