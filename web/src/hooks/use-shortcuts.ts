import type { RefObject } from 'react'

import { useEffect } from 'react'

export class Keyboard {
  /**
   * @route client.hooks.keyboard.isTyping
   * @param {EventTarget | null} target
   * @returns {boolean} True inside inputs, textareas, selects and editable content.
   */
  static isTyping(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false
    }
    return (
      target.isContentEditable ||
      ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName) ||
      target.getAttribute('role') === 'textbox'
    )
  }
}

function useKeydown(handler: (event: KeyboardEvent) => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      return
    }
    document.addEventListener('keydown', handler)
    return () => {
      document.removeEventListener('keydown', handler)
    }
  }, [enabled, handler])
}

export function useDeleteShortcut(onDelete: () => void, enabled = true) {
  useKeydown((event) => {
    if ((event.key === 'Delete' || event.key === 'Backspace') && !Keyboard.isTyping(event.target)) {
      event.preventDefault()
      onDelete()
    }
  }, enabled)
}

export function useSelectAllShortcut(onSelectAll: () => void, enabled = true) {
  useKeydown((event) => {
    if (
      event.key.toLowerCase() === 'a' &&
      (event.ctrlKey || event.metaKey) &&
      !Keyboard.isTyping(event.target)
    ) {
      event.preventDefault()
      onSelectAll()
    }
  }, enabled)
}

export function useClearSelectionShortcut(onClear: () => void, enabled = true) {
  useKeydown((event) => {
    if (event.key === 'Escape' && !Keyboard.isTyping(event.target)) {
      onClear()
    }
  }, enabled)
}

export function useSearchHotkey(inputRef: RefObject<HTMLInputElement | null>, enabled = true) {
  useKeydown((event) => {
    const slash = event.key === '/' && !Keyboard.isTyping(event.target)
    const palette = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey)
    if (slash || palette) {
      event.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, enabled)
}
