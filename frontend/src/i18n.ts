import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationRU from './locales/ru/translation.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            ru: {
                translation: translationRU,
            },
        },
        lng: 'ru', // Force Russian for this specific app
        fallbackLng: 'ru',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
