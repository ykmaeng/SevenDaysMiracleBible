import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import { useDictionary } from "../../hooks/useDictionary";

interface DictionaryPopupProps {
  word: string;
  position: { x: number; y: number; bottom: number };
  containerRect: DOMRect;
  onClose: () => void;
}

export function DictionaryPopup({ word, position, containerRect, onClose }: DictionaryPopupProps) {
  const { t } = useTranslation();
  const dictionaryLang = useSettingsStore((s) => s.dictionaryLang);
  const { loading, result, error, lookup, clear } = useDictionary(dictionaryLang);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    lookup(word);
    return clear;
  }, [word, lookup, clear]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Position with fixed positioning (viewport-relative) to avoid scroll offset issues
  const popupWidth = 280;
  const showAbove = (window.innerHeight - position.bottom) < 200;

  // Clamp left within container bounds
  let left = position.x - popupWidth / 2;
  left = Math.max(containerRect.left + 4, Math.min(left, containerRect.right - popupWidth - 4));

  const style: React.CSSProperties = {
    position: "fixed",
    left: `${left}px`,
    width: `${popupWidth}px`,
    zIndex: 60,
    ...(showAbove
      ? { bottom: `${window.innerHeight - position.y + 4}px` }
      : { top: `${position.bottom + 4}px` }),
  };

  return (
    <div
      ref={popupRef}
      style={style}
      className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 overflow-hidden"
    >
      {loading && (
        <div className="flex items-center justify-center py-6">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {t("dictionary.loading")}
          </span>
        </div>
      )}

      {error && !loading && (
        <div className="px-3 py-4 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {error === "noResult"
              ? t("dictionary.noResult")
              : t("dictionary.error")}
          </p>
          <p className="text-xs text-gray-400 mt-1 font-medium">{word}</p>
        </div>
      )}

      {result && !loading && (
        <div className="max-h-60 overflow-y-auto">
          {/* Header: word + phonetic */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-gray-900 dark:text-gray-100 text-base">
              {result.word}
            </span>
            {result.phonetic && (
              <span className="ml-2 text-sm text-gray-400 dark:text-gray-500">
                {result.phonetic}
              </span>
            )}
          </div>

          {/* Meanings */}
          <div className="px-3 py-2 space-y-2">
            {result.meanings.map((m, mi) => (
              <div key={mi}>
                <span className="text-xs font-medium text-blue-500 dark:text-blue-400 italic">
                  {m.partOfSpeech}
                </span>
                <ol className="mt-0.5 space-y-1">
                  {m.definitions.map((d, di) => (
                    <li key={di} className="flex">
                      <span className="text-gray-400 dark:text-gray-500 mr-1.5 shrink-0 text-xs mt-0.5">
                        {di + 1}.
                      </span>
                      <div>
                        {/* Translated definition (primary) */}
                        {d.translated && d.translated !== d.definition ? (
                          <>
                            <span className="text-sm text-gray-800 dark:text-gray-200">
                              {d.translated}
                            </span>
                            <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                              {d.definition}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {d.definition}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
