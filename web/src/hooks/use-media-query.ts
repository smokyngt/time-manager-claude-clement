import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof matchMedia !== 'function') {
        return () => undefined
      }
      const media = matchMedia(query)
      media.addEventListener('change', onChange)
      return () => {
        media.removeEventListener('change', onChange)
      }
    },
    [query],
  )
  const getSnapshot = useCallback(
    () => typeof matchMedia === 'function' && matchMedia(query).matches,
    [query],
  )

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
