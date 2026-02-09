import { useTranslation as useReactI18NextTranslation } from 'react-i18next';
import { useLanguage } from '../contexts/LanguageContext';

export function useTranslation() {
  const { t: tFromContext } = useLanguage();
  const { t: tFromI18Next, i18n } = useReactI18NextTranslation();

  // 优先使用 context 的 t 函数，它已经处理了语言切换
  return {
    t: tFromContext || tFromI18Next,
    i18n
  };
}

export default useTranslation;
