import { useState, useCallback } from "react";
import type { InterlinearWord } from "../../types/bible";
import { decodeMorphology, getMorphLabel } from "../../lib/morphology";
import { useSettingsStore } from "../../stores/settingsStore";

interface InterlinearVerseProps {
  verseNum: number;
  words: InterlinearWord[];
}

export function InterlinearVerse({ verseNum, words }: InterlinearVerseProps) {
  const [selectedWord, setSelectedWord] = useState<InterlinearWord | null>(null);
  const fontSize = useSettingsStore((s) => s.fontSize);

  const handleWordClick = useCallback((word: InterlinearWord) => {
    setSelectedWord((prev) => (prev?.word_pos === word.word_pos ? null : word));
  }, []);

  return (
    <div className="mb-4">
      {/* Verse number */}
      <div className="flex flex-wrap items-start gap-1">
        <sup className="text-gray-400 dark:text-gray-500 font-medium mr-0.5 shrink-0 select-none text-[0.6em] mt-2">
          {verseNum}
        </sup>

        {/* Word cards */}
        {words.map((word) => {
          const isSelected = selectedWord?.word_pos === word.word_pos;
          return (
            <button
              key={word.word_pos}
              onClick={() => handleWordClick(word)}
              className={`flex flex-col items-center px-1.5 py-1 rounded-lg transition-all min-w-0 ${
                isSelected
                  ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-300 dark:ring-blue-600"
                  : "hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {/* Greek word */}
              <span
                className="text-gray-900 dark:text-gray-100 font-serif"
                style={{ fontSize: `${fontSize + 2}px` }}
              >
                {word.greek_word}
              </span>
              {/* Transliteration */}
              <span className="text-[10px] text-gray-400 dark:text-gray-500 italic">
                {word.transliteration}
              </span>
              {/* Gloss */}
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium leading-tight text-center">
                {cleanGloss(word.gloss)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded word detail */}
      {selectedWord && (
        <WordDetail word={selectedWord} onClose={() => setSelectedWord(null)} />
      )}
    </div>
  );
}

function WordDetail({ word, onClose }: { word: InterlinearWord; onClose: () => void }) {
  const morph = decodeMorphology(word.morphology);
  const morphLabel = getMorphLabel(word.morphology);

  return (
    <div className="mt-2 mx-1 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-serif text-gray-900 dark:text-gray-100">
            {word.greek_word}
          </span>
          <span className="text-gray-400 dark:text-gray-500 italic text-xs">
            {word.transliteration}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-1.5">
        {/* Lexeme */}
        <DetailRow label="어근 (Lexeme)" value={word.lexeme} />
        {/* Strong's number */}
        <DetailRow
          label="스트롱 번호"
          value={word.strongs}
          valueClass="text-blue-600 dark:text-blue-400 font-mono"
        />
        {/* Morphology */}
        <DetailRow label="형태론" value={`${morphLabel} (${morph.short})`} />
        <DetailRow label="상세" value={morph.details} valueClass="text-xs text-gray-500 dark:text-gray-400" />
        {/* Gloss */}
        <DetailRow label="뜻" value={cleanGloss(word.gloss)} valueClass="font-medium" />
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 w-20 text-right">
        {label}
      </span>
      <span className={`text-gray-700 dark:text-gray-300 ${valueClass}`}>{value}</span>
    </div>
  );
}

/** Remove brackets from gloss text like "[The] book" → "The book" */
function cleanGloss(gloss: string): string {
  return gloss.replace(/\[([^\]]*)\]/g, "$1").trim();
}
