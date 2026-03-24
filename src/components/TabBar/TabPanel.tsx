import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTabStore, type Tab } from "../../stores/tabStore";
import { useFeatureStore } from "../../stores/featureStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { getBooks, getDownloadedTranslations } from "../../lib/bible";
import { ChapterView } from "../BibleReader/ChapterView";
import { ReaderSettingsDropdown } from "../BibleReader/ReaderSettingsDropdown";
import { TTSControlBar } from "../BibleReader/TTSControlBar";
import { BookPicker } from "../Navigation/BookPicker";
import { ChapterPicker } from "../Navigation/ChapterPicker";
import { CommentaryPanel } from "../Commentary/CommentaryPanel";
import { useTTS } from "../../hooks/useTTS";
import { isInterlinearDbDownloaded, downloadInterlinear, interlinearDownloadKey } from "../../lib/interlinearService";
import { useDownloadStore } from "../../stores/downloadStore";
import type { Book, Verse, Translation } from "../../types/bible";

const TRANSLATION_LANG: Record<string, string> = {
  "sav-ko": "ko",
  korrv: "ko",
  nkrv: "ko",
  kjv: "en",
  web: "en",
  hebrew: "he",
  greek: "el",
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
  const showTabs = useFeatureStore((s) => s.enabledFeatures).includes("tabs");
  const showCommentary = useSettingsStore((s) => s.showCommentary);
  const setShowCommentary = useSettingsStore((s) => s.setShowCommentary);
  // Defer commentary panel rendering to avoid concurrent heavy DB + Markdown work on mount
  const [commentaryReady, setCommentaryReady] = useState(false);
  useEffect(() => {
    if (showCommentary) {
      const id = requestAnimationFrame(() => setCommentaryReady(true));
      return () => { cancelAnimationFrame(id); setCommentaryReady(false); };
    }
    setCommentaryReady(false);
  }, [showCommentary]);
  const [showInterlinear, setShowInterlinear] = useState(false);
  const [interlinearDownloading, setInterlinearDownloading] = useState(false);
  const interlinearDl = useDownloadStore((s) => s.downloads[interlinearDownloadKey()]);
  const clearDownload = useDownloadStore((s) => s.clearDownload);
  const [books, setBooks] = useState<Book[]>([]);
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [showTranslationPicker, setShowTranslationPicker] = useState(false);
  const tts = useTTS();

  // Handle Android back button for pickers
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.handled) return;
      if (showTranslationPicker) { setShowTranslationPicker(false); detail.handled = true; return; }
      if (showChapterPicker) { setShowChapterPicker(false); detail.handled = true; return; }
      if (showBookPicker) { setShowBookPicker(false); detail.handled = true; return; }
      if (showInterlinear) { setShowInterlinear(false); detail.handled = true; return; }
    };
    window.addEventListener("dismiss-popup", handler);
    return () => window.removeEventListener("dismiss-popup", handler);
  }, [showBookPicker, showChapterPicker, showTranslationPicker, showInterlinear]);

  useEffect(() => { getBooks().then(setBooks); }, []);
  useEffect(() => {
    const load = () => getDownloadedTranslations().then(setTranslations);
    load();
    window.addEventListener("translations-changed", load);
    return () => window.removeEventListener("translations-changed", load);
  }, []);

  const versesRef = useRef<Verse[]>([]);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const setTtsSpeed = useSettingsStore((s) => s.setTtsSpeed);
  const ttsVoiceName = useSettingsStore((s) => s.ttsVoiceName);
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
    } else if (activeTab.bookId > 1) {
      const prevBook = books.find((b) => b.id === activeTab.bookId - 1);
      if (prevBook) {
        navigateTo(prevBook.id, prevBook.chapters);
      }
    }
  };

  const maxChapter = books.find((b) => b.id === activeTab.bookId)?.chapters ?? 999;

  const handleNextChapter = () => {
    if (activeTab.chapter < maxChapter) {
      navigateTo(activeTab.bookId, activeTab.chapter + 1);
    } else if (activeTab.bookId < 66) {
      navigateTo(activeTab.bookId + 1, 1);
    }
  };

  const handleTtsPlay = () => {
    if (versesRef.current.length > 0) {
      const lang = translationToLang(activeTab.translationId);
      tts.play(versesRef.current, lang);
      window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: true }));
    }
  };

  const handleVersesLoaded = useCallback((verses: Verse[]) => {
    versesRef.current = verses;
  }, []);

  const handleVoiceChange = (_name: string) => {
    // Voice setting is already persisted by TTSControlBar; just restart from current verse
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

  // Enable interlinear after download completes
  useEffect(() => {
    if (interlinearDl?.status === "done" && interlinearDownloading) {
      setInterlinearDownloading(false);
      setShowInterlinear(true);
      clearDownload(interlinearDownloadKey());
    } else if (interlinearDl?.status === "error") {
      setInterlinearDownloading(false);
    }
  }, [interlinearDl?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for "read from here" events from VerseActionToolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const { verseNumber } = (e as CustomEvent).detail;
      const verses = versesRef.current;
      if (verses.length === 0) return;
      const idx = verses.findIndex((v) => v.verse === verseNumber);
      if (idx < 0) return;
      const lang = translationToLang(activeTab.translationId);
      tts.play(verses, lang, idx);
      window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: true }));
    };
    window.addEventListener("tts-play-from", handler);
    return () => window.removeEventListener("tts-play-from", handler);
  }, [activeTab.translationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stop TTS when chapter/book changes
  useEffect(() => {
    tts.stop();
  }, [activeTab.bookId, activeTab.chapter, activeTab.translationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore UI when TTS stops
  useEffect(() => {
    if (!tts.isPlaying) {
      window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: false }));
    }
  }, [tts.isPlaying]);

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
    <div className="relative h-full">
      {/* Navigation header - overlay */}
      <div
        className={`absolute left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 transition-all duration-150 ease-out ${
          immersive ? "opacity-0 -translate-y-full pointer-events-none" : ""
        }`}
        style={{
          top: showTabs
            ? "calc(env(safe-area-inset-top, 0px) + 2.25rem)"
            : "env(safe-area-inset-top, 0px)",
        }}
      >
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button
              onClick={() => setShowTranslationPicker(!showTranslationPicker)}
              className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-400 transition-colors uppercase"
            >
              {activeTab.translationId}
            </button>
            {showTranslationPicker && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowTranslationPicker(false)} />
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20 min-w-[200px] py-1">
                  {translations.map((tr) => (
                    <button
                      key={tr.id}
                      onClick={() => {
                        updateTab(activeTabId, { translationId: tr.id, scrollPosition: 0 });
                        setShowTranslationPicker(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-between ${
                        activeTab.translationId === tr.id
                          ? "text-blue-600 font-medium bg-blue-50 dark:bg-blue-900/30"
                          : "text-gray-700 dark:text-gray-300"
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
          <button
            onClick={() => setShowBookPicker(true)}
            className="text-sm font-semibold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
          >
            {t(`books.${activeTab.bookId}`, { lng: translationToLang(activeTab.translationId) })}
          </button>
          <button
            onClick={() => setShowChapterPicker(true)}
            className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            {activeTab.chapter}
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
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-search"))}
            className="p-1.5 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            title={t("search.placeholder")}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <ReaderSettingsDropdown
            showCommentary={showCommentary}
            onToggleCommentary={() => setShowCommentary(!showCommentary)}
            showInterlinear={showInterlinear}
            interlinearDownloading={interlinearDownloading}
            onToggleInterlinear={() => {
              if (!showInterlinear) {
                isInterlinearDbDownloaded().then((exists) => {
                  if (exists) {
                    setShowInterlinear(true);
                    setShowCommentary(false);
                  } else {
                    setInterlinearDownloading(true);
                    downloadInterlinear().catch(() => {});
                  }
                });
              } else {
                setShowInterlinear(false);
              }
            }}
            voices={tts.voices}
          />
        </div>
      </div>

      {/* Main content */}
      <div
        ref={containerRef}
        className={`h-full flex overflow-hidden ${
          showCommentary && commentaryPosition === "bottom" ? "flex-col" : "flex-row"
        }`}
      >
        {showCommentary && commentaryPosition === "left" && (
          <>
            <div className="h-full overflow-hidden" style={{ width: `${(1 - splitRatio) * 100}%` }}>
              {commentaryReady && <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} onClose={() => setShowCommentary(false)} />}
            </div>
            <Divider direction="vertical" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
          </>
        )}
        <div
          data-tip-target="verse-area"
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
            bookName={t(`books.${activeTab.bookId}`, { lng: translationToLang(activeTab.translationId) })}
            translationLang={translationToLang(activeTab.translationId)}
            onScrollPositionChange={handleScrollChange}
            initialScrollPosition={activeTab.scrollPosition}
            targetVerse={activeTab.verse}
            ttsVerseIndex={tts.isPlaying ? tts.currentVerseIndex : undefined}
            onVersesLoaded={handleVersesLoaded}
            showInterlinear={showInterlinear}
            onSwipePrev={handlePrevChapter}
            onSwipeNext={handleNextChapter}
            prevLabel={
              activeTab.chapter > 1
                ? `${t(`books.${activeTab.bookId}`, { lng: translationToLang(activeTab.translationId) })} ${activeTab.chapter - 1}`
                : activeTab.bookId > 1
                  ? t(`books.${activeTab.bookId - 1}`, { lng: translationToLang(activeTab.translationId) })
                  : undefined
            }
            nextLabel={
              activeTab.chapter < maxChapter
                ? `${t(`books.${activeTab.bookId}`, { lng: translationToLang(activeTab.translationId) })} ${activeTab.chapter + 1}`
                : activeTab.bookId < 66
                  ? t(`books.${activeTab.bookId + 1}`, { lng: translationToLang(activeTab.translationId) })
                  : undefined
            }
          />
        </div>
        {showCommentary && commentaryPosition === "right" && (
          <>
            <Divider direction="vertical" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
            <div className="h-full overflow-hidden" style={{ width: `${(1 - splitRatio) * 100}%` }}>
              {commentaryReady && <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} onClose={() => setShowCommentary(false)} />}
            </div>
          </>
        )}
        {showCommentary && commentaryPosition === "bottom" && (
          <>
            <Divider direction="horizontal" dragging={draggingSplit} onPointerDown={handleDividerPointerDown} onPointerMove={handleDividerPointerMove} onPointerUp={handleDividerPointerUp} />
            <div className="w-full overflow-hidden" style={{ height: `${(1 - splitRatio) * 100}%` }}>
              {commentaryReady && <CommentaryPanel bookId={activeTab.bookId} chapter={activeTab.chapter} onClose={() => setShowCommentary(false)} />}
            </div>
          </>
        )}
      </div>

      {/* TTS Control Bar - overlay */}
      {tts.isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 z-10" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
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
        </div>
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
          onChangeBook={() => {
            setShowChapterPicker(false);
            setShowBookPicker(true);
          }}
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
