import { Loader2Icon, LogInIcon, LogOutIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useClockIn, useClockOut } from '@/features/clocks/hooks/use-clock-actions'
import { useCurrentClock } from '@/features/clocks/hooks/use-current-clock'
import { elapsedSeconds, formatClockTime, formatTimer } from '@/features/clocks/lib/format'
import { getErrorMessage } from '@/lib/api/errors'

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active) return
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
  const [note, setNote] = useState('')
  const { data: clock, error, isError, isPending, refetch } = useCurrentClock()
  const clock_in = useClockIn()
  const clock_out = useClockOut()
  const clocked_in = Boolean(clock)
  const now = useNow(clocked_in)
  const busy = clock_in.isPending || clock_out.isPending
  const seconds = clock ? elapsedSeconds(clock.clocked_in_at, now) : 0

  function toggle() {
    const trimmed = note.trim()
    const options = {
      onSuccess: () => {
        setNote('')
      },
    }
    if (clocked_in) clock_out.mutate(trimmed || undefined, options)
    else clock_in.mutate(trimmed || undefined, options)
  }

  if (isPending) {
    return (
      <Card aria-busy role="status">
        <span className="sr-only">Loading time clock</span>
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
        <CardHeader>
          <CardTitle>Time clock</CardTitle>
          <CardDescription role="alert">{getErrorMessage(error)}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => {
              void refetch()
            }}
            variant="outline"
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Time clock</CardTitle>
          <Badge variant={clocked_in ? 'success' : 'outline'}>
            {clocked_in ? 'Clocked in' : 'Clocked out'}
          </Badge>
        </div>
        <CardDescription>
          {clock
            ? `Since ${formatClockTime(clock.clocked_in_at)}`
            : 'Start your shift when you arrive'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5 py-4">
        <div
          aria-label="Elapsed time"
          aria-live="off"
          className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
          role="timer"
        >
          {formatTimer(seconds)}
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="clock-note">Note (optional)</Label>
          <Input
            autoComplete="off"
            disabled={busy}
            id="clock-note"
            maxLength={500}
            onChange={(event) => {
              setNote(event.target.value)
            }}
            value={note}
          />
        </div>
        <Button
          className="h-14 w-full max-w-xs text-base"
          disabled={busy}
          onClick={toggle}
          size="lg"
          variant={clocked_in ? 'outline' : 'default'}
        >
          {busy ? <Loader2Icon className="size-5 animate-spin" /> : null}
          {!busy && clocked_in ? <LogOutIcon className="size-5" /> : null}
          {!busy && !clocked_in ? <LogInIcon className="size-5" /> : null}
          {clocked_in ? 'Clock out' : 'Clock in'}
        </Button>
      </CardContent>
    </Card>
  )
}
