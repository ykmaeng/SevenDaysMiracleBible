import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { getChapter, getParallelChapter, getParagraphBreaks, getSectionHeadings, getChapterInterlinear } from "../../lib/bible";
import type { SectionHeading } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useFeatureStore } from "../../stores/featureStore";
import { BUNDLED_TRANSLATIONS } from "../../lib/downloadConfig";
import { ParagraphGroup } from "./ParagraphGroup";
import { DictionaryPopup } from "./DictionaryPopup";
import { VerseActionToolbar } from "./VerseActionToolbar";
import type { VerseClickInfo } from "./VerseItem";
import type { Verse, InterlinearWord } from "../../types/bible";

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
  showInterlinear?: boolean;
  translationLang?: string;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
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
  showInterlinear,
  translationLang,
  onSwipePrev,
  onSwipeNext,
}: ChapterViewProps) {
  const { t } = useTranslation();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [paragraphVerses, setParagraphVerses] = useState<Set<number>>(new Set());
  const [sectionHeadings, setSectionHeadings] = useState<Map<number, SectionHeading>>(new Map());
  const [parallelData, setParallelData] = useState<
    Map<string, Map<number, { translationId: string; translationName: string; text: string }>>
  >(new Map());
  const [interlinearData, setInterlinearData] = useState<Map<number, InterlinearWord[]>>(new Map());
  const [expandedWordKey, setExpandedWordKey] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Dictionary popup state
  const [dictWord, setDictWord] = useState<string | null>(null);
  const [dictSourceLang] = useState<string>("en");
  const [dictPosition, setDictPosition] = useState<{ x: number; y: number; bottom: number } | null>(null);

  // Verse selection state (multi-select)
  const [selectedVerses, setSelectedVerses] = useState<Map<number, Verse>>(new Map());
  const [noteInputOpen, setNoteInputOpen] = useState(false);

  // Bookmark store
  const bookmarks = useBookmarkStore((s) => s.bookmarks);
  const loadChapterBookmarks = useBookmarkStore((s) => s.loadChapterBookmarks);

  const showParallelInline = useSettingsStore((s) => s.showParallelInline);
  const versePerLine = useSettingsStore((s) => s.versePerLine);
  const parallelTranslations = useSettingsStore((s) => s.parallelTranslations);
  const showNotes = useSettingsStore((s) => s.showNotes);
  const isHighlightsEnabled = useFeatureStore((s) => s.isEnabled("highlights"));
  const isNotesEnabled = useFeatureStore((s) => s.isEnabled("notes"));
  const updateNote = useBookmarkStore((s) => s.updateNote);
  const addBookmark = useBookmarkStore((s) => s.addBookmark);

  const activeParallelIds = useMemo(
    () => parallelTranslations.filter((id) => id !== translationId),
    [parallelTranslations, translationId]
  );

  // Per-verse mode when verse-per-line is on OR parallel translations are active
  const hasParallel = showParallelInline && activeParallelIds.length > 0;
  const perVerseMode = versePerLine || hasParallel;

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
    }).catch(() => {
      if (!cancelled) setLoading(false);
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
    }).catch(() => {
      if (!cancelled) setParallelData(new Map());
    });

    return () => {
      cancelled = true;
    };
  }, [showParallelInline, activeParallelIds, bookId, chapter]);

  // Load interlinear data for NT chapters
  useEffect(() => {
    if (!showInterlinear) {
      setInterlinearData(new Map());
      return;
    }
    let cancelled = false;
    getChapterInterlinear(bookId, chapter).then((data) => {
      if (!cancelled) setInterlinearData(data);
    }).catch(() => setInterlinearData(new Map()));
    return () => { cancelled = true; };
  }, [showInterlinear, bookId, chapter]);

  // Load bookmarks for current chapter
  useEffect(() => {
    loadChapterBookmarks(bookId, chapter);
  }, [bookId, chapter, loadChapterBookmarks]);

  // Build paragraph groups — inline grouping or per-verse groups
  const paragraphGroups = useMemo(() => {
    if (verses.length === 0) return [];

    if (perVerseMode) {
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
  }, [perVerseMode, verses, paragraphVerses, sectionHeadings]);

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
    estimateSize: () => perVerseMode ? 80 : 120,
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
  const ttsActiveRef = useRef(ttsVerseIndex != null);
  ttsActiveRef.current = ttsVerseIndex != null;
  const interlinearActiveRef = useRef(showInterlinear ?? false);
  interlinearActiveRef.current = showInterlinear ?? false;

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;

    const handler = () => {
      const top = el.scrollTop;
      if (!ttsActiveRef.current) {
        onScrollPositionChange?.(top);
      }

      if (dictWord) {
        setDictWord(null);
        setDictPosition(null);
      }

      const s = scrollState.current;
      const delta = top - s.lastY;
      s.lastY = top;

      // Skip immersive mode logic during TTS or interlinear (layout shifts cause false triggers)
      if (ttsActiveRef.current || interlinearActiveRef.current) return;

      // Skip if near bottom (prevent flickering from layout shifts)
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;

      // Reset accumulator on direction change
      if ((delta > 0 && s.accum < 0) || (delta < 0 && s.accum > 0)) {
        s.accum = 0;
      }
      s.accum += delta;

      if (s.accum > 10) {
        window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: true }));
        s.accum = 0;
      } else if (s.accum < -10 && !nearBottom) {
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
    setExpandedWordKey(null);
    setNoteInputOpen(false);
  }, [bookId, chapter]);

  // Listen for note input focus request
  useEffect(() => {
    const handler = () => setNoteInputOpen(true);
    window.addEventListener("focus-note-input", handler);
    return () => window.removeEventListener("focus-note-input", handler);
  }, []);

  // Android back button: dismiss toolbar/note input
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (noteInputOpen || selectedVerses.size > 0) {
        setNoteInputOpen(false);
        setSelectedVerses(new Map());
        detail.handled = true;
      }
    };
    window.addEventListener("dismiss-popup", handler);
    return () => window.removeEventListener("dismiss-popup", handler);
  }, [noteInputOpen, selectedVerses]);

  const handleVerseClick = useCallback((info: VerseClickInfo) => {
    setDictWord(null);
    setDictPosition(null);
    setNoteInputOpen(false);
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
    setNoteInputOpen(false);
  }, []);

  const handleBackgroundClick = useCallback((e: React.MouseEvent) => {
    // Only clear if clicking the background, not a verse span or toolbar
    const target = e.target as HTMLElement;
    if (target.closest("[data-toolbar]") || target.closest(".cursor-pointer")) return;
    if (selectedVerses.size === 0) {
      // No verses selected — toggle immersive mode
      window.dispatchEvent(new CustomEvent("reader-fullscreen", { detail: "toggle" }));
    } else {
      setSelectedVerses(new Map());
    }
  }, [selectedVerses.size]);

  const closeDictPopup = useCallback(() => {
    setDictWord(null);
    setDictPosition(null);
  }, []);

  // Swipe gesture for chapter navigation
  const touchRef = useRef<{ startX: number; startY: number; startTime: number } | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchRef.current = { startX: touch.clientX, startY: touch.clientY, startTime: Date.now() };
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchRef.current.startX;
    const dy = touch.clientY - touchRef.current.startY;
    const dt = Date.now() - touchRef.current.startTime;
    touchRef.current = null;
    // Require: horizontal > 80px, more horizontal than vertical, within 500ms
    if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 500) {
      if (dx > 0) onSwipePrev?.();
      else onSwipeNext?.();
    }
  }, [onSwipePrev, onSwipeNext]);

  // Get highlight colors map for paragraph mode
  const highlightColorMap = useMemo(() => {
    if (!isHighlightsEnabled) return {};
    const map: Record<string, string | null> = {};
    for (const [key, bm] of Object.entries(bookmarks)) {
      if (bm?.color) map[key] = bm.color;
    }
    return map;
  }, [bookmarks, isHighlightsEnabled]);

  // Notes map for inline display
  const noteMap = useMemo(() => {
    if (!isNotesEnabled || !showNotes) return undefined;
    const map: Record<string, string> = {};
    for (const [key, bm] of Object.entries(bookmarks)) {
      if (bm?.note) map[key] = bm.note;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [bookmarks, isNotesEnabled, showNotes]);

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
    const needsDownload = !BUNDLED_TRANSLATIONS.has(translationId);
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
    <div ref={parentRef} className="h-full overflow-auto pl-0 pr-1 py-2 relative" onClick={handleBackgroundClick} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
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
                interlinearData={showInterlinear && interlinearData.size > 0 ? interlinearData : undefined}
                expandedWordKey={expandedWordKey}
                onExpandWord={setExpandedWordKey}
                noteMap={noteMap}
                translationLang={translationLang}
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

      {/* Note input bar */}
      {isNotesEnabled && showNotes && noteInputOpen && sortedSelectedVerses.length === 1 && (
        <NoteInputBar
          verse={sortedSelectedVerses[0]}
          existingNote={bookmarks[`${sortedSelectedVerses[0].book_id}:${sortedSelectedVerses[0].chapter}:${sortedSelectedVerses[0].verse}`]?.note ?? null}
          onSave={async (note) => {
            const v = sortedSelectedVerses[0];
            const bm = bookmarks[`${v.book_id}:${v.chapter}:${v.verse}`];
            if (bm) {
              await updateNote(v.book_id, v.chapter, v.verse, note || null);
            } else if (note) {
              await addBookmark(v.book_id, v.chapter, v.verse, undefined, note, v.translation_id, undefined, v.text);
            }
            loadChapterBookmarks(v.book_id, v.chapter);
          }}
        />
      )}
    </div>
  );
}

function NoteInputBar({
  verse,
  existingNote,
  onSave,
}: {
  verse: Verse;
  existingNote: string | null;
  onSave: (note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(existingNote ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const noteBarRef = useRef<HTMLDivElement>(null);

  // Sync when verse or existing note changes
  useEffect(() => {
    setText(existingNote ?? "");
  }, [verse.book_id, verse.chapter, verse.verse, existingNote]);

  // Position above keyboard (mobile) or toolbar + auto-focus
  useEffect(() => {
    const el = noteBarRef.current;
    if (!el) return;

    const updatePosition = () => {
      const vv = window.visualViewport;
      if (vv) {
        // On mobile, visualViewport shrinks when keyboard opens
        const keyboardOffset = window.innerHeight - vv.height - vv.offsetTop;
        const toolbar = document.querySelector<HTMLElement>("[data-toolbar]");
        const toolbarH = keyboardOffset > 50 ? 0 : (toolbar?.offsetHeight ?? 0);
        el.style.bottom = Math.max(keyboardOffset, 0) + toolbarH + "px";
      } else {
        const toolbar = document.querySelector<HTMLElement>("[data-toolbar]");
        el.style.bottom = toolbar ? toolbar.offsetHeight + "px" : "0px";
      }
    };

    updatePosition();
    inputRef.current?.focus();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", updatePosition);
    vv?.addEventListener("scroll", updatePosition);
    return () => {
      vv?.removeEventListener("resize", updatePosition);
      vv?.removeEventListener("scroll", updatePosition);
    };
  }, []);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    await onSave(text.trim());
    setSaving(false);
  };

  return (
    <div className="fixed left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-t-xl shadow-[0_-2px_10px_rgba(0,0,0,0.08)] px-3 py-2 z-[80]" ref={noteBarRef}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {verse.verse}{t("nav.verse")} {t("verseActions.note")}
        </span>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("features.notePlaceholder")}
          rows={1}
          className="flex-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg px-3 py-2 resize-none outline-none focus:ring-1 focus:ring-blue-400"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
        >
          {t("features.noteSave")}
        </button>
      </div>
    </div>
  );
}
