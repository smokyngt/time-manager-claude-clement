import type { UserReportKpis } from '@time-manager/sdk'

import { Duration } from '@/lib/duration'

import { elapsedFraction } from '@/features/reports/lib/series'

export type Tone = 'negative' | 'positive'

export function signedDuration(ms: number) {
  const text = Duration.short(Math.abs(ms))
  if (Math.floor(Math.abs(ms) / 60_000) === 0) {
    return text
  }
  return `${ms < 0 ? '-' : '+'}${text}`
}

export function formatPercent(rate: number, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1, style: 'percent' }).format(rate)
}

export function overtimeTone(overtimeMs: number, complete: boolean): Tone | undefined {
  if (!complete || overtimeMs === 0) {
    return undefined
  }
  return overtimeMs < 0 ? 'negative' : 'positive'
}

export function elapsedTarget(
  kpis: Pick<UserReportKpis, 'targetMs'>,
  range: { from: number; now: number; to: number },
) {
  return Math.round(kpis.targetMs * elapsedFraction(range.from, range.to, range.now))
}

export function userOvertime(
  kpis: Pick<UserReportKpis, 'overtimeMs' | 'targetMs' | 'workedMs'>,
  range: { from: number; now: number; to: number },
) {
  if (range.to <= range.now) {
    return kpis.overtimeMs
  }
  return kpis.workedMs - elapsedTarget(kpis, range)
}
