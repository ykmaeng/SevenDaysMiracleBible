import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getParallelVerses } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import { VotingButtons } from "../Feedback/VotingButtons";
import type { ParallelVerse } from "../../types/bible";

interface ParallelViewProps {
  bookId: number;
  chapter: number;
  verse: number;
  onClose: () => void;
}

export function ParallelView({ bookId, chapter, verse, onClose }: ParallelViewProps) {
  const { t } = useTranslation();
  const parallelTranslations = useSettingsStore((s) => s.parallelTranslations);
  const [data, setData] = useState<ParallelVerse | null>(null);

  useEffect(() => {
    getParallelVerses(bookId, chapter, verse, parallelTranslations).then(setData);
  }, [bookId, chapter, verse, parallelTranslations]);

  if (!data) return null;

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

        <div className="p-4 space-y-4">
          {/* Original text */}
          {data.original && (
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
          {data.translations.map((tr) => (
            <div key={tr.translationId} className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600 uppercase">
                  {tr.translationName}
                </span>
                <VotingButtons
                  bookId={bookId}
                  chapter={chapter}
                  verse={verse}
                  translationId={tr.translationId}
                />
              </div>
              <p className="text-base leading-relaxed text-gray-800">{tr.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="fixed inset-0 bg-black/20 -z-10" onClick={onClose} />
    </div>
  );
}
