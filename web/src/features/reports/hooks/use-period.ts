import { useMemo, useState } from 'react'

import type { PeriodState } from '@/features/reports/lib/period'

import { autoGranularity, DEFAULT_PERIOD_STATE, resolvePeriod } from '@/features/reports/lib/period'

export function usePeriod() {
  const [now] = useState(() => new Date())
  const [state, setState] = useState<PeriodState>(DEFAULT_PERIOD_STATE)
  const period = useMemo(() => resolvePeriod(state, now), [state, now])
  const auto = useMemo(
    () => (period.error ? 'day' : autoGranularity(period.from, period.to)),
    [period],
  )
  return { auto, period, setState, state }
}
