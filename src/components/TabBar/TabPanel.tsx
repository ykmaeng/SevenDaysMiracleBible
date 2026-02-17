import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, type Tab } from "../../stores/tabStore";
import { ChapterView } from "../BibleReader/ChapterView";
import { ParallelView } from "../BibleReader/ParallelView";
import { BookPicker } from "../Navigation/BookPicker";
import { ChapterPicker } from "../Navigation/ChapterPicker";
import { CommentaryPanel } from "../Commentary/CommentaryPanel";

export function TabPanel() {
  const { t } = useTranslation();
  const { tabs, activeTabId, updateTab, navigateTo } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId) as Tab;

  const [selectedVerse, setSelectedVerse] = useState<number | null>(null);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);

  const handleScrollChange = useCallback(
    (position: number) => {
      updateTab(activeTabId, { scrollPosition: position });
    },
    [activeTabId, updateTab]
  );

  const handleBookSelect = (bookId: number) => {
    setShowBookPicker(false);
    setShowChapterPicker(true);
    navigateTo(bookId, 1);
  };

  const handleChapterSelect = (chapter: number) => {
    setShowChapterPicker(false);
    navigateTo(activeTab.bookId, chapter);
    setSelectedVerse(null);
  };

  const handlePrevChapter = () => {
    if (activeTab.chapter > 1) {
      navigateTo(activeTab.bookId, activeTab.chapter - 1);
      setSelectedVerse(null);
    }
  };

  const handleNextChapter = () => {
    navigateTo(activeTab.bookId, activeTab.chapter + 1);
    setSelectedVerse(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
        <button
          onClick={() => setShowBookPicker(true)}
          className="text-sm font-semibold text-gray-800 hover:text-blue-600"
        >
          {t(`books.${activeTab.bookId}`)}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevChapter}
            disabled={activeTab.chapter <= 1}
            className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setShowChapterPicker(true)}
            className="text-sm font-medium text-gray-600 hover:text-blue-600 min-w-[60px] text-center"
          >
            {t("nav.chapter", { num: activeTab.chapter })}
          </button>
          <button
            onClick={handleNextChapter}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => setShowCommentary(!showCommentary)}
          className={`text-xs px-2 py-1 rounded ${
            showCommentary
              ? "bg-blue-100 text-blue-700"
              : "text-gray-500 hover:bg-gray-100"
          }`}
        >
          {t("commentary.title")}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`${showCommentary ? "w-1/2" : "w-full"} h-full`}>
          <ChapterView
            translationId={activeTab.translationId}
            bookId={activeTab.bookId}
            chapter={activeTab.chapter}
            selectedVerse={selectedVerse ?? undefined}
            onSelectVerse={setSelectedVerse}
            onScrollPositionChange={handleScrollChange}
            initialScrollPosition={activeTab.scrollPosition}
          />
        </div>
        {showCommentary && (
          <div className="w-1/2 h-full border-l border-gray-200">
            <CommentaryPanel
              bookId={activeTab.bookId}
              chapter={activeTab.chapter}
            />
          </div>
        )}
      </div>

      {/* Parallel view bottom sheet */}
      {selectedVerse !== null && (
        <ParallelView
          bookId={activeTab.bookId}
          chapter={activeTab.chapter}
          verse={selectedVerse}
          onClose={() => setSelectedVerse(null)}
        />
      )}

      {/* Pickers */}
      {showBookPicker && (
        <BookPicker
          onSelect={handleBookSelect}
          onClose={() => setShowBookPicker(false)}
        />
      )}
      {showChapterPicker && (
        <ChapterPicker
          bookId={activeTab.bookId}
          onSelect={handleChapterSelect}
          onClose={() => setShowChapterPicker(false)}
        />
      )}
    </div>
  );
}
