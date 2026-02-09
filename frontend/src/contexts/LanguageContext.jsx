import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem('language') || DEFAULT_LANGUAGE;
  });

  useEffect(() => {
    i18n.changeLanguage(currentLanguage);
    localStorage.setItem('language', currentLanguage);
  }, [currentLanguage, i18n]);

  const changeLanguage = (langCode) => {
    if (SUPPORTED_LANGUAGES.some(lang => lang.code === langCode)) {
      setCurrentLanguage(langCode);
    }
  };

  const value = {
    currentLanguage,
    changeLanguage,
    supportedLanguages: SUPPORTED_LANGUAGES,
    t: i18n.t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export default LanguageContext;
