import type { KeyboardEvent } from 'react'

import { useCallback, useMemo, useRef, useState } from 'react'

type Options = { columns?: number; loop?: boolean }

export function useRovingTabindex(count: number, options: Options = {}) {
  const { columns = 1, loop = false } = options
  const [requested, setActive] = useState(0)
  const elements = useRef(new Map<number, HTMLElement>())
  const activeIndex = Math.min(requested, Math.max(0, count - 1))

  const focusIndex = useCallback(
    (index: number) => {
      if (count === 0) {
        return
      }
      const bounded = loop ? (index + count) % count : Math.min(Math.max(index, 0), count - 1)
      setActive(bounded)
      elements.current.get(bounded)?.focus()
    },
    [count, loop],
  )

  const getItemProps = useCallback(
    (index: number) => ({
      onFocus: () => {
        setActive(index)
      },
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) {
          return
        }
        const moves: Record<string, number | undefined> = {
          ArrowDown: index + columns,
          ArrowLeft: index - 1,
          ArrowRight: index + 1,
          ArrowUp: index - columns,
          End: count - 1,
          Home: 0,
        }
        const target = moves[event.key]
        if (target !== undefined) {
          event.preventDefault()
          focusIndex(target)
        }
      },
      ref: (element: HTMLElement | null) => {
        if (element) {
          elements.current.set(index, element)
        } else {
          elements.current.delete(index)
        }
      },
      tabIndex: index === activeIndex ? 0 : -1,
    }),
    [activeIndex, columns, count, focusIndex],
  )

  return useMemo(() => ({ activeIndex, focusIndex, getItemProps }), [activeIndex, focusIndex, getItemProps])
}
