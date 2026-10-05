import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAuth from '@/locales/en/auth.json'
import enClocks from '@/locales/en/clocks.json'
import enCommon from '@/locales/en/common.json'
import enDashboard from '@/locales/en/dashboard.json'
import enErrors from '@/locales/en/errors.json'
import enNav from '@/locales/en/nav.json'
import enProfile from '@/locales/en/profile.json'
import enReports from '@/locales/en/reports.json'
import enTeams from '@/locales/en/teams.json'
import enUsers from '@/locales/en/users.json'
import frAuth from '@/locales/fr/auth.json'
import frClocks from '@/locales/fr/clocks.json'
import frCommon from '@/locales/fr/common.json'
import frDashboard from '@/locales/fr/dashboard.json'
import frErrors from '@/locales/fr/errors.json'
import frNav from '@/locales/fr/nav.json'
import frProfile from '@/locales/fr/profile.json'
import frReports from '@/locales/fr/reports.json'
import frTeams from '@/locales/fr/teams.json'
import frUsers from '@/locales/fr/users.json'

export const LANGUAGES = ['en', 'fr'] as const

export type Language = (typeof LANGUAGES)[number]

export const NAMESPACES = [
  'common',
  'errors',
  'auth',
  'dashboard',
  'clocks',
  'teams',
  'users',
  'profile',
  'reports',
  'nav',
] as const

export const LANGUAGE_STORAGE_KEY = 'tm-language'

export const resources = {
  en: {
    auth: enAuth,
    clocks: enClocks,
    common: enCommon,
    dashboard: enDashboard,
    errors: enErrors,
    nav: enNav,
    profile: enProfile,
    reports: enReports,
    teams: enTeams,
    users: enUsers,
  },
  fr: {
    auth: frAuth,
    clocks: frClocks,
    common: frCommon,
    dashboard: frDashboard,
    errors: frErrors,
    nav: frNav,
    profile: frProfile,
    reports: frReports,
    teams: frTeams,
    users: frUsers,
  },
} as const

export const i18n = i18next.createInstance()

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    defaultNS: 'common',
    detection: {
      caches: ['localStorage'],
      convertDetectedLanguage: (language: string) => language.split('-')[0] ?? 'en',
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      order: ['localStorage', 'navigator'],
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    ns: [...NAMESPACES],
    resources,
    returnNull: false,
    supportedLngs: [...LANGUAGES],
  })

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && LANGUAGES.some((language) => language === value)
}
