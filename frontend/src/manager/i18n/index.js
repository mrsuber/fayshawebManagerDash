import { createInstance } from 'i18next';
import moment from 'moment';
import 'moment/locale/fr';
import en from './locales/en.json';
import fr from './locales/fr.json';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
];

const LANG_KEY = 'fayos.lang';

function initialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_KEY) || localStorage.getItem('i18nextLng');
    const code = saved && saved.slice(0, 2);
    if (code && LANGUAGES.some((l) => l.code === code)) return code;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

/**
 * The dashboard's own i18next instance, handed to components by ManagerApp's <I18nextProvider>.
 * It deliberately skips initReactI18next, which would replace the site's global instance
 * (src/i18n/config.js) for every other page.
 */
const i18n = createInstance();

i18n.init({
  react: { useSuspense: false },
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
});

export default i18n;
