import { fireEvent } from '@testing-library/react'

export type KeyModifiers = { alt?: boolean; ctrl?: boolean; meta?: boolean; shift?: boolean }

export class TestKeyboard {
  /**
   * @route client.testSupport.testKeyboard.press
   * @param {string} key
   * @param {KeyModifiers} modifiers
   * @param {Element | Document} target Defaults to `document.body`.
   * @returns {boolean} False when a handler called preventDefault.
   */
  static press(
    key: string,
    modifiers: KeyModifiers = {},
    target: Document | Element = document.body,
  ): boolean {
    return fireEvent.keyDown(target, {
      altKey: modifiers.alt === true,
      ctrlKey: modifiers.ctrl === true,
      key,
      metaKey: modifiers.meta === true,
      shiftKey: modifiers.shift === true,
    })
  }
}
