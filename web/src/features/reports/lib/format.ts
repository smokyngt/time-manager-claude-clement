const MS_PER_MINUTE = 60_000

export function formatDuration(ms: number) {
  const total_minutes = Math.round(Math.abs(ms) / MS_PER_MINUTE)
  const hours = Math.floor(total_minutes / 60)
  const minutes = total_minutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}

export function formatPercent(rate: number) {
  return `${Number((rate * 100).toFixed(1))}%`
}

export function formatSignedDuration(ms: number) {
  const text = formatDuration(ms)
  if (Math.round(Math.abs(ms) / MS_PER_MINUTE) === 0) return text
  return `${ms < 0 ? '-' : '+'}${text}`
}

export function msToHours(ms: number) {
  return Math.round((ms / 3_600_000) * 100) / 100
}
