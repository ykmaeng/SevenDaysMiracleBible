import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getDownloadedTranslations, getParallelVerses } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import type { ParallelVerse, Translation } from "../../types/bible";

interface ParallelViewProps {
  bookId: number;
  chapter: number;
  verse: number;
  currentTranslationId: string;
  onClose: () => void;
}

export function ParallelView({ bookId, chapter, verse, currentTranslationId, onClose }: ParallelViewProps) {
  const { t } = useTranslation();
  const parallelTranslations = useSettingsStore((s) => s.parallelTranslations);
  const toggleParallelTranslation = useSettingsStore((s) => s.toggleParallelTranslation);
  const [data, setData] = useState<ParallelVerse | null>(null);
  const [availableTranslations, setAvailableTranslations] = useState<Translation[]>([]);

  const isOT = bookId <= 39;

  // Load available (downloaded) translations, excluding the current one
  // and filtering original-language texts by testament (Hebrew=OT, Greek=NT)
  useEffect(() => {
    getDownloadedTranslations().then((all) => {
      setAvailableTranslations(
        all.filter((tr) => {
          if (tr.id === currentTranslationId) return false;
          if (tr.id === "hebrew" && !isOT) return false;
          if (tr.id === "greek" && isOT) return false;
          return true;
        })
      );
    });
  }, [currentTranslationId, isOT]);

  // Active translations = only those that are both selected AND available
  const availableIds = availableTranslations.map((tr) => tr.id);
  const activeIds = parallelTranslations.filter(
    (id) => id !== currentTranslationId && availableIds.includes(id)
  );

  useEffect(() => {
    if (activeIds.length === 0 || availableTranslations.length === 0) {
      setData({ original: null, translations: [] });
      return;
    }
    getParallelVerses(bookId, chapter, verse, activeIds).then(setData);
  }, [bookId, chapter, verse, activeIds.join(","), availableTranslations.length]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50">
      <div className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[70vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">
            {t(`books.${bookId}`)} {chapter}:{verse}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Translation chips */}
        {availableTranslations.length > 0 && (
          <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
            {availableTranslations.map((tr) => {
              const isActive = parallelTranslations.includes(tr.id);
              return (
                <button
                  key={tr.id}
                  onClick={() => toggleParallelTranslation(tr.id)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                      : "bg-gray-100 text-gray-500 border border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  {tr.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="p-4 space-y-4">
          {/* Original text */}
          {data?.original && (
            <div className="space-y-1">
              {data.original.hebrew_text && (
                <div>
                  <span className="text-xs font-medium text-purple-600 uppercase">
                    {t("reader.original")} (Hebrew)
                  </span>
                  <p className="text-lg leading-relaxed" dir="rtl">
                    {data.original.hebrew_text}
                  </p>
                </div>
              )}
              {data.original.greek_text && (
                <div>
                  <span className="text-xs font-medium text-purple-600 uppercase">
                    {t("reader.original")} (Greek)
                  </span>
                  <p className="text-lg leading-relaxed">{data.original.greek_text}</p>
                </div>
              )}
            </div>
          )}

          {/* Translations */}
          {data?.translations.map((tr) => (
            <div key={tr.translationId} className="border-t border-gray-100 pt-3">
              <span className="text-xs font-medium text-blue-600 uppercase mb-1 block">
                {tr.translationName}
              </span>
              <p className="text-base leading-relaxed text-gray-800">{tr.text}</p>
            </div>
          ))}

          {/* Empty state */}
          {activeIds.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">
              {t("reader.selectTranslation", "Select translations above to compare")}
            </p>
          )}
        </div>
      </div>
      <div className="fixed inset-0 bg-black/20 -z-10" onClick={onClose} />
    </div>
  );
}
