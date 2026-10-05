import { LogInIcon, LogOutIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDuration } from '@/lib/utils'

export function ClockCard() {
  const [started_at, setStartedAt] = useState<null | number>(null)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (started_at === null) return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started_at) / 1000))
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [started_at])

  const clocked_in = started_at !== null

  function toggle() {
    if (clocked_in) {
      setStartedAt(null)
      setElapsed(0)
      return
    }
    setStartedAt(Date.now())
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
          {clocked_in ? 'Your shift is running' : 'Start your shift when you arrive'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5 py-4">
        <div
          aria-label="Elapsed time"
          aria-live="off"
          className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl"
          role="timer"
        >
          {formatDuration(elapsed)}
        </div>
        <Button
          className="h-14 w-full max-w-xs text-base"
          onClick={toggle}
          size="lg"
          variant={clocked_in ? 'outline' : 'default'}
        >
          {clocked_in ? <LogOutIcon className="size-5" /> : <LogInIcon className="size-5" />}
          {clocked_in ? 'Clock out' : 'Clock in'}
        </Button>
        <p className="text-xs text-muted-foreground">Preview only, not saved yet.</p>
      </CardContent>
    </Card>
  )
}
