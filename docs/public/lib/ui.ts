import { defineI18nUI } from 'fumadocs-ui/i18n';
import { i18n } from '@/lib/i18n';

export const ui = defineI18nUI(i18n, {
  en: { displayName: 'English' },
  fr: {
    displayName: 'Français',
    search: 'Rechercher',
    searchNoResult: 'Aucun résultat',
    toc: 'Sur cette page',
    tocNoHeadings: 'Aucun titre',
    lastUpdate: 'Dernière mise à jour',
    chooseLanguage: 'Choisir une langue',
    nextPage: 'Page suivante',
    previousPage: 'Page précédente',
    chooseTheme: 'Thème',
    editOnGithub: 'Modifier sur GitHub',
  },
});
