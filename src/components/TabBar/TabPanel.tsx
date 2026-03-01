import { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, type Tab } from "../../stores/tabStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { ChapterView } from "../BibleReader/ChapterView";
import { ReaderSettingsDropdown } from "../BibleReader/ReaderSettingsDropdown";
import { BookPicker } from "../Navigation/BookPicker";
import { ChapterPicker } from "../Navigation/ChapterPicker";
import { CommentaryPanel } from "../Commentary/CommentaryPanel";

export function TabPanel() {
  const { t } = useTranslation();
  const { tabs, activeTabId, updateTab, navigateTo } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId) as Tab;

  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const commentaryPosition = useSettingsStore((s) => s.commentaryPosition);
  const splitRatio = useSettingsStore((s) => s.commentarySplitRatio);
  const setSplitRatio = useSettingsStore((s) => s.setCommentarySplitRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingSplit, setDraggingSplit] = useState(false);

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
  };

  const handlePrevChapter = () => {
    if (activeTab.chapter > 1) {
      navigateTo(activeTab.bookId, activeTab.chapter - 1);
    }
  };

  const handleNextChapter = () => {
    navigateTo(activeTab.bookId, activeTab.chapter + 1);
  };

  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDraggingSplit(true);
  }, []);

  const handleDividerPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingSplit || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const isHorizontal = commentaryPosition === "bottom";
    const ratio = isHorizontal
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;
    setSplitRatio(commentaryPosition === "left" ? 1 - ratio : ratio);
  }, [draggingSplit, commentaryPosition, setSplitRatio]);

  const handleDividerPointerUp = useCallback(() => {
    setDraggingSplit(false);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setShowBookPicker(true)}
          className="text-sm font-semibold text-gray-800 dark:text-gray-200 hover:text-blue-600"
        >
          {t(`books.${activeTab.bookId}`)}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrevChapter}
            disabled={activeTab.chapter <= 1}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => setShowChapterPicker(true)}
            className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 min-w-[60px] text-center"
          >
            {t("nav.chapter", { num: activeTab.chapter })}
          </button>
          <button
            onClick={handleNextChapter}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <ReaderSettingsDropdown
          showCommentary={showCommentary}
          onToggleCommentary={() => setShowCommentary(!showCommentary)}
        />
      </div>

      {/* Main content */}
      <div
        ref={containerRef}
        className={`flex-1 flex overflow-hidden ${
          showCommentary && commentaryPosition === "bottom" ? "flex-col" : "flex-row"
        }`}
      >
        {showCommentary && commentaryPosition === "left" && (
          <>
            <div className="h-full overflow-hidden" style={{ width: `${(1 - splitRatio) * 100}%` }}>
              <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} />
            </div>
            <Divider direction="vertical" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
          </>
        )}
        <div
          className="overflow-hidden"
          style={showCommentary ? (
            commentaryPosition === "bottom"
              ? { width: "100%", height: `${splitRatio * 100}%` }
              : { width: `${splitRatio * 100}%`, height: "100%" }
          ) : { width: "100%", height: "100%" }}
        >
          <ChapterView
            translationId={activeTab.translationId}
            bookId={activeTab.bookId}
            chapter={activeTab.chapter}
            onScrollPositionChange={handleScrollChange}
            initialScrollPosition={activeTab.scrollPosition}
          />
        </div>
        {showCommentary && commentaryPosition === "right" && (
          <>
            <Divider direction="vertical" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
            <div className="h-full overflow-hidden" style={{ width: `${(1 - splitRatio) * 100}%` }}>
              <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} />
            </div>
          </>
        )}
        {showCommentary && commentaryPosition === "bottom" && (
          <>
            <Divider direction="horizontal" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
            <div className="w-full overflow-hidden" style={{ height: `${(1 - splitRatio) * 100}%` }}>
              <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} />
            </div>
          </>
        )}
      </div>

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

function Divider({
  direction,
  dragging,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  direction: "vertical" | "horizontal";
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  const isVertical = direction === "vertical";
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className={`shrink-0 flex items-center justify-center group ${
        isVertical ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize"
      } ${dragging ? "bg-blue-200 dark:bg-blue-800" : "bg-gray-200 dark:bg-gray-700 hover:bg-blue-200 dark:hover:bg-blue-800"} transition-colors`}
    >
      <div
        className={`rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-500 ${
          dragging ? "bg-blue-500" : ""
        } ${isVertical ? "w-0.5 h-6" : "h-0.5 w-6"}`}
      />
    </div>
  );
}
