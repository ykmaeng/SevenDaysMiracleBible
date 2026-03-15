import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAllNotes } from "../../lib/bookmarks";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import type { Bookmark } from "../../types/bible";

interface NotesViewProps {
  onClose: () => void;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
}

export function NotesView({ onClose, onNavigate }: NotesViewProps) {
  const { t } = useTranslation();
  const updateNote = useBookmarkStore((s) => s.updateNote);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
  const [notes, setNotes] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    getAllNotes().then((data) => {
      setNotes(data);
      setLoading(false);
    });
  }, []);

  const handleDelete = async (bm: Bookmark) => {
    if (!confirm(t("features.noteDeleteConfirm"))) return;
    await updateNote(bm.book_id, bm.chapter, bm.verse, null);
    if (!bm.color && !bm.is_bookmarked) {
      await removeBookmark(bm.book_id, bm.chapter, bm.verse);
    }
    setNotes((prev) => prev.filter((n) => n.id !== bm.id));
    if (expandedId === bm.id) setExpandedId(null);
  };

  // Group by book
  const groups: { bookId: number; items: Bookmark[] }[] = [];
  const groupMap = new Map<number, Bookmark[]>();
  for (const n of notes) {
    let arr = groupMap.get(n.book_id);
    if (!arr) {
      arr = [];
      groupMap.set(n.book_id, arr);
      groups.push({ bookId: n.book_id, items: arr });
    }
    arr.push(n);
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("features.notes")}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setExpandAll(!expandAll); setExpandedId(null); }}
              className={`p-1.5 rounded-md transition-colors ${
                expandAll
                  ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
          {t("features.noNotes")}
        </div>
      ) : (
        <div className="p-4 space-y-3">
          {groups.map((group) => (
            <div key={group.bookId}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {t(`books.${group.bookId}`)}
              </div>
              <div className="space-y-0">
                {group.items.map((n) => {
                  const expanded = expandAll || expandedId === n.id;
                  return (
                    <div key={n.id} className="rounded-lg overflow-hidden px-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0 py-2">
                          {n.chapter}:{n.verse}
                        </span>
                        <div className="flex-1 min-w-0">
                          <button
                            onClick={() => setExpandedId(expanded ? null : n.id)}
                            className="w-full text-left py-2"
                          >
                            <span className={`text-sm text-amber-700 dark:text-amber-400 italic block min-w-0 ${expanded ? "" : "truncate"}`}>
                              {n.note}
                            </span>
                          </button>
                          {expanded && n.text && (
                            <div className="flex items-center gap-2 pb-2 min-w-0">
                              <span className="text-xs text-gray-400 dark:text-gray-500 min-w-0 truncate flex-1">
                                {n.text}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => handleDelete(n)}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                  title={t("download.delete")}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => onNavigate(n.book_id, n.chapter, n.verse)}
                                  className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  title={t("features.goToVerse")}
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          )}
                          {expanded && !n.text && (
                            <div className="flex items-center gap-1 pb-2 justify-end">
                              <button
                                onClick={() => handleDelete(n)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title={t("download.delete")}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                              <button
                                onClick={() => onNavigate(n.book_id, n.chapter, n.verse)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                title={t("features.goToVerse")}
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
