import { fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { useRovingTabindex } from '@/hooks/use-roving-tabindex'
import {
  Keyboard,
  useClearSelectionShortcut,
  useDeleteShortcut,
  useSearchHotkey,
  useSelectAllShortcut,
} from '@/hooks/use-shortcuts'
import { TestKeyboard } from '@/test-support/test-keyboard'

function Grid({ columns = 1, count = 4 }: { columns?: number; count?: number }) {
  const { getItemProps } = useRovingTabindex(count, { columns })
  return (
    <div>
      {Array.from({ length: count }, (_, index) => (
        <button key={index} type="button" {...getItemProps(index)}>
          item-{index}
        </button>
      ))}
    </div>
  )
}

describe('useRovingTabindex', () => {
  it('keeps one tab stop', () => {
    render(<Grid />)
    const tabIndexes = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('tabindex'))
    expect(tabIndexes).toEqual(['0', '-1', '-1', '-1'])
  })

  it('moves focus with arrows, Home and End', () => {
    render(<Grid />)
    const [first, second, , last] = screen.getAllByRole('button')
    first?.focus()
    fireEvent.keyDown(first as HTMLElement, { key: 'ArrowDown' })
    expect(second).toHaveFocus()
    expect(second).toHaveAttribute('tabindex', '0')
    fireEvent.keyDown(second as HTMLElement, { key: 'End' })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last as HTMLElement, { key: 'ArrowDown' })
    expect(last).toHaveFocus()
    fireEvent.keyDown(last as HTMLElement, { key: 'Home' })
    expect(first).toHaveFocus()
  })

  it('moves by column in grids', () => {
    render(<Grid columns={2} />)
    const buttons = screen.getAllByRole('button')
    buttons[0]?.focus()
    fireEvent.keyDown(buttons[0] as HTMLElement, { key: 'ArrowDown' })
    expect(buttons[2]).toHaveFocus()
    fireEvent.keyDown(buttons[2] as HTMLElement, { key: 'ArrowRight' })
    expect(buttons[3]).toHaveFocus()
  })
})

describe('Keyboard.isTyping', () => {
  it('detects editable targets', () => {
    expect(Keyboard.isTyping(document.createElement('input'))).toBe(true)
    expect(Keyboard.isTyping(document.createElement('textarea'))).toBe(true)
    expect(Keyboard.isTyping(document.createElement('div'))).toBe(false)
    expect(Keyboard.isTyping(null)).toBe(false)
  })
})

describe('shortcuts', () => {
  it('Delete and Backspace trigger onDelete outside inputs', () => {
    const onDelete = vi.fn()
    renderHook(() => useDeleteShortcut(onDelete))
    TestKeyboard.press('Delete')
    TestKeyboard.press('Backspace')
    expect(onDelete).toHaveBeenCalledTimes(2)
    const input = document.createElement('input')
    document.body.append(input)
    TestKeyboard.press('Delete', {}, input)
    expect(onDelete).toHaveBeenCalledTimes(2)
    input.remove()
  })

  it('can be disabled', () => {
    const onDelete = vi.fn()
    renderHook(() => useDeleteShortcut(onDelete, false))
    TestKeyboard.press('Delete')
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('Ctrl/Cmd+A selects all', () => {
    const onSelectAll = vi.fn()
    renderHook(() => useSelectAllShortcut(onSelectAll))
    TestKeyboard.press('a')
    expect(onSelectAll).not.toHaveBeenCalled()
    TestKeyboard.press('a', { ctrl: true })
    TestKeyboard.press('a', { meta: true })
    expect(onSelectAll).toHaveBeenCalledTimes(2)
  })

  it('Escape clears the selection', () => {
    const onClear = vi.fn()
    renderHook(() => useClearSelectionShortcut(onClear))
    TestKeyboard.press('Escape')
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('slash and Ctrl+K focus the search input', () => {
    function Search() {
      const ref = useRef<HTMLInputElement>(null)
      useSearchHotkey(ref)
      return <input aria-label="search" ref={ref} />
    }
    render(<Search />)
    const input = screen.getByLabelText('search')
    TestKeyboard.press('/')
    expect(input).toHaveFocus()
    ;(input as HTMLInputElement).blur()
    TestKeyboard.press('k', { ctrl: true })
    expect(input).toHaveFocus()
  })
})
