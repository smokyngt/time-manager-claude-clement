import { AlertCircleIcon, BarChart3Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/api/errors'

export function ReportEmpty({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
        <BarChart3Icon aria-hidden className="size-6 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  )
}

export function ReportError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card role="alert">
      <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
        <AlertCircleIcon aria-hidden className="size-6 text-destructive" />
        <p className="text-sm">{getErrorMessage(error)}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          Try again
        </Button>
      </CardContent>
    </Card>
  )
}

export function ReportSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading report" className="space-y-4" role="status">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-28" key={index} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  )
}
