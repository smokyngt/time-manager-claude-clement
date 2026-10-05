import { create } from 'zustand'

export type UndoEntry = {
  label: string
  redo: () => Promise<void> | void
  undo: () => Promise<void> | void
}

export type UndoState = {
  clear: () => void
  future: UndoEntry[]
  past: UndoEntry[]
  popRedo: () => undefined | UndoEntry
  popUndo: () => undefined | UndoEntry
  push: (entry: UndoEntry) => void
  pushPast: (entry: UndoEntry) => void
  pushRedo: (entry: UndoEntry) => void
}

export const UNDO_HISTORY_LIMIT = 50

export const useUndoStore = create<UndoState>()((set, get) => ({
  clear: () => {
    set({ future: [], past: [] })
  },
  future: [],
  past: [],
  popRedo: () => {
    const entry = get().future.at(-1)
    if (entry) {
      set((state) => ({ future: state.future.slice(0, -1) }))
    }
    return entry
  },
  popUndo: () => {
    const entry = get().past.at(-1)
    if (entry) {
      set((state) => ({ past: state.past.slice(0, -1) }))
    }
    return entry
  },
  push: (entry) => {
    set((state) => ({ future: [], past: [...state.past, entry].slice(-UNDO_HISTORY_LIMIT) }))
  },
  pushPast: (entry) => {
    set((state) => ({ past: [...state.past, entry].slice(-UNDO_HISTORY_LIMIT) }))
  },
  pushRedo: (entry) => {
    set((state) => ({ future: [...state.future, entry].slice(-UNDO_HISTORY_LIMIT) }))
  },
}))
