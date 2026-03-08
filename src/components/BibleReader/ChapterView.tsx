import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { getChapter, getParallelChapter, getParagraphBreaks, getSectionHeadings } from "../../lib/bible";
import type { SectionHeading } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useFeatureStore } from "../../stores/featureStore";
import { CORE_TRANSLATIONS } from "../../lib/downloadConfig";
import { ParagraphGroup } from "./ParagraphGroup";
import { DictionaryPopup } from "./DictionaryPopup";
import { VerseActionToolbar } from "./VerseActionToolbar";
import type { VerseClickInfo } from "./VerseItem";
import type { Verse } from "../../types/bible";

interface ParagraphData {
  verses: Verse[];
  sectionHeading?: SectionHeading;
  isFirst: boolean;
}

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
  const [paragraphVerses, setParagraphVerses] = useState<Set<number>>(new Set());
  const [sectionHeadings, setSectionHeadings] = useState<Map<number, SectionHeading>>(new Map());
  const [parallelData, setParallelData] = useState<
    Map<string, Map<number, { translationId: string; translationName: string; text: string }>>
  >(new Map());
  const parentRef = useRef<HTMLDivElement>(null);

  // Dictionary popup state
  const [dictWord, setDictWord] = useState<string | null>(null);
  const [dictSourceLang] = useState<string>("en");
  const [dictPosition, setDictPosition] = useState<{ x: number; y: number; bottom: number } | null>(null);

  // Verse selection state (multi-select)
  const [selectedVerses, setSelectedVerses] = useState<Map<number, Verse>>(new Map());

  // Bookmark store
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const loadChapterBookmarks = useBookmarkStore((s) => s.loadChapterBookmarks);

  const showParallelInline = useSettingsStore((s) => s.showParallelInline);
  const parallelTranslations = useSettingsStore((s) => s.parallelTranslations);
  const isHighlightsEnabled = useFeatureStore((s) => s.isEnabled("highlights"));

  const activeParallelIds = useMemo(
    () => parallelTranslations.filter((id) => id !== translationId),
    [parallelTranslations, translationId]
  );

  // Inline paragraph mode when no parallel translations; per-verse groups otherwise
  const hasParallel = showParallelInline && activeParallelIds.length > 0;

  const onVersesLoadedRef = useRef(onVersesLoaded);
  onVersesLoadedRef.current = onVersesLoaded;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      getChapter(translationId, bookId, chapter),
      getParagraphBreaks(bookId, chapter).catch(() => []),
      getSectionHeadings(bookId, chapter).catch(() => []),
    ]).then(([data, breaks, headings]) => {
      if (!cancelled) {
        setVerses(data);
        setParagraphVerses(new Set(breaks.map((b) => b.verse)));
        setSectionHeadings(new Map(headings.map((h) => [h.verse, h])));
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

  // Build paragraph groups — inline grouping or per-verse groups
  const paragraphGroups = useMemo(() => {
    if (verses.length === 0) return [];

    if (hasParallel) {
      // Per-verse groups: each verse is its own group
      return verses.map((verse, i) => ({
        verses: [verse],
        sectionHeading: sectionHeadings.get(verse.verse),
        isFirst: i === 0,
      }));
    }

    // Inline paragraph mode: group verses by paragraph breaks
    const groups: ParagraphData[] = [];
    let currentGroup: Verse[] = [];
    let currentHeading: SectionHeading | undefined;

    for (const verse of verses) {
      const isBreak = paragraphVerses.has(verse.verse);
      const heading = sectionHeadings.get(verse.verse);

      if ((isBreak || heading) && currentGroup.length > 0) {
        groups.push({
          verses: currentGroup,
          sectionHeading: currentHeading,
          isFirst: groups.length === 0,
        });
        currentGroup = [];
        currentHeading = undefined;
      }

      if (heading) currentHeading = heading;
      if (verse.verse === 1 && !currentHeading) {
        currentHeading = sectionHeadings.get(1);
      }
      currentGroup.push(verse);
    }

    if (currentGroup.length > 0) {
      groups.push({
        verses: currentGroup,
        sectionHeading: currentHeading,
        isFirst: groups.length === 0,
      });
    }

    return groups;
  }, [hasParallel, verses, paragraphVerses, sectionHeadings]);

  // Map verse index to paragraph group index (for TTS scrolling)
  const verseToGroupIndex = useMemo(() => {
    const map = new Map<number, number>();
    paragraphGroups.forEach((group, groupIdx) => {
      group.verses.forEach((v) => map.set(v.verse - 1, groupIdx));
    });
    return map;
  }, [paragraphGroups]);

  const virtualizer = useVirtualizer({
    count: paragraphGroups.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => hasParallel ? 80 : 120,
    overscan: 10,
  });

  useEffect(() => {
    if (initialScrollPosition != null && parentRef.current) {
      parentRef.current.scrollTop = initialScrollPosition;
    }
  }, [initialScrollPosition, verses]);

  useEffect(() => {
    if (ttsVerseIndex == null || ttsVerseIndex < 0 || ttsVerseIndex >= verses.length) return;
    const groupIdx = verseToGroupIndex.get(ttsVerseIndex);
    if (groupIdx != null) {
      virtualizer.scrollToIndex(groupIdx, { align: "center", behavior: "smooth" });
    }
  }, [ttsVerseIndex, verses.length, virtualizer, verseToGroupIndex]);

  // Scroll handler: track position + close popup + immersive mode
  const scrollState = useRef({ lastY: 0, accum: 0 });

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const handler = () => {
      const top = el.scrollTop;
      onScrollPositionChange?.(top);

      if (dictWord) {
        setDictWord(null);
        setDictPosition(null);
      }

      const s = scrollState.current;
      const delta = top - s.lastY;
      s.lastY = top;

      // Reset accumulator on direction change
      if ((delta > 0 && s.accum < 0) || (delta < 0 && s.accum > 0)) {
        s.accum = 0;
      }
      s.accum += delta;

      if (s.accum > 60) {
        window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: true }));
        s.accum = 0;
      } else if (s.accum < -60) {
        window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: false }));
        s.accum = 0;
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onScrollPositionChange, dictWord, loading]);

  // Close popups when chapter changes
  useEffect(() => {
    setDictWord(null);
    setDictPosition(null);
    setSelectedVerses(new Map());
  }, [bookId, chapter]);

  const handleVerseClick = useCallback((info: VerseClickInfo) => {
    setDictWord(null);
    setDictPosition(null);
    // Toggle verse selection
    setSelectedVerses((prev) => {
      const next = new Map(prev);
      if (next.has(info.verse.verse)) {
        next.delete(info.verse.verse);
      } else {
        next.set(info.verse.verse, info.verse);
      }
      return next;
    });
  }, []);

  const closeToolbar = useCallback(() => {
    setSelectedVerses(new Map());
  }, []);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Only clear if clicking the background, not a verse span
    const target = e.target as HTMLElement;
    if (!target.closest(".cursor-pointer")) {
      setSelectedVerses(new Map());
    }
  }, []);

  const closeDictPopup = useCallback(() => {
    setDictWord(null);
    setDictPosition(null);
  }, []);

  // Get highlight colors map for paragraph mode
  const highlightColorMap = useMemo(() => {
    if (!isHighlightsEnabled) return {};
    const map: Record<string, string | null> = {};
    for (const [key, bm] of Object.entries(bookmarks)) {
      if (bm?.color) map[key] = bm.color;
    }
    return map;
  }, [bookmarks, isHighlightsEnabled]);

  // Selected verse numbers set for ParagraphGroup
  const selectedVerseNumbers = useMemo(() => new Set(selectedVerses.keys()), [selectedVerses]);

  // Sorted selected verses for toolbar
  const sortedSelectedVerses = useMemo(
    () => [...selectedVerses.values()].sort((a, b) => a.verse - b.verse),
    [selectedVerses]
  );

  // Get TTS verse number for paragraph mode
  const ttsVerseNumber = ttsVerseIndex != null && ttsVerseIndex >= 0 && ttsVerseIndex < verses.length
    ? verses[ttsVerseIndex].verse
    : undefined;

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
    <div ref={parentRef} className="h-full overflow-auto pl-0 pr-1 py-2 relative" onClick={handleBackgroundClick}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const group = paragraphGroups[virtualItem.index];
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
              <ParagraphGroup
                verses={group.verses}
                sectionHeading={group.sectionHeading}
                isFirstParagraph={group.isFirst}
                chapterHeader={group.isFirst ? { bookName: bookName ?? "", chapter } : undefined}
                ttsVerseNumber={ttsVerseNumber}
                selectedVerses={selectedVerseNumbers}
                highlightColors={highlightColorMap}
                onVerseClick={handleVerseClick}
                parallelData={hasParallel ? parallelData : undefined}
                parallelIds={hasParallel ? activeParallelIds : undefined}
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

      {/* Verse Action Toolbar (bottom sheet) */}
      {sortedSelectedVerses.length > 0 && (
        <VerseActionToolbar
          verses={sortedSelectedVerses}
          bookName={bookName ?? `Book ${sortedSelectedVerses[0].book_id}`}
          onClose={closeToolbar}
        />
      )}
    </div>
  );
}
