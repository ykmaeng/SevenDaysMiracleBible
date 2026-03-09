import { useEffect, useState, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { getChapterInterlinear } from "../../lib/bible";
import { InterlinearVerse } from "./InterlinearVerse";
import type { InterlinearWord } from "../../types/bible";

interface InterlinearPanelProps {
  bookId: number;
  chapter: number;
  bookName: string;
  onClose: () => void;
}

export function InterlinearPanel({ bookId, chapter, bookName, onClose }: InterlinearPanelProps) {
  const { t } = useTranslation();
  const [data, setData] = useState<Map<number, InterlinearWord[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getChapterInterlinear(bookId, chapter)
      .then((result) => {
        console.log("[Interlinear] loaded", result.size, "verses for", bookId, chapter);
        setData(result);
      })
      .catch((err) => {
        console.error("[Interlinear] error:", err);
        setData(new Map());
      })
      .finally(() => setLoading(false));
  }, [bookId, chapter]);

  const verseEntries = useMemo(() => {
    return [...data.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  const virtualizer = useVirtualizer({
    count: verseEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  const isNT = bookId >= 40 && bookId <= 66;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-lg font-semibold truncate">
            {t("interlinear.title")}
          </h2>
          <span className="text-sm text-gray-400 dark:text-gray-500 shrink-0">
            {bookName} {chapter}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      {!isNT ? (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 text-sm px-6 text-center">
          <p>{t("interlinear.otNotAvailable")}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center flex-1 text-gray-400">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : verseEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-gray-400 text-sm px-6 text-center">
          <p>{t("interlinear.noData")}</p>
        </div>
      ) : (
        <div ref={parentRef} className="flex-1 overflow-auto px-3 py-2">
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const [verseNum, words] = verseEntries[virtualItem.index];
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
                  <InterlinearVerse verseNum={verseNum} words={words} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
