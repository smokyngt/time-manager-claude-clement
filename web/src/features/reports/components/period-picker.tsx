import type { Granularity } from '@/features/reports/api/types'
import type { PeriodPreset, PeriodState } from '@/features/reports/lib/period'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PERIOD_PRESETS } from '@/features/reports/lib/period'

const AUTO = 'auto'

const GRANULARITIES: { label: string; value: Granularity }[] = [
  { label: 'By day', value: 'day' },
  { label: 'By week', value: 'week' },
  { label: 'By month', value: 'month' },
]

export function PeriodPicker({
  auto_granularity,
  error,
  onChange,
  value,
}: {
  auto_granularity: Granularity
  error: null | string
  onChange: (value: PeriodState) => void
  value: PeriodState
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="period-preset">Period</Label>
          <Select
            onValueChange={(preset) => { onChange({ ...value, preset: preset as PeriodPreset }); }}
            value={value.preset}
          >
            <SelectTrigger className="w-44" id="period-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={preset.value}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="period-granularity">Group</Label>
          <Select
            onValueChange={(granularity) => { onChange({
                ...value,
                granularity: granularity === AUTO ? null : (granularity as Granularity),
              }); }
            }
            value={value.granularity ?? AUTO}
          >
            <SelectTrigger className="w-40" id="period-granularity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>{`Auto (${auto_granularity})`}</SelectItem>
              {GRANULARITIES.map((granularity) => (
                <SelectItem key={granularity.value} value={granularity.value}>
                  {granularity.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {value.preset === 'custom' ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="period-from">From</Label>
              <Input
                id="period-from"
                onChange={(event) => { onChange({ ...value, custom_from: event.target.value }); }}
                type="date"
                value={value.custom_from}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-to">To</Label>
              <Input
                id="period-to"
                onChange={(event) => { onChange({ ...value, custom_to: event.target.value }); }}
                type="date"
                value={value.custom_to}
              />
            </div>
          </>
        ) : null}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
