import { WifiOff } from 'lucide-react'

import { useOnline } from '@/lib/pwa/use-online'

export function OfflineBanner() {
  const online = useOnline()
  return (
    <div aria-atomic="true" aria-live="polite" role="status">
      {online ? null : (
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t bg-muted px-4 py-2 text-sm text-muted-foreground">
          <WifiOff aria-hidden className="size-4" />
          <span>You are offline. Changes cannot be saved until you reconnect.</span>
        </div>
      )}
    </div>
  )
}
