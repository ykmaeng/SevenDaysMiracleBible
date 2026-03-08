import { useCallback, useRef } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Verse } from "../../types/bible";
import type { SectionHeading } from "../../lib/bible";
import type { VerseClickInfo } from "./VerseItem";

const HIGHLIGHT_BG: Record<string, string> = {
  yellow: "bg-yellow-100/60 dark:bg-yellow-800/50",
  green: "bg-green-100/60 dark:bg-green-800/50",
  blue: "bg-blue-100/60 dark:bg-blue-800/50",
  red: "bg-red-100/60 dark:bg-red-800/50",
  purple: "bg-purple-100/60 dark:bg-purple-800/50",
};

interface ParallelVerseData {
  translationId: string;
  translationName: string;
  text: string;
}

interface ParagraphGroupProps {
  verses: Verse[];
  sectionHeading?: SectionHeading;
  isFirstParagraph?: boolean;
  chapterHeader?: { bookName: string; chapter: number };
  ttsVerseNumber?: number;
  selectedVerses?: Set<number>;
  highlightColors?: Record<string, string | null>;
  onVerseClick?: (info: VerseClickInfo) => void;
  parallelData?: Map<string, Map<number, ParallelVerseData>>;
  parallelIds?: string[];
}

export function ParagraphGroup({
  verses,
  sectionHeading,
  isFirstParagraph,
  chapterHeader,
  ttsVerseNumber,
  selectedVerses,
  highlightColors,
  onVerseClick,
  parallelData,
  parallelIds,
}: ParagraphGroupProps) {
  const showVerseNumbers = useSettingsStore((s) => s.showVerseNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const language = useSettingsStore((s) => s.language);

  const groupRef = useRef<HTMLDivElement>(null);
  const hasParallel = parallelIds && parallelIds.length > 0 && parallelData;

  const handleVerseSpanClick = useCallback(
    (e: React.MouseEvent, verse: Verse) => {
      if (!onVerseClick) return;
      const span = e.currentTarget as HTMLElement;
      const rect = span.getBoundingClientRect();
      onVerseClick({
        verse,
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
      });
    },
    [onVerseClick]
  );

  const sectionTitle = sectionHeading
    ? (language === "ko" ? sectionHeading.title_ko : sectionHeading.title_en) ?? sectionHeading.title_en
    : null;

  return (
    <div ref={groupRef}>
      {chapterHeader && isFirstParagraph && (
        <div className="text-center pt-8 pb-8" style={{ fontFamily: fontFamily || undefined }}>
          <span className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {chapterHeader.bookName}
          </span>
          <span className="text-3xl font-black text-gray-800 dark:text-gray-100 ml-2">
            {chapterHeader.chapter}
          </span>
        </div>
      )}
      {sectionTitle && (
        <div className={`${!isFirstParagraph ? "mt-5" : ""} mb-2 pl-3`}>
          <h3
            className="text-gray-400 dark:text-gray-500 font-bold"
            style={{ fontSize: `${fontSize - 1}px`, fontFamily: fontFamily || undefined }}
          >
            {sectionTitle}
          </h3>
        </div>
      )}
      {!isFirstParagraph && !sectionTitle && <div className="mt-3" />}
      <div
        className="pl-4 pr-2 py-1"
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.8, fontFamily: fontFamily || undefined }}
      >
        {verses.map((verse) => {
          const isPlaying = ttsVerseNumber === verse.verse;
          const isSelected = selectedVerses?.has(verse.verse) ?? false;
          const hlColor = highlightColors?.[`${verse.book_id}:${verse.chapter}:${verse.verse}`];
          const hlCls = hlColor && HIGHLIGHT_BG[hlColor] ? HIGHLIGHT_BG[hlColor] : "";

          return (
            <span key={verse.verse}>
              <span
                onClick={(e) => handleVerseSpanClick(e, verse)}
                className={`cursor-pointer rounded-sm transition-colors ${
                  isPlaying
                    ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700"
                    : isSelected
                    ? "bg-blue-100/70 dark:bg-blue-800/50"
                    : hlCls
                }`}
              >
                {showVerseNumbers && (
                  <sup className="text-gray-400 dark:text-gray-500 font-medium select-none mx-1" style={{ fontSize: '0.65em' }}>
                    {verse.verse}
                  </sup>
                )}
                {verse.text}
              </span>
              {/* Parallel translations — each on new line */}
              {hasParallel && (
                <div className="ml-2 mt-2 mb-2 space-y-2" style={{ fontSize: `${fontSize}px`, lineHeight: 1.5 }}>
                  {parallelIds!.map((tid) => {
                    const pv = parallelData!.get(tid)?.get(verse.verse);
                    if (!pv) return null;
                    return (
                      <div key={tid} className="text-gray-500 dark:text-gray-400">
                        <sup className="text-blue-500 dark:text-blue-400 font-medium select-none mx-1" style={{ fontSize: '0.55em' }}>
                          {pv.translationId.toUpperCase()}
                        </sup>
                        {pv.text}
                      </div>
                    );
                  })}
                </div>
              )}
              {!hasParallel && " "}
            </span>
          );
        })}
      </div>
    </div>
  );
}
