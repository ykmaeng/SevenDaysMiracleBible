import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { getChapter, getParallelChapter } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useFeatureStore } from "../../stores/featureStore";
import { CORE_TRANSLATIONS } from "../../lib/downloadConfig";
import { VerseItem } from "./VerseItem";
import { DictionaryPopup } from "./DictionaryPopup";
import { VerseActionToolbar } from "./VerseActionToolbar";
import type { WordClickInfo, VerseClickInfo } from "./VerseItem";
import type { Verse } from "../../types/bible";

interface ChapterViewProps {
  translationId: string;
  bookId: number;
  chapter: number;
  bookName?: string;
  onScrollPositionChange?: (position: number) => void;
  initialScrollPosition?: number;
  ttsVerseIndex?: number;
  onVersesLoaded?: (verses: Verse[]) => void;
}

export function ChapterView({
  translationId,
  bookId,
  chapter,
  bookName,
  onScrollPositionChange,
  initialScrollPosition,
  ttsVerseIndex,
  onVersesLoaded,
}: ChapterViewProps) {
  const { t } = useTranslation();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [parallelData, setParallelData] = useState<
    Map<string, Map<number, { translationId: string; translationName: string; text: string }>>
  >(new Map());
  const parentRef = useRef<HTMLDivElement>(null);

  // Dictionary popup state
  const [dictWord, setDictWord] = useState<string | null>(null);
  const [dictSourceLang, setDictSourceLang] = useState<string>("en");
  const [dictPosition, setDictPosition] = useState<{ x: number; y: number; bottom: number } | null>(null);

  // Verse action toolbar state
  const [selectedVerse, setSelectedVerse] = useState<Verse | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState<{ x: number; y: number; bottom: number } | null>(null);

  // Bookmark store
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const loadChapterBookmarks = useBookmarkStore((s) => s.loadChapterBookmarks);

  const showParallelInline = useSettingsStore((s) => s.showParallelInline);
  const parallelTranslations = useSettingsStore((s) => s.parallelTranslations);
  const showDictionary = useSettingsStore((s) => s.showDictionary);
  const isHighlightsEnabled = useFeatureStore((s) => s.isEnabled("highlights"));

  const activeParallelIds = useMemo(
    () => parallelTranslations.filter((id) => id !== translationId),
    [parallelTranslations, translationId]
  );

  const onVersesLoadedRef = useRef(onVersesLoaded);
  onVersesLoadedRef.current = onVersesLoaded;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getChapter(translationId, bookId, chapter).then((data) => {
      if (!cancelled) {
        setVerses(data);
        setLoading(false);
        onVersesLoadedRef.current?.(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [translationId, bookId, chapter]);

  useEffect(() => {
    if (!showParallelInline || activeParallelIds.length === 0) {
      setParallelData(new Map());
      return;
    }

    let cancelled = false;
    getParallelChapter(activeParallelIds, bookId, chapter).then((data) => {
      if (!cancelled) {
        setParallelData(data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [showParallelInline, activeParallelIds, bookId, chapter]);

  // Load bookmarks for current chapter
  useEffect(() => {
    loadChapterBookmarks(bookId, chapter);
  }, [bookId, chapter, loadChapterBookmarks]);

  const virtualizer = useVirtualizer({
    count: verses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (showParallelInline && activeParallelIds.length > 0 ? 80 : 48),
    overscan: 10,
  });

  useEffect(() => {
    if (initialScrollPosition != null && parentRef.current) {
      parentRef.current.scrollTop = initialScrollPosition;
    }
  }, [initialScrollPosition, verses]);

  useEffect(() => {
    if (ttsVerseIndex != null && ttsVerseIndex >= 0 && ttsVerseIndex < verses.length) {
      virtualizer.scrollToIndex(ttsVerseIndex, { align: "center", behavior: "smooth" });
    }
  }, [ttsVerseIndex, verses.length, virtualizer]);

  // Scroll handler: track position + close popup
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const handler = () => {
      onScrollPositionChange?.(el.scrollTop);
      // Close popups on scroll
      if (dictWord) {
        setDictWord(null);
        setDictPosition(null);
      }
      if (selectedVerse) {
        setSelectedVerse(null);
        setToolbarPosition(null);
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onScrollPositionChange, dictWord, selectedVerse]);

  // Close popups when chapter changes
  useEffect(() => {
    setDictWord(null);
    setDictPosition(null);
    setSelectedVerse(null);
    setToolbarPosition(null);
  }, [bookId, chapter]);

  const handleWordClick = useCallback((info: WordClickInfo) => {
    // Close toolbar when opening dictionary
    setSelectedVerse(null);
    setToolbarPosition(null);
    setDictWord(info.word);
    setDictSourceLang(info.sourceLang);
    setDictPosition({ x: info.x, y: info.y, bottom: info.bottom });
  }, []);

  // Track last selected verse + close timestamp so toggle works with toolbar's mousedown
  const lastSelectedVerseRef = useRef<number | null>(null);
  const lastCloseTimeRef = useRef<number>(0);

  const handleVerseClick = useCallback((info: VerseClickInfo) => {
    setDictWord(null);
    setDictPosition(null);
    // If toolbar was just closed by mousedown on this same verse, don't reopen
    const justClosed = Date.now() - lastCloseTimeRef.current < 300;
    if (justClosed && lastSelectedVerseRef.current === info.verse.verse) {
      lastSelectedVerseRef.current = null;
      return;
    }
    // Toggle: if same verse clicked, close toolbar
    if (lastSelectedVerseRef.current === info.verse.verse) {
      setSelectedVerse(null);
      setToolbarPosition(null);
      lastSelectedVerseRef.current = null;
    } else {
      setSelectedVerse(info.verse);
      setToolbarPosition({ x: info.x, y: info.y, bottom: info.bottom });
      lastSelectedVerseRef.current = info.verse.verse;
    }
  }, []);

  const closeToolbar = useCallback(() => {
    setSelectedVerse(null);
    setToolbarPosition(null);
    lastCloseTimeRef.current = Date.now();
  }, []);

  const closeDictPopup = useCallback(() => {
    setDictWord(null);
    setDictPosition(null);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (verses.length === 0) {
    const needsDownload = !CORE_TRANSLATIONS.has(translationId);
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <p className="text-gray-400">{t("reader.noContent")}</p>
        {needsDownload && (
          <button
            onClick={() => window.dispatchEvent(new Event("open-settings"))}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            {t("settings.downloads")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto pl-0 pr-1 py-2 relative">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const verse = verses[virtualItem.index];
          const pVerses =
            showParallelInline && activeParallelIds.length > 0
              ? activeParallelIds
                  .map((tid) => parallelData.get(tid)?.get(verse.verse))
                  .filter(Boolean) as { translationId: string; translationName: string; text: string }[]
              : undefined;

          return (
            <div
              key={virtualItem.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
            >
              <VerseItem
                verse={verse}
                parallelVerses={pVerses}
                isPlaying={ttsVerseIndex === virtualItem.index}
                isSelected={selectedVerse?.verse === verse.verse}
                highlightColor={isHighlightsEnabled ? bookmarks[`${verse.book_id}:${verse.chapter}:${verse.verse}`]?.color : undefined}
                onWordClick={showDictionary ? handleWordClick : undefined}
                onVerseClick={handleVerseClick}
              />
            </div>
          );
        })}
      </div>

      {/* Dictionary Popup */}
      {dictWord && dictPosition && parentRef.current && (
        <DictionaryPopup
          word={dictWord}
          sourceLang={dictSourceLang}
          position={dictPosition}
          containerRect={parentRef.current.getBoundingClientRect()}
          onClose={closeDictPopup}
        />
      )}

      {/* Verse Action Toolbar */}
      {selectedVerse && toolbarPosition && parentRef.current && (
        <VerseActionToolbar
          verse={selectedVerse}
          bookName={bookName ?? `Book ${selectedVerse.book_id}`}
          position={toolbarPosition}
          containerRect={parentRef.current.getBoundingClientRect()}
          onClose={closeToolbar}
        />
      )}
    </div>
  );
}
