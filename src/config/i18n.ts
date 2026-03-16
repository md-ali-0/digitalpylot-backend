import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import middleware from 'i18next-http-middleware';
import path from 'path';

// Get the correct path to locales directory
// In development: /path/to/project/locales
// In production: /path/to/project/locales (same, because locales is in root)
const localesPath = path.join(process.cwd(), 'locales', '{{lng}}', '{{ns}}.json');

// Initialize i18next synchronously
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    lng: 'en', // Set default language explicitly
    preload: ['en', 'es', 'bn', 'sv', 'fr', 'de', 'ar', 'hi'], // Preload all supported languages
    ns: ['common', 'errors'], // Namespaces for translation files
    defaultNS: 'common',
    backend: {
      loadPath: localesPath,
    },
    detection: {
      order: ['querystring', 'header', 'cookie'],
      caches: ['cookie'],
    },
    debug: false, // Set to true for debugging i18next
    initImmediate: false, // Don't defer initialization
    returnEmptyString: false, // Return key if translation is empty
    returnNull: false, // Return key if translation is null
  });

export default i18next;
