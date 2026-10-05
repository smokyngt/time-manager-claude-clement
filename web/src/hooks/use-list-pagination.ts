import { useCallback, useMemo, useState } from 'react'

import { LIMITS } from '@/config/limits'

export function useListPagination(total: number, pageSize: number = LIMITS.pageSize.default) {
  const [requested, setRequested] = useState(1)
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, requested), pages)

  const setPage = useCallback((next: number) => {
    setRequested(Math.max(1, Math.floor(next)))
  }, [])
  const next = useCallback(() => {
    setRequested(page + 1)
  }, [page])
  const previous = useCallback(() => {
    setRequested(Math.max(1, page - 1))
  }, [page])
  const reset = useCallback(() => {
    setRequested(1)
  }, [])

  return useMemo(
    () => ({
      hasNext: page < pages,
      hasPrevious: page > 1,
      limit: pageSize,
      next,
      page,
      pages,
      previous,
      reset,
      setPage,
      skip: (page - 1) * pageSize,
      total,
    }),
    [next, page, pageSize, pages, previous, reset, setPage, total],
  )
}
