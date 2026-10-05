import { useCallback, useMemo, useState } from 'react'

import type { PeriodState } from '@/features/reports/lib/period'

import {
  autoGranularity,
  DEFAULT_PERIOD_STATE,
  isGranularityChoice,
  isPreset,
  resolvePeriod,
} from '@/features/reports/lib/period'
import { useMultiParams } from '@/hooks'

const DEFAULTS: Record<keyof PeriodState, string> = DEFAULT_PERIOD_STATE

export function usePeriod() {
  const { reset, set, values } = useMultiParams(DEFAULTS)
  const [now] = useState(() => new Date())

  const state = useMemo<PeriodState>(
    () => ({
      from: values.from,
      granularity: isGranularityChoice(values.granularity)
        ? values.granularity
        : DEFAULT_PERIOD_STATE.granularity,
      preset: isPreset(values.preset) ? values.preset : DEFAULT_PERIOD_STATE.preset,
      to: values.to,
    }),
    [values],
  )
  const period = useMemo(() => resolvePeriod(state, now), [state, now])
  const auto = useMemo(
    () => (period.error ? 'day' : autoGranularity(period.from, period.to)),
    [period],
  )
  const change = useCallback(
    (patch: Partial<PeriodState>) => {
      set(patch)
    },
    [set],
  )

  return { auto, change, now: now.getTime(), period, reset, state }
}
