import { useEffect, useState } from 'react'

function matches(query: string) {
  return typeof matchMedia === 'function' && matchMedia(query).matches
}

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(() => matches(query))

  useEffect(() => {
    if (typeof matchMedia !== 'function') {
      return
    }
    const media = matchMedia(query)
    const listener = (event: MediaQueryListEvent) => {
      setValue(event.matches)
    }
    setValue(media.matches)
    media.addEventListener('change', listener)
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [query])

  return value
}
