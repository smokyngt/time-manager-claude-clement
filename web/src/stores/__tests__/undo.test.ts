import { beforeEach, describe, expect, it, vi } from 'vitest'

import { UNDO_HISTORY_LIMIT, useUndoStore } from '@/stores/undo'

function entry(label: string) {
  return { label, redo: vi.fn(), undo: vi.fn() }
}

describe('useUndoStore', () => {
  beforeEach(() => {
    useUndoStore.getState().clear()
  })

  it('pushes onto the past and drops the redo stack', () => {
    useUndoStore.getState().pushRedo(entry('r'))
    useUndoStore.getState().push(entry('a'))
    expect(useUndoStore.getState().past.map((item) => item.label)).toEqual(['a'])
    expect(useUndoStore.getState().future).toEqual([])
  })

  it('pops the latest entry first', () => {
    useUndoStore.getState().push(entry('a'))
    useUndoStore.getState().push(entry('b'))
    expect(useUndoStore.getState().popUndo()?.label).toBe('b')
    expect(useUndoStore.getState().popUndo()?.label).toBe('a')
    expect(useUndoStore.getState().popUndo()).toBeUndefined()
  })

  it('moves entries between past and future', () => {
    const first = entry('a')
    useUndoStore.getState().pushRedo(first)
    expect(useUndoStore.getState().popRedo()).toBe(first)
    useUndoStore.getState().pushPast(first)
    expect(useUndoStore.getState().past).toEqual([first])
  })

  it('bounds the history', () => {
    for (let index = 0; index < UNDO_HISTORY_LIMIT + 5; index += 1) {
      useUndoStore.getState().push(entry(String(index)))
    }
    expect(useUndoStore.getState().past).toHaveLength(UNDO_HISTORY_LIMIT)
    expect(useUndoStore.getState().past[0]?.label).toBe('5')
  })
})
