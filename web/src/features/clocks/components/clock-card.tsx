import { LoaderCircleIcon, LogInIcon, LogOutIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ErrorState } from '@/components/shared/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { LIMITS } from '@/config/limits'
import { useClockIn } from '@/features/clocks/hooks/use-clock-in'
import { useClockOut } from '@/features/clocks/hooks/use-clock-out'
import { useCurrentClock } from '@/features/clocks/hooks/use-current-clock'
import { Dates } from '@/lib/dates'
import { Duration } from '@/lib/duration'

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) {
      return
    }
    setNow(Date.now())
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [active])

  return now
}

export function ClockCard() {
  const { t } = useTranslation('clocks')
  const [note, setNote] = useState('')
  const { clock, error, isError, loading, refetch } = useCurrentClock()
  const { clockIn, conflict: inConflict, pending: inPending, reset: resetIn } = useClockIn()
  const { clockOut, conflict: outConflict, pending: outPending, reset: resetOut } = useClockOut()
  const clockedIn = clock !== null
  const now = useNow(clockedIn)
  const busy = inPending || outPending
  const elapsed = clock ? Duration.elapsed(clock.clockedInAt, now) : 0

  function toggle() {
    const trimmed = note.trim()
    const params = trimmed === '' ? {} : { note: trimmed }
    const options = {
      onSuccess: () => {
        setNote('')
      },
    }
    resetIn()
    resetOut()
    if (clockedIn) {
      clockOut(params, options)
    } else {
      clockIn(params, options)
    }
  }

  if (loading) {
    return (
      <Card aria-busy role="status">
        <span className="sr-only">{t('card.loading')}</span>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-5 py-4">
          <Skeleton className="h-14 w-48" />
          <Skeleton className="h-14 w-full max-w-xs" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <Card>
        <CardContent>
          <ErrorState
            error={error}
            onRetry={() => {
              void refetch()
            }}
            title={t('card.title')}
          />
        </CardContent>
      </Card>
    )
  }

  const status = clock
    ? t('card.announce_in', { time: Dates.time(clock.clockedInAt) })
    : t('card.announce_out')

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('card.title')}</CardTitle>
          <Badge variant={clockedIn ? 'success' : 'outline'}>
            {clockedIn ? t('card.status_in') : t('card.status_out')}
          </Badge>
        </div>
        <CardDescription>
          {clock ? t('card.since', { time: Dates.time(clock.clockedInAt) }) : t('card.idle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5 py-4">
        <p aria-live="polite" className="sr-only" role="status">
          {status}
        </p>
        <div
          aria-label={t('card.timer')}
          aria-live="off"
          className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
          role="timer"
        >
          {Duration.format(elapsed)}
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="clock-note">{t('card.note_label')}</Label>
          <Input
            autoComplete="off"
            disabled={busy}
            id="clock-note"
            maxLength={LIMITS.note}
            onChange={(event) => {
              setNote(event.target.value)
            }}
            value={note}
          />
        </div>
        {inConflict || outConflict ? (
          <p className="text-sm text-destructive" role="alert">
            {inConflict ? t('card.conflict_in') : t('card.conflict_out')}
          </p>
        ) : null}
        <Button
          className="h-14 w-full max-w-xs text-base"
          disabled={busy}
          onClick={toggle}
          size="lg"
          variant={clockedIn ? 'outline' : 'default'}
        >
          {busy ? <LoaderCircleIcon aria-hidden className="size-5 animate-spin" /> : null}
          {!busy && clockedIn ? <LogOutIcon aria-hidden className="size-5" /> : null}
          {!busy && !clockedIn ? <LogInIcon aria-hidden className="size-5" /> : null}
          {clockedIn ? t('card.clock_out') : t('card.clock_in')}
        </Button>
      </CardContent>
    </Card>
  )
}
