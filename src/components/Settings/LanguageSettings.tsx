import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { getDownloadedTranslations } from "../../lib/bible";
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

const DICT_LANGUAGES = [
  { code: "ko", name: "한국어" },
  { code: "zh", name: "中文" },
  { code: "es", name: "Español" },
  { code: "ja", name: "日本語" },
  { code: "de", name: "Deutsch" },
  { code: "fr", name: "Français" },
  { code: "ru", name: "Русский" },
  { code: "pt", name: "Português" },
  { code: "en", name: "English (Off)" },
];

export function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const { language, setLanguage, fontSize, setFontSize, theme, setTheme, showVerseNumbers, setShowVerseNumbers, parallelTranslations, toggleParallelTranslation, reorderParallelTranslation, dictionaryLang, setDictionaryLang } =
    useSettingsStore();
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);
  const [parallelOpen, setParallelOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [dragActiveIdx, setDragActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    getDownloadedTranslations().then(setAvailableTranslations);
  }, []);

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
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
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
          <span
            className="text-gray-400 dark:text-gray-500 truncate ml-1"
            style={{ fontSize: `${fontSize}px` }}
          >
            {t("fontSizePreview")}
          </span>
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

      {/* Dictionary language */}
      <section>
        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
          {t("dictionary.settingsTitle")}
        </h3>
        <select
          value={dictionaryLang}
          onChange={(e) => setDictionaryLang(e.target.value)}
          className="w-full text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
        >
          {DICT_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {t("dictionary.settingsDesc")}
        </p>
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
