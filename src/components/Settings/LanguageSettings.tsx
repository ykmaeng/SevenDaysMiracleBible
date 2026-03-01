import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { getDownloadedTranslations } from "../../lib/bible";
import { preloadFontsForLang } from "../../lib/googleFonts";
import { DownloadManager } from "./DownloadManager";
import type { Translation } from "../../types/bible";

const LANGUAGES = [
  { code: "ko", name: "한국어" },
  { code: "en", name: "English" },
  { code: "zh", name: "中文" },
  { code: "es", name: "Español" },
  { code: "ja", name: "日本語" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
  { code: "pt", name: "Português" },
];

interface FontOption {
  id: string;
  label: string;
  googleFont?: string; // Google Fonts family name for dynamic loading
}

const FONT_OPTIONS: Record<string, FontOption[]> = {
  ko: [
    { id: "", label: "기본값" },
    { id: "'Noto Sans KR', sans-serif", label: "본고딕", googleFont: "Noto Sans KR" },
    { id: "'Noto Serif KR', serif", label: "본명조", googleFont: "Noto Serif KR" },
    { id: "'Nanum Gothic', sans-serif", label: "나눔고딕", googleFont: "Nanum Gothic" },
    { id: "'Nanum Myeongjo', serif", label: "나눔명조", googleFont: "Nanum Myeongjo" },
    { id: "'Jua', sans-serif", label: "주아", googleFont: "Jua" },
    { id: "'Gaegu', cursive", label: "개구", googleFont: "Gaegu" },
    { id: "'Gamja Flower', cursive", label: "감자꽃", googleFont: "Gamja Flower" },
  ],
  en: [
    { id: "", label: "Default" },
    { id: "'Lora', serif", label: "Lora", googleFont: "Lora" },
    { id: "'Merriweather', serif", label: "Merriweather", googleFont: "Merriweather" },
    { id: "'Inter', sans-serif", label: "Inter", googleFont: "Inter" },
    { id: "'Roboto', sans-serif", label: "Roboto", googleFont: "Roboto" },
    { id: "'Playfair Display', serif", label: "Playfair", googleFont: "Playfair Display" },
  ],
  zh: [
    { id: "", label: "默认" },
    { id: "'Noto Sans SC', sans-serif", label: "思源黑体", googleFont: "Noto Sans SC" },
    { id: "'Noto Serif SC', serif", label: "思源宋体", googleFont: "Noto Serif SC" },
    { id: "'ZCOOL XiaoWei', serif", label: "站酷小薇", googleFont: "ZCOOL XiaoWei" },
  ],
  ja: [
    { id: "", label: "デフォルト" },
    { id: "'Noto Sans JP', sans-serif", label: "Noto Sans", googleFont: "Noto Sans JP" },
    { id: "'Noto Serif JP', serif", label: "Noto Serif", googleFont: "Noto Serif JP" },
    { id: "'Zen Maru Gothic', sans-serif", label: "丸ゴシック", googleFont: "Zen Maru Gothic" },
  ],
  _default: [
    { id: "", label: "Default" },
    { id: "'Noto Sans', sans-serif", label: "Noto Sans", googleFont: "Noto Sans" },
    { id: "'Noto Serif', serif", label: "Noto Serif", googleFont: "Noto Serif" },
    { id: "'Roboto', sans-serif", label: "Roboto", googleFont: "Roboto" },
  ],
};

function getFontOptions(lang: string): FontOption[] {
  return FONT_OPTIONS[lang] ?? FONT_OPTIONS._default;
}

const DICT_LANGUAGES = [
  { code: "ko", name: "한국어" },
  { code: "en", name: "English" },
  { code: "zh", name: "中文" },
  { code: "es", name: "Español" },
  { code: "ja", name: "日本語" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
  { code: "pt", name: "Português" },
];

export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const { language, setLanguage, fontSize, setFontSize, fontFamily, setFontFamily, theme, setTheme, showVerseNumbers, setShowVerseNumbers, parallelTranslations, toggleParallelTranslation, reorderParallelTranslation, dictionaryLang, setDictionaryLang } =
    useSettingsStore();
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [fontOpen, setFontOpen] = useState(false);
  const [dictOpen, setDictOpen] = useState(false);
  const [parallelOpen, setParallelOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [dragActiveIdx, setDragActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    getDownloadedTranslations().then(setAvailableTranslations);
  }, []);

  // Preload Google Fonts when font section opens
  useEffect(() => {
    if (fontOpen) {
      preloadFontsForLang(getFontOptions(language));
    }
  }, [fontOpen, language]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    // Reset font family when language changes (fonts differ per language)
    setFontFamily("");
  };

  return (
    <div className="space-y-6">
      {/* Language (foldable) */}
      <section>
        <button
          onClick={() => setLanguageOpen(!languageOpen)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            {t("settings.language")}
            <span className="ml-1.5 text-xs text-blue-500 normal-case font-normal">
              ({LANGUAGES.find((l) => l.code === language)?.name ?? language})
            </span>
          </h3>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${languageOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {languageOpen && (
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                  language === lang.code
                    ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Font (foldable) */}
      <section>
        <button
          onClick={() => setFontOpen(!fontOpen)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            {t("settings.font")}
            <span className="ml-1.5 text-xs text-blue-500 normal-case font-normal">
              ({fontSize}px)
            </span>
          </h3>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${fontOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {fontOpen && (
          <div className="space-y-3">
            {/* Font size */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t("settings.fontSize")}</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFontSize(fontSize - 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0"
                >
                  A-
                </button>
                <span className="text-sm font-medium w-8 text-center shrink-0">{fontSize}</span>
                <button
                  onClick={() => setFontSize(fontSize + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 shrink-0"
                >
                  A+
                </button>
              </div>
            </div>

            {/* Font family */}
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">{t("settings.fontFamily")}</label>
              <div className="grid grid-cols-2 gap-2">
                {getFontOptions(language).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFontFamily(f.id)}
                    className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                      fontFamily === f.id
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                    style={{ fontFamily: f.id || "inherit" }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            <div
              className="text-gray-600 dark:text-gray-300 bg-gray-50/50 dark:bg-gray-800/30 border-l-2 border-blue-400 dark:border-blue-500 pl-3 pr-2 py-2 mt-1 rounded-r"
              style={{ fontSize: `${fontSize}px`, fontFamily: fontFamily || "inherit", lineHeight: 1.8 }}
            >
              {t("fontSizePreview")}
            </div>
          </div>
        )}
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
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
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
          <span className="text-sm text-gray-700 dark:text-gray-300">{t("settings.showVerseNumbers")}</span>
          <button
            onClick={() => setShowVerseNumbers(!showVerseNumbers)}
            className={`w-10 h-6 rounded-full transition-colors ${
              showVerseNumbers ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
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

      {/* Dictionary language (foldable) */}
      <section>
        <button
          onClick={() => setDictOpen(!dictOpen)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            {t("dictionary.settingsTitle")}
            <span className="ml-1.5 text-xs text-blue-500 normal-case font-normal">
              ({DICT_LANGUAGES.find((l) => l.code === dictionaryLang)?.name ?? dictionaryLang})
            </span>
          </h3>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${dictOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {dictOpen && (
          <div>
            <div className="grid grid-cols-2 gap-2">
              {DICT_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setDictionaryLang(lang.code)}
                  className={`py-2 px-3 rounded-lg text-sm transition-colors ${
                    dictionaryLang === lang.code
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t("dictionary.settingsDesc")}
            </p>
          </div>
        )}
      </section>

      {/* Parallel translations (foldable) */}
      {availableTranslations.length > 0 && (
        <section>
          <button
            onClick={() => setParallelOpen(!parallelOpen)}
            className="flex items-center justify-between w-full mb-2"
          >
            <h3 className="text-sm font-semibold text-gray-500 uppercase">
              {t("settings.parallelTranslations")}
              {parallelTranslations.length > 0 && (
                <span className="ml-1.5 text-xs text-blue-500 normal-case font-normal">
                  ({parallelTranslations.length})
                </span>
              )}
            </h3>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${parallelOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {parallelOpen && (
            <div className="space-y-1">
              {/* Selected translations (draggable, in order) */}
              {parallelTranslations
                .map((id, idx) => {
                  const tr = availableTranslations.find((t) => t.id === id);
                  if (!tr) return null;

                  const handlePointerDown = (e: React.PointerEvent) => {
                    e.preventDefault();
                    dragIdx.current = idx;
                    setDragActiveIdx(idx);

                    const onMove = (ev: PointerEvent) => {
                      if (dragIdx.current === null) return;
                      // Find which item the pointer is over
                      for (const [i, el] of itemRefs.current.entries()) {
                        const rect = el.getBoundingClientRect();
                        if (ev.clientY >= rect.top && ev.clientY <= rect.bottom && dragIdx.current !== i) {
                          reorderParallelTranslation(dragIdx.current, i);
                          dragIdx.current = i;
                          setDragActiveIdx(i);
                          break;
                        }
                      }
                    };
                    const onUp = () => {
                      dragIdx.current = null;
                      setDragActiveIdx(null);
                      document.removeEventListener("pointermove", onMove);
                      document.removeEventListener("pointerup", onUp);
                    };
                    document.addEventListener("pointermove", onMove);
                    document.addEventListener("pointerup", onUp);
                  };

                  return (
                    <div
                      key={tr.id}
                      ref={(el) => { if (el) itemRefs.current.set(idx, el); else itemRefs.current.delete(idx); }}
                      className={`flex items-center gap-2 w-full py-2 px-3 rounded-lg text-sm transition-colors bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ${
                        dragActiveIdx === idx ? "opacity-50 ring-2 ring-blue-400" : ""
                      }`}
                    >
                      {/* Drag handle */}
                      <svg
                        onPointerDown={handlePointerDown}
                        className="w-4 h-4 text-blue-400 dark:text-blue-500 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <circle cx="5" cy="3" r="1.2" />
                        <circle cx="11" cy="3" r="1.2" />
                        <circle cx="5" cy="8" r="1.2" />
                        <circle cx="11" cy="8" r="1.2" />
                        <circle cx="5" cy="13" r="1.2" />
                        <circle cx="11" cy="13" r="1.2" />
                      </svg>
                      <button
                        onClick={() => toggleParallelTranslation(tr.id)}
                        className="flex items-center justify-between flex-1 text-left"
                      >
                        <div>
                          <span className="font-medium">{tr.name}</span>
                          <span className="ml-2 text-xs opacity-60">{tr.language.toUpperCase()}</span>
                        </div>
                        <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  );
                })
                .filter(Boolean)}

              {/* Unselected translations */}
              {availableTranslations
                .filter((tr) => !parallelTranslations.includes(tr.id))
                .map((tr) => (
                  <button
                    key={tr.id}
                    onClick={() => toggleParallelTranslation(tr.id)}
                    className="flex items-center justify-between w-full py-2 px-3 rounded-lg text-sm transition-colors bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="text-left">
                      <span className="font-medium">{tr.name}</span>
                      <span className="ml-2 text-xs opacity-60">{tr.language.toUpperCase()}</span>
                      {tr.description && (
                        <p className="text-xs opacity-50 mt-0.5">{tr.description}</p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </section>
      )}

      {/* Download manager (foldable) */}
      <section>
        <button
          onClick={() => setDownloadsOpen(!downloadsOpen)}
          className="flex items-center justify-between w-full mb-2"
        >
          <h3 className="text-sm font-semibold text-gray-500 uppercase">
            {t("settings.downloads")}
          </h3>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${downloadsOpen ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {downloadsOpen && <DownloadManager />}
      </section>
    </div>
  );
}
