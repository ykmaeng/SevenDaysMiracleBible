import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { getChapter, getParallelChapter } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import { CORE_TRANSLATIONS } from "../../lib/downloadConfig";
import { VerseItem } from "./VerseItem";
import { DictionaryPopup } from "./DictionaryPopup";
import type { WordClickInfo } from "./VerseItem";
import type { Verse } from "../../types/bible";

interface ChapterViewProps {
  translationId: string;
  bookId: number;
  chapter: number;
  onScrollPositionChange?: (position: number) => void;
  initialScrollPosition?: number;
  ttsVerseIndex?: number;
  onVersesLoaded?: (verses: Verse[]) => void;
}

export function ChapterView({
  translationId,
  bookId,
  chapter,
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

  const showParallelInline = useSettingsStore((s) => s.showParallelInline);
  const parallelTranslations = useSettingsStore((s) => s.parallelTranslations);

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
      // Close dictionary popup on scroll
      if (dictWord) {
        setDictWord(null);
        setDictPosition(null);
      }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onScrollPositionChange, dictWord]);

  // Close popup when chapter changes
  useEffect(() => {
    setDictWord(null);
    setDictPosition(null);
  }, [bookId, chapter]);

  const handleWordClick = useCallback((info: WordClickInfo) => {
    setDictWord(info.word);
    setDictSourceLang(info.sourceLang);
    setDictPosition({ x: info.x, y: info.y, bottom: info.bottom });
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
                onWordClick={handleWordClick}
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
    </div>
  );
}
