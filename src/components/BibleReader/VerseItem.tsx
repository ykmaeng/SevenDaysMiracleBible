import { useCallback } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Verse } from "../../types/bible";

export interface WordClickInfo {
  word: string;
  sourceLang: string;
  x: number;
  y: number;
  bottom: number;
}

// Map translation IDs to language codes
const TRANSLATION_LANG: Record<string, string> = {
  "ai-ko": "ko",
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
  onWordClick?: (info: WordClickInfo) => void;
}

export function VerseItem({ verse, parallelVerses, isPlaying, onWordClick }: VerseItemProps) {
  const showVerseNumbers = useSettingsStore((s) => s.showVerseNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);

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

  return (
    <div
      className={`rounded px-0.5 py-0.5 transition-colors ${
        isPlaying
          ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700"
          : ""
      }`}
      style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
    >
      <div className="flex">
        {showVerseNumbers && (
          <span className="text-gray-400 dark:text-gray-500 font-medium mr-2 shrink-0 select-none" style={{ fontSize: '0.8em', minWidth: '1.5em', textAlign: 'right' }}>{verse.verse}</span>
        )}
        <span className="flex-1">{verse.text}</span>
      </div>
      {parallelVerses && parallelVerses.length > 0 && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {parallelVerses.map((pv) => (
            <div key={pv.translationId} className="flex items-baseline gap-1.5" style={{ fontSize: `${Math.max(12, fontSize - 2)}px`, lineHeight: 1.6 }}>
              <span className="text-blue-500 dark:text-blue-400 font-medium shrink-0 text-[0.7em] uppercase">{pv.translationId}</span>
              {renderText(pv.text, pv.translationId, true)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
