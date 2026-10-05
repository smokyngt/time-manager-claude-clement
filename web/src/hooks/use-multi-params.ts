import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

type ParamValue = boolean | number | string

type Defaults = Record<string, ParamValue>

function parse(raw: null | string, fallback: ParamValue): ParamValue {
  if (raw === null) {
    return fallback
  }
  if (typeof fallback === 'boolean') {
    return raw === 'true'
  }
  if (typeof fallback === 'number') {
    const value = Number(raw)
    return Number.isFinite(value) ? value : fallback
  }
  return raw
}

export function useMultiParams<T extends Defaults>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams()

  const values = useMemo(() => {
    const entries = Object.entries(defaults).map(([key, fallback]) => [
      key,
      parse(searchParams.get(key), fallback),
    ])
    return Object.fromEntries(entries) as T
  }, [defaults, searchParams])

  const set = useCallback(
    (patch: Partial<T>) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(patch).forEach(([key, value]) => {
            const fallback = defaults[key]
            if (value === undefined || value === fallback || value === '') {
              next.delete(key)
            } else {
              next.set(key, String(value))
            }
          })
          return next
        },
        { replace: true },
      )
    },
    [defaults, setSearchParams],
  )

  const reset = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        Object.keys(defaults).forEach((key) => {
          next.delete(key)
        })
        return next
      },
      { replace: true },
    )
  }, [defaults, setSearchParams])

  return useMemo(() => ({ reset, set, values }), [reset, set, values])
}
