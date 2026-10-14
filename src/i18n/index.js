import i18n from 'i18next';
import moment from 'moment';
import 'moment/locale/fr';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const LANG_KEY = 'fayos.lang';

function initialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, fr: { translation: fr } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

moment.locale(i18n.language);

i18n.on('languageChanged', (lng) => {
  moment.locale(lng);
  try {
    localStorage.setItem(LANG_KEY, lng);
  } catch {
    /* storage unavailable */
  }
  document.documentElement.lang = lng;
});

export default i18n;
