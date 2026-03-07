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
  verse: Verse;
  bookName: string;
  position: { x: number; y: number; bottom: number };
  containerRect: DOMRect;
  onClose: () => void;
}

export function VerseActionToolbar({ verse, bookName, position, containerRect, onClose }: VerseActionToolbarProps) {
  const { t } = useTranslation();
  const showToast = useToastStore((s) => s.showToast);
  const { getBookmark, addBookmark, removeBookmark, updateColor, updateNote } = useBookmarkStore();
  const [showColors, setShowColors] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const isBookmarksEnabled = useFeatureStore((s) => s.isEnabled("bookmarks"));
  const isHighlightsEnabled = useFeatureStore((s) => s.isEnabled("highlights"));
  const isNotesEnabled = useFeatureStore((s) => s.isEnabled("notes"));

  const bookmark = getBookmark(verse.book_id, verse.chapter, verse.verse);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const verseRef = `${bookName} ${verse.chapter}:${verse.verse}`;

  const handleCopy = useCallback(async () => {
    const text = `${verseRef} - ${verse.text}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(t("verseActions.copied"), "success");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast(t("verseActions.copied"), "success");
    }
    onClose();
  }, [verseRef, verse.text, showToast, t, onClose]);

  const handleShare = useCallback(async () => {
    const text = `${verseRef} - ${verse.text}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast(t("verseActions.copied"), "success");
    }
    onClose();
  }, [verseRef, verse.text, showToast, t, onClose]);

  const handleBookmarkToggle = useCallback(async () => {
    if (bookmark) {
      await removeBookmark(verse.book_id, verse.chapter, verse.verse);
      showToast(t("verseActions.bookmarkRemoved"), "success");
    } else {
      await addBookmark(verse.book_id, verse.chapter, verse.verse);
      showToast(t("verseActions.bookmarkAdded"), "success");
    }
    onClose();
  }, [bookmark, verse, addBookmark, removeBookmark, showToast, t, onClose]);

  const handleColorSelect = useCallback(async (color: string) => {
    if (bookmark) {
      await updateColor(verse.book_id, verse.chapter, verse.verse, color);
    } else {
      await addBookmark(verse.book_id, verse.chapter, verse.verse, color);
    }
    onClose();
  }, [bookmark, verse, addBookmark, updateColor, onClose]);

  const handleRemoveHighlight = useCallback(async () => {
    if (bookmark?.color) {
      if (bookmark.note) {
        // Keep bookmark, just remove color
        await updateColor(verse.book_id, verse.chapter, verse.verse, null);
      } else {
        // No note either, remove entirely
        await removeBookmark(verse.book_id, verse.chapter, verse.verse);
      }
    }
    onClose();
  }, [bookmark, verse, updateColor, removeBookmark, onClose]);

  const handleNote = useCallback(async () => {
    const currentNote = bookmark?.note ?? "";
    const note = prompt(t("verseActions.notePrompt"), currentNote);
    if (note === null) return; // cancelled
    if (bookmark) {
      await updateNote(verse.book_id, verse.chapter, verse.verse, note || null);
    } else {
      await addBookmark(verse.book_id, verse.chapter, verse.verse, undefined, note || undefined);
    }
    if (note) showToast(t("verseActions.noteSaved"), "success");
    onClose();
  }, [bookmark, verse, addBookmark, updateNote, showToast, t, onClose]);

  // Position: fixed, above or below the verse
  const toolbarWidth = 240;
  const showAbove = (window.innerHeight - position.bottom) < 120;

  let left = position.x - toolbarWidth / 2;
  left = Math.max(containerRect.left + 4, Math.min(left, containerRect.right - toolbarWidth - 4));

  const style: React.CSSProperties = {
    position: "fixed",
    left: `${left}px`,
    width: `${toolbarWidth}px`,
    zIndex: 70,
    ...(showAbove
      ? { bottom: `${window.innerHeight - position.y + 6}px` }
      : { top: `${position.bottom + 6}px` }),
  };

  return (
    <div ref={toolbarRef} style={style} className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
      {/* Row 1: Action buttons */}
      <div className="flex items-center justify-around px-2 py-1.5">
        <ToolbarButton icon={<CopyIcon />} label={t("verseActions.copy")} onClick={handleCopy} />
        <ToolbarButton icon={<ShareIcon />} label={t("verseActions.share")} onClick={handleShare} />
        {isBookmarksEnabled && (
          <ToolbarButton
            icon={<BookmarkIcon filled={!!bookmark} />}
            label={t("verseActions.bookmark")}
            onClick={handleBookmarkToggle}
            active={!!bookmark}
          />
        )}
        {isHighlightsEnabled && (
          <ToolbarButton
            icon={<HighlightIcon />}
            label={t("verseActions.highlight")}
            onClick={() => setShowColors((v) => !v)}
            active={showColors || !!bookmark?.color}
          />
        )}
        {isNotesEnabled && (
          <ToolbarButton
            icon={<NoteIcon hasNote={!!bookmark?.note} />}
            label={t("verseActions.note")}
            onClick={handleNote}
            active={!!bookmark?.note}
          />
        )}
      </div>

      {/* Row 2: Color palette */}
      {showColors && (
        <div className="flex items-center justify-center gap-2.5 px-3 py-2 border-t border-gray-100 dark:border-gray-700">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorSelect(color)}
              className={`w-6 h-6 rounded-full ${COLOR_DOT[color]} transition-transform hover:scale-125 ${
                bookmark?.color === color ? "ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-800" : ""
              }`}
            />
          ))}
          {bookmark?.color && (
            <button
              onClick={handleRemoveHighlight}
              className="text-xs text-gray-400 hover:text-red-500 dark:hover:text-red-400 ml-1 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 ${
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
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  );
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
    </svg>
  );
}

function NoteIcon({ hasNote }: { hasNote: boolean }) {
  return hasNote ? (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V7.875L14.25 1.5H5.625zM7.5 15a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5A.75.75 0 017.5 15zm.75-3.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z" clipRule="evenodd" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
