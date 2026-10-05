import { WifiOff } from 'lucide-react'

import { useOnline } from '@/lib/pwa/use-online'

export function OfflineBanner() {
  const online = useOnline()
  return (
    <div aria-atomic="true" aria-live="polite" role="status">
      {online ? null : (
        <div className="bg-muted text-muted-foreground fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t px-4 py-2 text-sm">
          <WifiOff aria-hidden className="size-4" />
          <span>You are offline. Changes cannot be saved until you reconnect.</span>
        </div>
      )}
    </div>
  )
}
