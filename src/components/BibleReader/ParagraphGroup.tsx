import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Verse, InterlinearWord } from "../../types/bible";
import type { SectionHeading } from "../../lib/bible";
import type { VerseClickInfo, WordClickInfo } from "./VerseItem";
import { decodeMorphology } from "../../lib/morphology";

const TRANSLATION_LANG: Record<string, string> = {
  "sav-ko": "ko",
  cunpss: "zh",
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
  expandedWordKey?: string | null;
  onExpandWord?: (key: string | null) => void;
  noteMap?: Record<string, string>;
  onNoteSave?: (verse: Verse, note: string) => void;
  editingNoteKey?: string | null;
  onEditingNoteKeyChange?: (key: string | null) => void;
  translationLang?: string;
  onWordClick?: (info: WordClickInfo) => void;
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
  expandedWordKey,
  onExpandWord,
  noteMap,
  onNoteSave,
  editingNoteKey,
  onEditingNoteKeyChange,
  translationLang,
  onWordClick,
}: ParagraphGroupProps) {
  const showVerseNumbers = useSettingsStore((s) => s.showVerseNumbers);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const appLanguage = useSettingsStore((s) => s.language);
  const lang = translationLang ?? appLanguage;

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

  const handleWordSpanClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>, sourceLang: string) => {
      if (!onWordClick) return;
      e.stopPropagation();
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

  const sectionTitle = sectionHeading
    ? (lang === "ko" ? sectionHeading.title_ko : sectionHeading.title_en) ?? sectionHeading.title_en
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
            <span
              key={verse.verse}
              onClick={(e) => {
                const target = e.target as HTMLElement;
                if (target.closest("[data-parallel-word]") || target.closest("[data-note-input]")) return;
                handleVerseSpanClick(e, verse);
              }}
              className="cursor-pointer"
            >
              <span
                className={`rounded-sm transition-colors ${
                  isPlaying
                    ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700"
                    : isSelected
                    ? "bg-blue-100/70 dark:bg-blue-500/30"
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
                    const sourceLang = translationToLang(pv.translationId);
                    return (
                      <div key={tid} className="text-gray-500 dark:text-gray-400">
                        <sup className="text-blue-500 dark:text-blue-400 font-medium select-none mx-1" style={{ fontSize: '0.55em' }}>
                          {pv.translationId.toUpperCase()}
                        </sup>
                        {onWordClick ? (
                          (pv.text.match(/[\p{L}\p{M}'-]+|[^\p{L}\p{M}'-]+/gu) ?? []).map((token, i) =>
                            /\p{L}/u.test(token) ? (
                              <span
                                key={i}
                                data-parallel-word
                                onClick={(e) => handleWordSpanClick(e, sourceLang)}
                                className="cursor-pointer rounded hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/40 dark:hover:text-blue-300 transition-colors"
                              >
                                {token}
                              </span>
                            ) : (
                              <span key={i}>{token}</span>
                            )
                          )
                        ) : pv.text}
                      </div>
                    );
                  })}
                </div>
              )}
              {/* Interlinear Greek words */}
              {interlinearData?.has(verse.verse) && (
                <InlineInterlinear words={interlinearData.get(verse.verse)!} fontSize={fontSize} verseNum={verse.verse} expandedKey={expandedWordKey ?? null} setExpandedKey={onExpandWord ?? (() => {})} bookId={verse.book_id} />
              )}
              {/* Inline note */}
              {noteMap && (() => {
                const key = `${verse.book_id}:${verse.chapter}:${verse.verse}`;
                const noteText = noteMap[key] ?? "";
                if (!noteText && editingNoteKey !== key) return null;
                return (
                  <InlineNote
                    text={noteText}
                    editing={editingNoteKey === key}
                    onEditingChange={(e) => onEditingNoteKeyChange?.(e ? key : null)}
                    onSave={onNoteSave ? (note) => onNoteSave(verse, note) : undefined}
                  />
                );
              })()}
              {!hasParallel && !interlinearData?.has(verse.verse) && !noteMap && " "}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Inline editable note */
function InlineNote({ text, editing, onEditingChange, onSave }: {
  text: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onSave?: (note: string) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(text);

  // Sync draft when entering edit mode or text changes
  const prevEditing = useRef(false);
  if (editing && !prevEditing.current) {
    // Just entered edit mode — reset draft
    if (draft !== text) setDraft(text);
  }
  prevEditing.current = editing;

  if (editing) {
    return (
      <div data-note-input className="ml-2 mt-1 mb-1.5 pl-2 border-l-2 border-amber-400 dark:border-amber-500 flex items-end gap-1" onClick={(e) => e.stopPropagation()}>
        <textarea
          autoFocus
          ref={(el) => {
            if (el && !el.dataset.init) {
              el.dataset.init = "1";
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
              el.selectionStart = el.selectionEnd = el.value.length;
            }
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("features.notePlaceholder")}
          rows={2}
          className="flex-1 text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded px-2 py-1.5 resize-none outline-none focus:ring-1 focus:ring-amber-400 italic"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = el.scrollHeight + "px";
          }}
        />
        <button
          className="shrink-0 text-[11px] text-white bg-amber-500 dark:bg-amber-600 rounded px-2 py-1.5 font-medium"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const trimmed = draft.trim();
            if (trimmed !== text) onSave?.(trimmed);
            onEditingChange(false);
          }}
        >{t("features.noteSave")}</button>
      </div>
    );
  }

  if (text) {
    return (
      <div className="ml-2 mt-1 mb-1.5 pl-2 border-l-2 border-amber-300 dark:border-amber-600">
        <p className="text-xs text-amber-700 dark:text-amber-400 italic whitespace-pre-wrap">{text}</p>
      </div>
    );
  }

  return null;
}

/** Compact inline interlinear word display */
function InlineInterlinear({ words, fontSize, verseNum, expandedKey, setExpandedKey, bookId }: { words: InterlinearWord[]; fontSize: number; verseNum: number; expandedKey: string | null; setExpandedKey: (k: string | null) => void; bookId: number }) {
  const isHebrew = bookId <= 39;
  return (
    <div className="ml-2 mt-1.5 mb-2">
      <div className={`flex flex-wrap gap-0.5 ${isHebrew ? "flex-row-reverse" : ""}`}>
        {words.map((w) => {
          const key = `${verseNum}:${w.word_pos}`;
          const isExpanded = expandedKey === key;
          return (
            <button
              key={w.word_pos}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedKey(isExpanded ? null : key);
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
      {expandedKey?.startsWith(`${verseNum}:`) && (() => {
        const wp = parseInt(expandedKey.split(":")[1]);
        const w = words.find((w) => w.word_pos === wp);
        if (!w) return null;
        const morph = decodeMorphology(w.morphology);
        return (
          <div className={`mt-1.5 p-2 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs space-y-1 ${isHebrew ? "text-right" : ""}`}>
            <div className={`flex items-baseline gap-2 ${isHebrew ? "flex-row-reverse" : ""}`}>
              <span className={`text-base font-serif text-gray-900 dark:text-gray-100 ${isHebrew ? "dir-rtl" : ""}`}>{w.greek_word}</span>
              <span className="text-gray-400 italic">{w.transliteration}</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono text-[10px]">{w.strongs}</span>
            </div>
            <div className={`text-gray-500 dark:text-gray-400 ${isHebrew ? "flex flex-row-reverse gap-3 justify-end" : ""}`}>
              <span><span className="text-gray-400 mr-1">어근</span> <span dir={isHebrew ? "rtl" : undefined}>{w.lexeme}</span></span>
              <span><span className="text-gray-400 mr-1">형태</span> {morph.details}</span>
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
