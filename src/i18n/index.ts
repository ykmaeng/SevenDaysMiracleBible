import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ko from "./locales/ko.json";
import en from "./locales/en.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";
import ja from "./locales/ja.json";
import de from "./locales/de.json";
import fr from "./locales/fr.json";
import ru from "./locales/ru.json";
import pt from "./locales/pt.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
      zh: { translation: zh },
      es: { translation: es },
      ja: { translation: ja },
      de: { translation: de },
      fr: { translation: fr },
      ru: { translation: ru },
      pt: { translation: pt },
    },
    fallbackLng: "ko",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
