import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore, DEFAULT_TRANSLATION_BY_LANG } from "../../stores/settingsStore";
import { useTabStore } from "../../stores/tabStore";
import { ONBOARDING_VERSE } from "../../lib/splashVerses";

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
      const translationId = DEFAULT_TRANSLATION_BY_LANG[langCode] ?? "kjv";
      for (const tab of tabs) {
        updateTab(tab.id, { translationId });
      }
      completeOnboarding();
    }, 400);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen px-8 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 rounded-full bg-blue-100/40 dark:bg-blue-900/15 blur-3xl" />
      </div>

      {/* Selah branding */}
      <div className="animate-splash-ref relative z-10 mb-12">
        <p className="text-xs tracking-[0.4em] uppercase text-gray-300 dark:text-gray-600 font-light">
          Selah
        </p>
      </div>

      {/* Korean verse */}
      <blockquote className="animate-onboard-verse relative z-10 text-center max-w-sm mb-6">
        <p className="text-lg leading-loose font-serif text-gray-800 dark:text-gray-100 tracking-wide">
          {ONBOARDING_VERSE.ko}
        </p>
      </blockquote>

      {/* English verse */}
      <blockquote className="animate-onboard-en relative z-10 text-center max-w-sm mb-4">
        <p className="text-sm leading-relaxed text-gray-400 dark:text-gray-500 italic">
          {ONBOARDING_VERSE.en}
        </p>
      </blockquote>

      {/* Reference */}
      <p className="animate-onboard-ref relative z-10 text-xs tracking-[0.15em] text-gray-300 dark:text-gray-600 mb-14">
        — {ONBOARDING_VERSE.refKo}
      </p>

      {/* Amen buttons */}
      <div className="animate-onboard-buttons relative z-10 flex gap-5">
        <button
          onClick={() => handleSelect("ko")}
          className={`group relative px-10 py-3.5 rounded-full text-base font-medium transition-all duration-300 ${
            pressed === "ko"
              ? "bg-blue-600 text-white scale-95 shadow-lg shadow-blue-600/30"
              : pressed
                ? "opacity-30 scale-95"
                : "bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95"
          }`}
        >
          아멘
        </button>
        <button
          onClick={() => handleSelect("en")}
          className={`group relative px-10 py-3.5 rounded-full text-base font-medium transition-all duration-300 ${
            pressed === "en"
              ? "bg-blue-600 text-white scale-95 shadow-lg shadow-blue-600/30"
              : pressed
                ? "opacity-30 scale-95"
                : "bg-gray-100 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 active:scale-95"
          }`}
        >
          Amen
        </button>
      </div>
    </div>
  );
}
