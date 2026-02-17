import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore } from "../../stores/tabStore";
import { getDownloadedTranslations } from "../../lib/bible";
import type { Translation } from "../../types/bible";

export function TabBar() {
  const { t } = useTranslation();
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, updateTab } = useTabStore();
  const [showTranslationPicker, setShowTranslationPicker] = useState(false);
  const [translations, setTranslations] = useState<Translation[]>([]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  useEffect(() => {
    const load = () => getDownloadedTranslations().then(setTranslations);
    load();
    window.addEventListener("translations-changed", load);
    return () => window.removeEventListener("translations-changed", load);
  }, []);

  return (
    <div className="flex items-center bg-gray-100 border-b border-gray-200">
      <div className="flex items-center overflow-x-auto flex-1 min-w-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-1 px-3 py-2 text-sm cursor-pointer border-r border-gray-200 min-w-0 shrink-0 ${
              tab.id === activeTabId
                ? "bg-white text-blue-600 font-medium"
                : "text-gray-600 hover:bg-gray-50"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="truncate max-w-[120px]">
              {t(`books.${tab.bookId}`)} {tab.chapter}
            </span>
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="text-gray-400 hover:text-red-500 ml-1 shrink-0"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ))}
        <button
            onClick={() => addTab()}
            className="px-3 py-2 text-gray-400 hover:text-blue-600 shrink-0"
            title={t("tabs.newTab")}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
      </div>

      {/* Translation selector */}
      <div className="relative shrink-0">
        <button
          onClick={() => setShowTranslationPicker(!showTranslationPicker)}
          className="px-3 py-2 text-xs font-semibold text-gray-600 hover:text-blue-600 hover:bg-gray-50 uppercase"
        >
          {activeTab?.translationId ?? "kjv"}
        </button>
        {showTranslationPicker && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowTranslationPicker(false)}
            />
            <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[220px] py-1">
              {translations.map((tr) => (
                <button
                  key={tr.id}
                  onClick={() => {
                    updateTab(activeTabId, { translationId: tr.id });
                    setShowTranslationPicker(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between ${
                    activeTab?.translationId === tr.id
                      ? "text-blue-600 font-medium bg-blue-50"
                      : "text-gray-700"
                  }`}
                >
                  <span>{tr.name}</span>
                  <span className="text-xs text-gray-400 uppercase">{tr.language}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
