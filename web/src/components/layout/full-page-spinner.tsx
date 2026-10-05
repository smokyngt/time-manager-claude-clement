import { Loader2Icon } from 'lucide-react'

export function FullPageSpinner() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <Loader2Icon aria-hidden className="size-6 animate-spin text-primary" />
      <span className="sr-only">Loading</span>
    </div>
  )
}
