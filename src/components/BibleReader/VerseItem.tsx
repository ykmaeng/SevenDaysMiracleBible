import { useCallback, useRef } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Verse } from "../../types/bible";
import type { SectionHeading } from "../../lib/bible";

export interface WordClickInfo {
  word: string;
  sourceLang: string;
  x: number;
  y: number;
  bottom: number;
}

export interface VerseClickInfo {
  verse: Verse;
  x: number;
  y: number;
  bottom: number;
}

const HIGHLIGHT_BG: Record<string, string> = {
  yellow: "bg-yellow-100/60 dark:bg-yellow-900/30",
  green: "bg-green-100/60 dark:bg-green-900/30",
  blue: "bg-blue-100/60 dark:bg-blue-900/30",
  red: "bg-red-100/60 dark:bg-red-900/30",
  purple: "bg-purple-100/60 dark:bg-purple-900/30",
};

// Map translation IDs to language codes
const TRANSLATION_LANG: Record<string, string> = {
  "sav-ko": "ko",
  korrv: "ko",
  nkrv: "ko",
  kjv: "en",
  asv: "en",
  web: "en",
  bbe: "en",
  ylt: "en",
  darby: "en",
  cuv: "zh",
  rv1909: "es",
  hebrew: "he",
  greek: "el",
  japkougo: "ja",
  gerelb: "de",
  frecrampon: "fr",
  russynodal: "ru",
  porblivre: "pt",
};

function translationToLang(translationId: string): string {
  return TRANSLATION_LANG[translationId] ?? "en";
}

interface VerseItemProps {
  verse: Verse;
  parallelVerses?: { translationId: string; translationName: string; text: string }[];
  isPlaying?: boolean;
  isSelected?: boolean;
  highlightColor?: string | null;
  onWordClick?: (info: WordClickInfo) => void;
  onVerseClick?: (info: VerseClickInfo) => void;
  sectionHeading?: SectionHeading;
  isParagraphStart?: boolean;
}

export function VerseItem({ verse, parallelVerses, isPlaying, isSelected, highlightColor, onWordClick, onVerseClick, sectionHeading, isParagraphStart }: VerseItemProps) {
  const showVerseNumbers = useSettingsStore((s) => s.showVerseNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const language = useSettingsStore((s) => s.language);
  const verseRef = useRef<HTMLDivElement>(null);

  const handleVerseClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onVerseClick) return;
      // Don't trigger if user clicked on a parallel word (dictionary)
      const target = e.target as HTMLElement;
      if (target.closest("[data-parallel-word]")) return;
      const el = verseRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      onVerseClick({
        verse,
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
      });
    },
    [onVerseClick, verse]
  );

  const handleWordClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>, sourceLang: string) => {
      if (!onWordClick) return;
      const word = (e.currentTarget.textContent ?? "").trim();
      if (!word) return;
      const rect = e.currentTarget.getBoundingClientRect();
      onWordClick({
        word,
        sourceLang,
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
      });
    },
    [onWordClick]
  );

  const renderText = (text: string, translationId: string, isParallel: boolean) => {
    if (!isParallel || !onWordClick) {
      return <span className={isParallel ? "text-gray-500 dark:text-gray-400" : "flex-1"}>{text}</span>;
    }

    const sourceLang = translationToLang(translationId);

    // Split into word tokens vs non-word tokens (using Unicode letter property for all languages)
    const tokens = text.match(/[\p{L}\p{M}'-]+|[^\p{L}\p{M}'-]+/gu) ?? [];
    return (
      <span className="text-gray-500 dark:text-gray-400">
        {tokens.map((token, i) =>
          /\p{L}/u.test(token) ? (
            <span
              key={i}
              data-parallel-word
              onClick={(e) => handleWordClick(e, sourceLang)}
              className="cursor-pointer rounded hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors"
            >
              {token}
            </span>
          ) : (
            <span key={i}>{token}</span>
          )
        )}
      </span>
    );
  };

  const highlightCls = highlightColor && HIGHLIGHT_BG[highlightColor] ? HIGHLIGHT_BG[highlightColor] : "";

  const sectionTitle = sectionHeading
    ? (language === "ko" ? sectionHeading.title_ko : sectionHeading.title_en) ?? sectionHeading.title_en
    : null;

  // Add top margin for paragraph breaks (but not for verse 1 to avoid double spacing)
  const paragraphMargin = isParagraphStart && verse.verse > 1 && !sectionHeading;

  return (
    <>
      {sectionTitle && (
        <div className={`${verse.verse > 1 ? "mt-5" : ""} mb-2 px-0.5`}>
          <h3
            className="text-gray-600 dark:text-gray-300 font-semibold"
            style={{ fontSize: `${fontSize - 1}px` }}
          >
            {sectionTitle}
          </h3>
        </div>
      )}
      {paragraphMargin && <div className="mt-3" />}
      <div
        ref={verseRef}
        onClick={handleVerseClick}
        className={`rounded px-0.5 pr-2 py-1.5 transition-colors cursor-pointer ${
          isPlaying
            ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700"
            : highlightCls || ""
        }`}
        style={{ fontSize: `${fontSize}px`, lineHeight: 1.5, fontFamily: fontFamily || undefined }}
      >
        <div className="flex">
          {showVerseNumbers && (
            <sup className="text-gray-400 dark:text-gray-500 font-medium mx-1 shrink-0 select-none" style={{ fontSize: '0.55em', top: '-0.4em' }}>{verse.verse}</sup>
          )}
          <span className={`flex-1 ${isSelected && !isPlaying ? "verse-selected" : ""}`}>{verse.text}</span>
        </div>
        {parallelVerses && parallelVerses.length > 0 && (
          <div className="ml-6 mt-0.5 space-y-0.5">
            {parallelVerses.map((pv) => (
              <div key={pv.translationId} className="flex items-baseline gap-1.5" style={{ fontSize: `${Math.max(12, fontSize - 2)}px`, lineHeight: 1.35 }}>
                <span className="text-blue-500 dark:text-blue-400 font-medium shrink-0 text-[0.7em] uppercase">{pv.translationId}</span>
                {renderText(pv.text, pv.translationId, true)}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
