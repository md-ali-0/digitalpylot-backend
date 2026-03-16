import i18next from './i18n';

// Create a compatibility layer for the old i18n package
const i18n = {
  __: (key: string, options?: any): string => {
    return i18next.t(key, options) as string;
  },
  t: (key: string, options?: any): string => {
    return i18next.t(key, options) as string;
  },
};

export default i18n;
