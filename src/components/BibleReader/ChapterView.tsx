import { useEffect, useState, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTranslation } from "react-i18next";
import { getChapter } from "../../lib/bible";
import { VerseItem } from "./VerseItem";
import type { Verse } from "../../types/bible";

interface ChapterViewProps {
  translationId: string;
  bookId: number;
  chapter: number;
  selectedVerse?: number;
  onSelectVerse: (verse: number) => void;
  onScrollPositionChange?: (position: number) => void;
  initialScrollPosition?: number;
}

export function ChapterView({
  translationId,
  bookId,
  chapter,
  selectedVerse,
  onSelectVerse,
  onScrollPositionChange,
  initialScrollPosition,
}: ChapterViewProps) {
  const { t } = useTranslation();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

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

  const virtualizer = useVirtualizer({
    count: verses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
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
    <div ref={parentRef} className="h-full overflow-auto px-4 py-2">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const verse = verses[virtualItem.index];
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
                isSelected={selectedVerse === verse.verse}
                onSelect={onSelectVerse}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
