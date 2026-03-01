import { useEffect, useState, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { getChapter, getParallelChapter } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import { VerseItem } from "./VerseItem";
import type { Verse } from "../../types/bible";

interface ChapterViewProps {
  translationId: string;
  bookId: number;
  chapter: number;
  onScrollPositionChange?: (position: number) => void;
  initialScrollPosition?: number;
}

export function ChapterView({
  translationId,
  bookId,
  chapter,
  onScrollPositionChange,
  initialScrollPosition,
}: ChapterViewProps) {
  const { t } = useTranslation();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [parallelData, setParallelData] = useState<
    Map<string, Map<number, { translationId: string; translationName: string; text: string }>>
  >(new Map());
  const parentRef = useRef<HTMLDivElement>(null);

  const showParallelInline = useSettingsStore((s) => s.showParallelInline);
  const parallelTranslations = useSettingsStore((s) => s.parallelTranslations);

  const activeParallelIds = useMemo(
    () => parallelTranslations.filter((id) => id !== translationId),
    [parallelTranslations, translationId]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getChapter(translationId, bookId, chapter).then((data) => {
      if (!cancelled) {
        setVerses(data);
        setLoading(false);
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
    if (initialScrollPosition && parentRef.current) {
      parentRef.current.scrollTop = initialScrollPosition;
    }
  }, [initialScrollPosition, verses]);

  useEffect(() => {
    const el = parentRef.current;
    if (!el || !onScrollPositionChange) return;

    const handler = () => onScrollPositionChange(el.scrollTop);
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [onScrollPositionChange]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (verses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        {t("reader.noContent")}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto px-2 py-2">
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
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
