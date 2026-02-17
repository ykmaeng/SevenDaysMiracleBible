import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";

const LANGUAGES = [
  { code: "ko", name: "한국어" },
  { code: "en", name: "English" },
  { code: "zh", name: "中文" },
  { code: "es", name: "Español" },
];

export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const { language, setLanguage, fontSize, setFontSize, theme, setTheme, showVerseNumbers, setShowVerseNumbers } =
    useSettingsStore();

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
  };

  return (
    <div className="space-y-6">
      {/* Language */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
          {t("settings.language")}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                language === lang.code
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {lang.name}
            </button>
          ))}
        </div>
      </section>

      {/* Font size */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
          {t("settings.fontSize")}
        </h3>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFontSize(fontSize - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            A-
          </button>
          <span className="text-sm font-medium w-8 text-center">{fontSize}</span>
          <button
            onClick={() => setFontSize(fontSize + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            A+
          </button>
        </div>
      </section>

      {/* Theme */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
          {t("settings.theme")}
        </h3>
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((th) => (
            <button
              key={th}
              onClick={() => setTheme(th)}
              className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                theme === th
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t(`settings.theme${th.charAt(0).toUpperCase() + th.slice(1)}`)}
            </button>
          ))}
        </div>
      </section>

      {/* Verse numbers */}
      <section>
        <label className="flex items-center justify-between">
          <span className="text-sm text-gray-700">{t("settings.showVerseNumbers")}</span>
          <button
            onClick={() => setShowVerseNumbers(!showVerseNumbers)}
            className={`w-10 h-6 rounded-full transition-colors ${
              showVerseNumbers ? "bg-blue-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1 ${
                showVerseNumbers ? "translate-x-4" : ""
              }`}
            />
          </button>
        </label>
      </section>
    </div>
  );
}
