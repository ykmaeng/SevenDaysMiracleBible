import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useFeatureStore } from "../../stores/featureStore";
import { useToastStore } from "../../stores/toastStore";
import type { Verse } from "../../types/bible";

const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "red", "purple"] as const;

const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  red: "bg-red-400",
  purple: "bg-purple-400",
};

interface VerseActionToolbarProps {
  verses: Verse[];
  bookName: string;
  onClose: () => void;
}

export function VerseActionToolbar({ verses, bookName, onClose }: VerseActionToolbarProps) {
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.showToast);
  const { getBookmark, addBookmark, removeBookmark, updateColor, updateNote } = useBookmarkStore();
  const [showColors, setShowColors] = useState(false);
  const [visible, setVisible] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const isBookmarksEnabled = useFeatureStore((s) => s.isEnabled("bookmarks"));
  const isHighlightsEnabled = useFeatureStore((s) => s.isEnabled("highlights"));
  const isNotesEnabled = useFeatureStore((s) => s.isEnabled("notes"));

  // Slide-in animation
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Click outside to close (but not when clicking verses in the reader)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        // Don't close if clicking inside the chapter reader (verse area)
        const target = e.target as HTMLElement;
        if (target.closest("[data-index]") || target.closest(".overflow-auto")) return;
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const firstVerse = verses[0];
  const lastVerse = verses[verses.length - 1];
  const verseRef = verses.length === 1
    ? `${bookName} ${firstVerse.chapter}:${firstVerse.verse}`
    : `${bookName} ${firstVerse.chapter}:${firstVerse.verse}-${lastVerse.verse}`;

  const fullText = verses.map((v) => v.text).join(" ");

  const handleCopy = useCallback(async () => {
    const text = `${verseRef} - ${fullText}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("verseActions.copied"), "success");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(t("verseActions.copied"), "success");
    }
    onClose();
  }, [verseRef, fullText, showToast, t, onClose]);

  const handleShare = useCallback(async () => {
    const text = `${verseRef} - ${fullText}`;
    try {
      const { shareText } = await import("@buildyourwebapp/tauri-plugin-sharesheet");
      await shareText(text);
    } catch {
      if (navigator.share) {
        try {
          await navigator.share({ text });
        } catch { /* user cancelled */ }
      } else {
        await navigator.clipboard.writeText(text);
        showToast(t("verseActions.copied"), "success");
      }
    }
    onClose();
  }, [verseRef, fullText, showToast, t, onClose]);

  const handleBookmarkToggle = useCallback(async () => {
    for (const v of verses) {
      const bm = getBookmark(v.book_id, v.chapter, v.verse);
      if (bm) {
        await removeBookmark(v.book_id, v.chapter, v.verse);
      } else {
        await addBookmark(v.book_id, v.chapter, v.verse, undefined, undefined, v.translation_id);
      }
    }
    showToast(t(verses.length === 1 ? "verseActions.bookmarkAdded" : "verseActions.bookmarkAdded"), "success");
    onClose();
  }, [verses, getBookmark, addBookmark, removeBookmark, showToast, t, onClose]);

  const handleColorSelect = useCallback(async (color: string) => {
    for (const v of verses) {
      const bm = getBookmark(v.book_id, v.chapter, v.verse);
      if (bm) {
        await updateColor(v.book_id, v.chapter, v.verse, color);
      } else {
        await addBookmark(v.book_id, v.chapter, v.verse, color, undefined, v.translation_id);
      }
    }
    onClose();
  }, [verses, getBookmark, addBookmark, updateColor, onClose]);

  const handleRemoveHighlight = useCallback(async () => {
    for (const v of verses) {
      const bm = getBookmark(v.book_id, v.chapter, v.verse);
      if (bm?.color) {
        if (bm.note) {
          await updateColor(v.book_id, v.chapter, v.verse, null);
        } else {
          await removeBookmark(v.book_id, v.chapter, v.verse);
        }
      }
    }
    onClose();
  }, [verses, getBookmark, updateColor, removeBookmark, onClose]);

  const handleNote = useCallback(async () => {
    if (verses.length !== 1) return;
    const v = verses[0];
    const bm = getBookmark(v.book_id, v.chapter, v.verse);
    const currentNote = bm?.note ?? "";
    const note = prompt(t("verseActions.notePrompt"), currentNote);
    if (note === null) return;
    if (bm) {
      await updateNote(v.book_id, v.chapter, v.verse, note || null);
    } else {
      await addBookmark(v.book_id, v.chapter, v.verse, undefined, note || undefined, v.translation_id);
    }
    if (note) showToast(t("verseActions.noteSaved"), "success");
    onClose();
  }, [verses, getBookmark, addBookmark, updateNote, showToast, t, onClose]);

  // Check if any selected verse has a bookmark/highlight
  const anyBookmarked = verses.some((v) => !!getBookmark(v.book_id, v.chapter, v.verse));
  const anyHighlighted = verses.some((v) => !!getBookmark(v.book_id, v.chapter, v.verse)?.color);

  return (
    <div
      ref={toolbarRef}
      className={`fixed bottom-0 left-0 right-0 z-[70] transition-transform duration-200 ease-out ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-600 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        {/* Action buttons */}
        <div className="flex items-center justify-around px-4 pt-2 py-2">
          <ToolbarButton icon={<CopyIcon />} label={t("verseActions.copy")} onClick={handleCopy} />
          <ToolbarButton icon={<ShareIcon />} label={t("verseActions.share")} onClick={handleShare} />
          {isBookmarksEnabled && (
            <ToolbarButton
              icon={<BookmarkIcon filled={anyBookmarked} />}
              label={t("verseActions.bookmark")}
              onClick={handleBookmarkToggle}
              active={anyBookmarked}
            />
          )}
          {isHighlightsEnabled && (
            <ToolbarButton
              icon={<HighlightIcon />}
              label={t("verseActions.highlight")}
              onClick={() => setShowColors((v) => !v)}
              active={showColors || anyHighlighted}
            />
          )}
          {isNotesEnabled && verses.length === 1 && (
            <ToolbarButton
              icon={<NoteIcon hasNote={!!getBookmark(firstVerse.book_id, firstVerse.chapter, firstVerse.verse)?.note} />}
              label={t("verseActions.note")}
              onClick={handleNote}
              active={!!getBookmark(firstVerse.book_id, firstVerse.chapter, firstVerse.verse)?.note}
            />
          )}
        </div>

        {/* Color palette */}
        {showColors && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 border-t border-gray-100 dark:border-gray-700">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={`w-7 h-7 rounded-full ${COLOR_DOT[color]} transition-transform hover:scale-125 active:scale-95`}
              />
            ))}
            {anyHighlighted && (
              <button
                onClick={handleRemoveHighlight}
                className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-2 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Safe area padding for phones with gesture bar */}
        <div className="h-[env(safe-area-inset-bottom,0px)]" />
      </div>
    </div>
  );
}

function ToolbarButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 ${
        active ? "text-blue-500 dark:text-blue-400" : "text-gray-600 dark:text-gray-300"
      }`}
      title={label}
    >
      {icon}
      <span className="text-[10px] leading-none">{label}</span>
    </button>
  );
}

function CopyIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}

function NoteIcon({ hasNote }: { hasNote: boolean }) {
  return hasNote ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V7.875L14.25 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75-3.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
