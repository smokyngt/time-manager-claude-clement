import type { RangePreset } from '@/features/clocks/lib/ranges'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RANGE_PRESETS } from '@/features/clocks/lib/ranges'

export function ClocksFilters({
  custom_from,
  custom_to,
  onCustomFromChange,
  onCustomToChange,
  onPresetChange,
  preset,
}: {
  custom_from: string
  custom_to: string
  onCustomFromChange: (value: string) => void
  onCustomToChange: (value: string) => void
  onPresetChange: (preset: RangePreset) => void
  preset: RangePreset
}) {
  const invalid =
    preset === 'custom' && Boolean(custom_from) && Boolean(custom_to) && custom_to < custom_from
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div aria-label="Date range" className="flex gap-1" role="group">
        {RANGE_PRESETS.map((option) => (
          <Button
            aria-pressed={preset === option.value}
            key={option.value}
            onClick={() => {
              onPresetChange(option.value)
            }}
            size="sm"
            variant={preset === option.value ? 'default' : 'outline'}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {preset === 'custom' ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="range-from">From</Label>
            <Input
              id="range-from"
              onChange={(event) => {
                onCustomFromChange(event.target.value)
              }}
              type="date"
              value={custom_from}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="range-to">To</Label>
            <Input
              aria-invalid={invalid}
              id="range-to"
              min={custom_from || undefined}
              onChange={(event) => {
                onCustomToChange(event.target.value)
              }}
              type="date"
              value={custom_to}
            />
          </div>
          {invalid ? (
            <p className="text-sm text-destructive" role="alert">
              The end date must be after the start date
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
