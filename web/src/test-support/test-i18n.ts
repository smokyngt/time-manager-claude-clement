import { vi } from 'vitest'

export class TestI18n {
  /**
   * @route client.testSupport.testI18n.module
   * @returns {Record<string, unknown>} Factory result for `vi.mock('react-i18next', ...)`: `t(key)` returns the key.
   */
  static module() {
    const i18n = {
      changeLanguage: vi.fn(() => Promise.resolve()),
      language: 'en',
      resolvedLanguage: 'en',
    }
    const t = (key: string) => key
    return {
      I18nextProvider: ({ children }: { children: unknown }) => children,
      initReactI18next: { init: () => undefined, type: '3rdParty' },
      Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
      useTranslation: () => ({ i18n, t }),
    }
  }
}
