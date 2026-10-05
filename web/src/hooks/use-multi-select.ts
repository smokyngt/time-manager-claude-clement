import { useCallback, useMemo, useState } from 'react'

export function useMultiSelect() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: readonly string[]) => {
    setSelected(new Set(ids))
  }, [])

  const clear = useCallback(() => {
    setSelected((current) => (current.size === 0 ? current : new Set()))
  }, [])

  const prune = useCallback((visibleIds: readonly string[]) => {
    setSelected((current) => {
      const visible = new Set(visibleIds)
      const next = new Set([...current].filter((id) => visible.has(id)))
      return next.size === current.size ? current : next
    })
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  return useMemo(
    () => ({
      clear,
      count: selected.size,
      ids: [...selected],
      isSelected,
      prune,
      selectAll,
      selected,
      toggle,
    }),
    [clear, isSelected, prune, selectAll, selected, toggle],
  )
}
