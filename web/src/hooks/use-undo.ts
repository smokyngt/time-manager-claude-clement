import { useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { UndoEntry } from '@/stores/undo'

import { Keyboard } from '@/hooks/use-shortcuts'
import { useToastActions } from '@/providers/use-toast-actions'
import { useUndoStore } from '@/stores/undo'

export type DeferredAction = {
  delay?: number
  message: string
  onCommit: () => Promise<void> | void
  onUndo: () => Promise<void> | void
}

const DEFAULT_DELAY_MS = 6000

const pending = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    pending.forEach((flush) => {
      flush()
    })
  })
}

export function useUndo() {
  const { t } = useTranslation('common')
  const toasts = useToastActions()
  const canUndo = useUndoStore((state) => state.past.length > 0)
  const canRedo = useUndoStore((state) => state.future.length > 0)

  const deferAction = useCallback(
    (action: DeferredAction) => {
      let settled = false
      let toastId: number | string | undefined
      const commit = () => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        pending.delete(commit)
        if (toastId !== undefined) {
          toasts.dismiss(toastId)
        }
        void action.onCommit()
      }
      const timer = setTimeout(commit, action.delay ?? DEFAULT_DELAY_MS)
      pending.add(commit)
      toastId = toasts.showUndo(
        action.message,
        () => {
          if (settled) {
            return
          }
          settled = true
          clearTimeout(timer)
          pending.delete(commit)
          void action.onUndo()
        },
        { duration: action.delay ?? DEFAULT_DELAY_MS },
      )
      return commit
    },
    [toasts],
  )

  const push = useCallback((entry: UndoEntry) => {
    useUndoStore.getState().push(entry)
  }, [])

  const undo = useCallback(async () => {
    const entry = useUndoStore.getState().popUndo()
    if (!entry) {
      return false
    }
    await entry.undo()
    useUndoStore.getState().pushRedo(entry)
    toasts.showInfo(t('undo.undone'), entry.label)
    return true
  }, [t, toasts])

  const redo = useCallback(async () => {
    const entry = useUndoStore.getState().popRedo()
    if (!entry) {
      return false
    }
    await entry.redo()
    useUndoStore.getState().pushPast(entry)
    toasts.showInfo(t('undo.redone'), entry.label)
    return true
  }, [t, toasts])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.key.toLowerCase() !== 'z' ||
        !(event.ctrlKey || event.metaKey) ||
        Keyboard.isTyping(event.target)
      ) {
        return
      }
      event.preventDefault()
      void (event.shiftKey ? redo() : undo())
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [redo, undo])

  return useMemo(
    () => ({ canRedo, canUndo, deferAction, push, redo, undo }),
    [canRedo, canUndo, deferAction, push, redo, undo],
  )
}
