import { useCallback, useMemo, useState } from 'react'

export function useCursorPagination() {
  const [cursors, setCursors] = useState<string[]>([])

  const cursor = cursors.at(-1)

  const next = useCallback((nextCursor: null | string | undefined) => {
    if (nextCursor) {
      setCursors((current) => [...current, nextCursor])
    }
  }, [])
  const previous = useCallback(() => {
    setCursors((current) => current.slice(0, -1))
  }, [])
  const reset = useCallback(() => {
    setCursors((current) => (current.length === 0 ? current : []))
  }, [])

  return useMemo(
    () => ({
      cursor,
      hasPrevious: cursors.length > 0,
      next,
      page: cursors.length + 1,
      previous,
      reset,
    }),
    [cursor, cursors.length, next, previous, reset],
  )
}
