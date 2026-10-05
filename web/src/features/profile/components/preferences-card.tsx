import { useTranslation } from 'react-i18next'

import type { Theme } from '@/stores/preferences'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isLanguage, LANGUAGES } from '@/lib/i18n'
import { usePreferencesStore } from '@/stores/preferences'

const THEMES: Theme[] = ['light', 'dark', 'system']

export function PreferencesCard() {
  const { i18n, t } = useTranslation('profile')
  const { t: tCommon } = useTranslation('common')
  const theme = usePreferencesStore((state) => state.theme)
  const setTheme = usePreferencesStore((state) => state.setTheme)
  const current = i18n.resolvedLanguage ?? i18n.language

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('preferences.title')}</CardTitle>
        <CardDescription>{t('preferences.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div aria-labelledby="pref-language" className="space-y-2" role="group">
          <p className="text-sm font-medium" id="pref-language">
            {t('preferences.language')}
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((language) => (
              <Button
                aria-pressed={current === language}
                key={language}
                onClick={() => {
                  if (isLanguage(language)) {
                    void i18n.changeLanguage(language)
                  }
                }}
                size="sm"
                variant={current === language ? 'default' : 'outline'}
              >
                {tCommon(`language.${language}`)}
              </Button>
            ))}
          </div>
        </div>
        <div aria-labelledby="pref-theme" className="space-y-2" role="group">
          <p className="text-sm font-medium" id="pref-theme">
            {t('preferences.theme')}
          </p>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((option) => (
              <Button
                aria-pressed={theme === option}
                key={option}
                onClick={() => {
                  setTheme(option)
                }}
                size="sm"
                variant={theme === option ? 'default' : 'outline'}
              >
                {t(`preferences.themes.${option}`)}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
