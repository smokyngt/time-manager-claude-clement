import type { QueryKey } from '@tanstack/react-query'

import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'

type Page<T> = { items: T[]; total: number }

export type CacheSnapshot = [QueryKey, unknown][]

export function useOptimisticCache<T extends { id: string }>(queryKey: QueryKey) {
  const queryClient = useQueryClient()

  const snapshot = useCallback(async (): Promise<CacheSnapshot> => {
    await queryClient.cancelQueries({ queryKey })
    return queryClient.getQueriesData({ queryKey })
  }, [queryClient, queryKey])

  const remove = useCallback(
    async (ids: readonly string[]): Promise<CacheSnapshot> => {
      const previous = await snapshot()
      const removed = new Set(ids)
      queryClient.setQueriesData<Page<T>>({ queryKey }, (data) => {
        if (!data || !Array.isArray(data.items)) {
          return data
        }
        const items = data.items.filter((item) => !removed.has(item.id))
        return {
          ...data,
          items,
          total: Math.max(0, data.total - (data.items.length - items.length)),
        }
      })
      return previous
    },
    [queryClient, queryKey, snapshot],
  )

  const patch = useCallback(
    async (ids: readonly string[], changes: Partial<T>): Promise<CacheSnapshot> => {
      const previous = await snapshot()
      const targets = new Set(ids)
      queryClient.setQueriesData<Page<T>>({ queryKey }, (data) => {
        if (!data || !Array.isArray(data.items)) {
          return data
        }
        return {
          ...data,
          items: data.items.map((item) => (targets.has(item.id) ? { ...item, ...changes } : item)),
        }
      })
      return previous
    },
    [queryClient, queryKey, snapshot],
  )

  const restore = useCallback(
    (previous: CacheSnapshot) => {
      previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    [queryClient],
  )

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey })
  }, [queryClient, queryKey])

  return useMemo(
    () => ({ invalidate, patch, remove, restore, snapshot }),
    [invalidate, patch, remove, restore, snapshot],
  )
}
