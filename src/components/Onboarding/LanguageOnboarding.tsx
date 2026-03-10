import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, DEFAULT_TRANSLATION_BY_LANG } from "../../stores/settingsStore";
import { useTabStore } from "../../stores/tabStore";

const ONBOARDING_LANGUAGES = [
  { code: "ko", greeting: "안녕하세요", name: "한국어" },
  { code: "en", greeting: "Hello", name: "English" },
];

export function LanguageOnboarding() {
  const { i18n } = useTranslation();
  const { setLanguage, completeOnboarding, setFontFamily } = useSettingsStore();
  const updateTab = useTabStore((s) => s.updateTab);
  const tabs = useTabStore((s) => s.tabs);
  const [pressed, setPressed] = useState<string | null>(null);

  const handleSelect = (langCode: string) => {
    setPressed(langCode);
    setTimeout(() => {
      setLanguage(langCode);
      i18n.changeLanguage(langCode);
      setFontFamily("");
      // Update all existing tabs to use the selected language's default translation
      const translationId = DEFAULT_TRANSLATION_BY_LANG[langCode] ?? "kjv";
      for (const tab of tabs) {
        updateTab(tab.id, { translationId });
      }
      completeOnboarding();
    }, 200);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <p className="text-xs tracking-[0.25em] uppercase text-gray-400 dark:text-gray-500 mb-10">
        Choose your language
      </p>

      <div className="flex flex-col gap-1.5 w-full max-w-xs">
        {ONBOARDING_LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => handleSelect(lang.code)}
            className={`group flex items-center justify-center w-full py-3 px-5 rounded-2xl transition-all duration-200 ${
              pressed === lang.code
                ? "bg-blue-600 dark:bg-blue-500 scale-[0.97]"
                : "hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.97]"
            }`}
          >
            <span
              className={`text-xl font-semibold transition-colors ${
                pressed === lang.code
                  ? "text-white"
                  : "text-gray-800 dark:text-gray-100"
              }`}
            >
              {lang.greeting}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
