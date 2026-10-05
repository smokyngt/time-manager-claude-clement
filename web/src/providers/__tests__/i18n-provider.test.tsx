import { act, render, screen } from '@testing-library/react'
import { useTranslation } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'
import { I18nProvider } from '@/providers/i18n-provider'
import { usePreferencesStore } from '@/stores/preferences'

function Label() {
  const { t } = useTranslation('common')
  return <p>{t('actions.save')}</p>
}

describe('I18nProvider', () => {
  afterEach(async () => {
    await i18n.changeLanguage('en')
    usePreferencesStore.setState({ language: null })
  })

  it('translates children and follows language changes', async () => {
    render(
      <I18nProvider>
        <Label />
      </I18nProvider>,
    )
    expect(screen.getByText('Save')).toBeInTheDocument()
    await act(async () => {
      await i18n.changeLanguage('fr')
    })
    expect(screen.getByText('Enregistrer')).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('fr')
  })

  it('stores the language in the preferences', async () => {
    render(
      <I18nProvider>
        <Label />
      </I18nProvider>,
    )
    await act(async () => {
      await i18n.changeLanguage('fr')
    })
    expect(usePreferencesStore.getState().language).toBe('fr')
  })

  it('restores the stored language on mount', async () => {
    usePreferencesStore.setState({ language: 'fr' })
    render(
      <I18nProvider>
        <Label />
      </I18nProvider>,
    )
    expect(await screen.findByText('Enregistrer')).toBeInTheDocument()
  })
})
