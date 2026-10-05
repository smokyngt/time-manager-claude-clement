import { useEffect, useState } from 'react'

export const DEFAULT_DEBOUNCE_MS = 300

export function useDebouncedValue<T>(value: T, delay: number = DEFAULT_DEBOUNCE_MS) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value)
    }, delay)
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debounced
}
