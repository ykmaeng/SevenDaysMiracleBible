import { useCallback, useRef, useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Verse, InterlinearWord } from "../../types/bible";
import type { SectionHeading } from "../../lib/bible";
import type { VerseClickInfo } from "./VerseItem";
import { decodeMorphology } from "../../lib/morphology";

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
  interlinearData?: Map<number, InterlinearWord[]>;
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
  interlinearData,
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
              {/* Interlinear Greek words */}
              {interlinearData?.has(verse.verse) && (
                <InlineInterlinear words={interlinearData.get(verse.verse)!} fontSize={fontSize} />
              )}
              {!hasParallel && !interlinearData?.has(verse.verse) && " "}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Compact inline interlinear word display */
function InlineInterlinear({ words, fontSize }: { words: InterlinearWord[]; fontSize: number }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="ml-2 mt-1.5 mb-2">
      <div className="flex flex-wrap gap-0.5">
        {words.map((w) => {
          const isExpanded = expanded === w.word_pos;
          return (
            <button
              key={w.word_pos}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(isExpanded ? null : w.word_pos);
              }}
              className={`inline-flex flex-col items-center px-1 py-0.5 rounded transition-all ${
                isExpanded
                  ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-600"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              <span className="text-gray-800 dark:text-gray-200 font-serif" style={{ fontSize: `${fontSize - 1}px` }}>
                {w.greek_word}
              </span>
              <span className="text-blue-600 dark:text-blue-400 leading-tight" style={{ fontSize: '9px' }}>
                {cleanGloss(w.gloss)}
              </span>
            </button>
          );
        })}
      </div>
      {expanded != null && (() => {
        const w = words.find((w) => w.word_pos === expanded);
        if (!w) return null;
        const morph = decodeMorphology(w.morphology);
        return (
          <div className="mt-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-base font-serif text-gray-900 dark:text-gray-100">{w.greek_word}</span>
              <span className="text-gray-400 italic">{w.transliteration}</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px]">{w.strongs}</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              <span className="text-gray-400 mr-1">어근</span> {w.lexeme}
              <span className="text-gray-400 ml-3 mr-1">형태</span> {morph.details}
            </div>
            <div className="text-gray-700 dark:text-gray-300 font-medium">
              {cleanGloss(w.gloss)}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function cleanGloss(gloss: string): string {
  return gloss.replace(/\[([^\]]*)\]/g, "$1").trim();
}
