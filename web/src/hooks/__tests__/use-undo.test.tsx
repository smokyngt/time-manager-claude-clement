import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ToastActions } from '@/providers/use-toast-actions'

import { useUndo } from '@/hooks/use-undo'
import { useUndoStore } from '@/stores/undo'
import { TestClock } from '@/test-support/test-clock'
import { TestKeyboard } from '@/test-support/test-keyboard'
import { TestToast } from '@/test-support/test-toast'

vi.mock('react-i18next', async () => (await import('@/test-support/test-i18n')).TestI18n.module())

describe('useUndo', () => {
  let toasts: ToastActions

  beforeEach(() => {
    TestClock.install()
    useUndoStore.getState().clear()
    toasts = TestToast.actions()
  })

  afterEach(() => {
    TestClock.restore()
  })

  function setup() {
    return renderHook(() => useUndo(), { wrapper: TestToast.wrapper(toasts) })
  }

  describe('deferAction', () => {
    it('commits after the delay and shows an undo toast', async () => {
      const { result } = setup()
      const onCommit = vi.fn()
      const onUndo = vi.fn()
      act(() => {
        result.current.deferAction({ message: 'Deleted', onCommit, onUndo })
      })
      expect(toasts.showUndo).toHaveBeenCalledWith(
        'Deleted',
        expect.any(Function),
        expect.any(Object),
      )
      await act(async () => {
        await TestClock.advance(5999)
      })
      expect(onCommit).not.toHaveBeenCalled()
      await act(async () => {
        await TestClock.advance(1)
      })
      expect(onCommit).toHaveBeenCalledTimes(1)
      expect(onUndo).not.toHaveBeenCalled()
    })

    it('cancels the commit when the toast action is used', async () => {
      const { result } = setup()
      const onCommit = vi.fn()
      const onUndo = vi.fn()
      act(() => {
        result.current.deferAction({ message: 'Deleted', onCommit, onUndo })
      })
      const undoToast = vi.mocked(toasts.showUndo).mock.calls[0]?.[1]
      act(() => {
        undoToast?.()
      })
      await act(async () => {
        await TestClock.advance(10_000)
      })
      expect(onUndo).toHaveBeenCalledTimes(1)
      expect(onCommit).not.toHaveBeenCalled()
    })

    it('commits immediately when flushed', () => {
      const { result } = setup()
      const onCommit = vi.fn()
      let flush: () => void = () => undefined
      act(() => {
        flush = result.current.deferAction({ message: 'Deleted', onCommit, onUndo: vi.fn() })
      })
      flush()
      flush()
      expect(onCommit).toHaveBeenCalledTimes(1)
    })
  })

  describe('history', () => {
    it('undoes then redoes the latest entry', async () => {
      const { result } = setup()
      const undo = vi.fn()
      const redo = vi.fn()
      act(() => {
        result.current.push({ label: 'Created', redo, undo })
      })
      expect(result.current.canUndo).toBe(true)
      await act(async () => {
        await result.current.undo()
      })
      expect(undo).toHaveBeenCalledTimes(1)
      expect(result.current.canRedo).toBe(true)
      expect(toasts.showInfo).toHaveBeenCalledWith('undo.undone', 'Created')
      await act(async () => {
        await result.current.redo()
      })
      expect(redo).toHaveBeenCalledTimes(1)
      expect(result.current.canUndo).toBe(true)
    })

    it('does nothing when the history is empty', async () => {
      const { result } = setup()
      let done = true
      await act(async () => {
        done = await result.current.undo()
      })
      expect(done).toBe(false)
    })

    it('binds Ctrl+Z and Ctrl+Shift+Z', async () => {
      const { result } = setup()
      const undo = vi.fn()
      const redo = vi.fn()
      act(() => {
        result.current.push({ label: 'x', redo, undo })
      })
      await act(async () => {
        TestKeyboard.press('z', { ctrl: true })
        await Promise.resolve()
      })
      expect(undo).toHaveBeenCalledTimes(1)
      await act(async () => {
        TestKeyboard.press('z', { ctrl: true, shift: true })
        await Promise.resolve()
      })
      expect(redo).toHaveBeenCalledTimes(1)
    })

    it('ignores the shortcut while typing', async () => {
      const { result } = setup()
      const undo = vi.fn()
      act(() => {
        result.current.push({ label: 'x', redo: vi.fn(), undo })
      })
      const input = document.createElement('input')
      document.body.append(input)
      await act(async () => {
        TestKeyboard.press('z', { ctrl: true }, input)
        await Promise.resolve()
      })
      input.remove()
      expect(undo).not.toHaveBeenCalled()
    })

    it('undoes once when several components use the hook', async () => {
      const first = setup()
      setup()
      const undo = vi.fn()
      act(() => {
        first.result.current.push({ label: 'x', redo: vi.fn(), undo })
      })
      await act(async () => {
        TestKeyboard.press('z', { ctrl: true })
        await Promise.resolve()
      })
      expect(undo).toHaveBeenCalledTimes(1)
    })
  })
})
