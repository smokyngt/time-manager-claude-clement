import type { ReactNode } from 'react'

import { useEffect } from 'react'
import { I18nextProvider } from 'react-i18next'

import { i18n, isLanguage } from '@/lib/i18n'
import { usePreferencesStore } from '@/stores/preferences'

function syncDocument(language: string) {
  document.documentElement.lang = language
}

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const stored = usePreferencesStore.getState().language
    if (stored !== null && stored !== i18n.resolvedLanguage) {
      void i18n.changeLanguage(stored)
    }
    syncDocument(i18n.resolvedLanguage ?? i18n.language)

    const onChange = (language: string) => {
      syncDocument(language)
      if (isLanguage(language)) {
        usePreferencesStore.getState().setLanguage(language)
      }
    }
    i18n.on('languageChanged', onChange)
    return () => {
      i18n.off('languageChanged', onChange)
    }
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
