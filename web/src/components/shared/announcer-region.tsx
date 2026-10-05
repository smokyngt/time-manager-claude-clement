import { useEffect, useState } from 'react'

import { Announcer } from '@/components/shared/announcer'

export function AnnouncerRegion() {
  const [message, setMessage] = useState('')

  useEffect(
    () =>
      Announcer.subscribe((next) => {
        setMessage('')
        requestAnimationFrame(() => {
          setMessage(next)
        })
      }),
    [],
  )

  return (
    <div aria-atomic aria-live="polite" className="sr-only" role="status">
      {message}
    </div>
  )
}
