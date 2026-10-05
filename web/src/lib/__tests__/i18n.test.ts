import { describe, expect, it } from 'vitest'

import { i18n, isLanguage, LANGUAGES, NAMESPACES } from '@/lib/i18n'

describe('i18n', () => {
  it('registers en and fr with every namespace', () => {
    expect([...LANGUAGES]).toEqual(['en', 'fr'])
    NAMESPACES.forEach((namespace) => {
      expect(i18n.hasResourceBundle('en', namespace)).toBe(true)
      expect(i18n.hasResourceBundle('fr', namespace)).toBe(true)
    })
  })

  it('translates with namespace prefixes and plurals', async () => {
    await i18n.changeLanguage('en')
    expect(i18n.t('common:actions.save')).toBe('Save')
    expect(i18n.t('common:bulk.selected', { count: 1 })).toBe('1 item selected')
    expect(i18n.t('common:bulk.selected', { count: 3 })).toBe('3 items selected')
    await i18n.changeLanguage('fr')
    expect(i18n.t('common:actions.save')).toBe('Enregistrer')
    await i18n.changeLanguage('en')
  })

  it('persists the language in localStorage', async () => {
    await i18n.changeLanguage('fr')
    expect(localStorage.getItem('tm-language')).toBe('fr')
    await i18n.changeLanguage('en')
  })

  it('validates languages', () => {
    expect(isLanguage('fr')).toBe(true)
    expect(isLanguage('de')).toBe(false)
  })
})
