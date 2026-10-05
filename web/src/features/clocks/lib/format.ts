import { format } from 'date-fns'

const MS_PER_MINUTE = 60_000
const MS_PER_SECOND = 1000

export function elapsedSeconds(started_at: number, now: number) {
  return Math.max(0, Math.floor((now - started_at) / MS_PER_SECOND))
}

export function formatClockTime(timestamp: null | number) {
  return timestamp === null ? '-' : format(timestamp, 'HH:mm')
}

export function formatDateLabel(timestamp: number) {
  return format(timestamp, 'EEE d MMM yyyy')
}

export function formatDurationMs(duration_ms: null | number) {
  if (duration_ms === null) return '-'
  const total_minutes = Math.round(duration_ms / MS_PER_MINUTE)
  const hours = Math.floor(total_minutes / 60)
  const minutes = total_minutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function formatTimer(total_seconds: number) {
  const hours = Math.floor(total_seconds / 3600)
  const minutes = Math.floor((total_seconds % 3600) / 60)
  const seconds = total_seconds % 60
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':')
}

export function fromInputValue(value: string) {
  return new Date(value).getTime()
}

export function toInputValue(timestamp: number) {
  return format(timestamp, "yyyy-MM-dd'T'HH:mm")
}
