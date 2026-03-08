import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, type Tab } from "../../stores/tabStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { getBooks } from "../../lib/bible";
import { ChapterView } from "../BibleReader/ChapterView";
import { ReaderSettingsDropdown } from "../BibleReader/ReaderSettingsDropdown";
import { TTSControlBar } from "../BibleReader/TTSControlBar";
import { BookPicker } from "../Navigation/BookPicker";
import { ChapterPicker } from "../Navigation/ChapterPicker";
import { CommentaryPanel } from "../Commentary/CommentaryPanel";
import { useTTS } from "../../hooks/useTTS";
import type { Book, Verse } from "../../types/bible";

const TRANSLATION_LANG: Record<string, string> = {
  "sav-ko": "ko",
  korrv: "ko",
  nkrv: "ko",
  kjv: "en",
  asv: "en",
  web: "en",
  bbe: "en",
  ylt: "en",
  darby: "en",
  cuv: "zh",
  rv1909: "es",
  hebrew: "he",
  greek: "el",
  japkougo: "ja",
  gerelb: "de",
  frecrampon: "fr",
  russynodal: "ru",
  porblivre: "pt",
};

function translationToLang(translationId: string): string {
  return TRANSLATION_LANG[translationId] ?? "en";
}

export function TabPanel({ immersive }: { immersive?: boolean }) {
  const { t } = useTranslation();
  const { tabs, activeTabId, updateTab, navigateTo } = useTabStore();
  const activeTab = tabs.find((tab) => tab.id === activeTabId) as Tab;

  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showChapterPicker, setShowChapterPicker] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const tts = useTTS();

  useEffect(() => { getBooks().then(setBooks); }, []);
  const versesRef = useRef<Verse[]>([]);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const setTtsSpeed = useSettingsStore((s) => s.setTtsSpeed);
  const ttsVoiceName = useSettingsStore((s) => s.ttsVoiceName);
  const setTtsVoiceName = useSettingsStore((s) => s.setTtsVoiceName);
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

  const maxChapter = books.find((b) => b.id === activeTab.bookId)?.chapters ?? 999;

  const handleNextChapter = () => {
    if (activeTab.chapter < maxChapter) {
      navigateTo(activeTab.bookId, activeTab.chapter + 1);
    }
  };

  const handleTtsPlay = () => {
    if (versesRef.current.length > 0) {
      const lang = translationToLang(activeTab.translationId);
      tts.play(versesRef.current, lang);
    }
  };

  const handleVersesLoaded = useCallback((verses: Verse[]) => {
    versesRef.current = verses;
  }, []);

  const handleVoiceChange = (name: string) => {
    setTtsVoiceName(name);
    const idx = tts.currentVerseIndex;
    if (tts.isPlaying && versesRef.current.length > 0) {
      const lang = translationToLang(activeTab.translationId);
      tts.play(versesRef.current, lang, idx);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setTtsSpeed(speed);
    const idx = tts.currentVerseIndex;
    if (tts.isPlaying && versesRef.current.length > 0) {
      const lang = translationToLang(activeTab.translationId);
      tts.play(versesRef.current, lang, idx);
    }
  };

  // Stop TTS when chapter/book changes
  useEffect(() => {
    tts.stop();
  }, [activeTab.bookId, activeTab.chapter, activeTab.translationId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <div className={`flex items-center justify-between px-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 transition-all duration-300 ${immersive ? "max-h-0 py-0 overflow-hidden" : "max-h-20 py-2"}`}>
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
            disabled={activeTab.chapter >= maxChapter}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-1">
          {tts.isAvailable && (
            <button
              onClick={tts.isPlaying ? tts.stop : handleTtsPlay}
              className={`p-1.5 rounded ${
                tts.isPlaying
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
              title={tts.isPlaying ? t("tts.stop") : t("tts.play")}
            >
              {tts.isPlaying ? (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 6h12v12H6z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M17.95 6.05a8 8 0 010 11.9M6.5 8H4a1 1 0 00-1 1v6a1 1 0 001 1h2.5l5 4V4l-5 4z" />
                </svg>
              )}
            </button>
          )}
          <ReaderSettingsDropdown
            showCommentary={showCommentary}
            onToggleCommentary={() => setShowCommentary(!showCommentary)}
            voices={tts.voices}
          />
        </div>
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
              <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} onClose={() => setShowCommentary(false)} />
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
            bookName={t(`books.${activeTab.bookId}`)}
            onScrollPositionChange={handleScrollChange}
            initialScrollPosition={activeTab.scrollPosition}
            ttsVerseIndex={tts.isPlaying ? tts.currentVerseIndex : undefined}
            onVersesLoaded={handleVersesLoaded}
          />
        </div>
        {showCommentary && commentaryPosition === "right" && (
          <>
            <Divider direction="vertical" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
            <div className="h-full overflow-hidden" style={{ width: `${(1 - splitRatio) * 100}%` }}>
              <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} onClose={() => setShowCommentary(false)} />
            </div>
          </>
        )}
        {showCommentary && commentaryPosition === "bottom" && (
          <>
            <Divider direction="horizontal" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
            <div className="w-full overflow-hidden" style={{ height: `${(1 - splitRatio) * 100}%` }}>
              <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} onClose={() => setShowCommentary(false)} />
            </div>
          </>
        )}
      </div>

      {/* TTS Control Bar */}
      {tts.isPlaying && (
        <TTSControlBar
          isPaused={tts.isPaused}
          currentVerseNumber={
            versesRef.current[tts.currentVerseIndex]?.verse ?? tts.currentVerseIndex + 1
          }
          speed={ttsSpeed}
          voiceName={ttsVoiceName}
          lang={translationToLang(activeTab.translationId)}
          voices={tts.voices}
          onPause={tts.pause}
          onResume={tts.resume}
          onStop={tts.stop}
          onSpeedChange={handleSpeedChange}
          onVoiceChange={handleVoiceChange}
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
      className={`shrink-0 flex items-center justify-center group touch-none ${
        isVertical ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize"
      } ${dragging ? "bg-blue-200 dark:bg-blue-800" : "bg-gray-200 dark:bg-gray-700 hover:bg-blue-200 dark:hover:bg-blue-800"} transition-colors`}
    >
      <div
        className={`rounded-full bg-gray-400 dark:bg-gray-500 group-hover:bg-blue-500 ${
          dragging ? "bg-blue-500" : ""
        } ${isVertical ? "w-0.5 h-8" : "h-0.5 w-8"}`}
      />
    </div>
  );
}
