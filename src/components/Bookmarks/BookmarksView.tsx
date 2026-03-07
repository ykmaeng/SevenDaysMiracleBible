import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAllBookmarks, type BookmarkWithText } from "../../lib/bookmarks";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useSettingsStore } from "../../stores/settingsStore";

const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  red: "bg-red-400",
  purple: "bg-purple-400",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = String(d.getFullYear()).slice(2);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}.${m}.${day}`;
}

interface BookmarksViewProps {
  onClose: () => void;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
}

interface BookGroup {
  bookId: number;
  bookmarks: BookmarkWithText[];
}

export function BookmarksView({ onClose, onNavigate }: BookmarksViewProps) {
  const { t } = useTranslation();
  const defaultTranslation = useSettingsStore((s) => s.defaultTranslation);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
  const [bookmarks, setBookmarks] = useState<BookmarkWithText[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    getAllBookmarks(defaultTranslation).then((data) => {
      setBookmarks(data);
      setLoading(false);
    });
  }, [defaultTranslation]);

  const handleDelete = async (bm: BookmarkWithText) => {
    await removeBookmark(bm.book_id, bm.chapter, bm.verse);
    setBookmarks((prev) => prev.filter((b) => b.id !== bm.id));
    if (expandedId === bm.id) setExpandedId(null);
  };

  // Group by book
  const groups: BookGroup[] = [];
  const groupMap = new Map<number, BookGroup>();
  for (const bm of bookmarks) {
    let group = groupMap.get(bm.book_id);
    if (!group) {
      group = { bookId: bm.book_id, bookmarks: [] };
      groupMap.set(bm.book_id, group);
      groups.push(group);
    }
    group.bookmarks.push(bm);
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-10">
        <h2 className="text-lg font-semibold">{t("features.bookmarks")}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
          {t("features.noBookmarks")}
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {groups.map((group) => (
            <div key={group.bookId}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {t(`books.${group.bookId}`)}
              </div>
              <div className="space-y-1">
                {group.bookmarks.map((bm) => {
                  const expanded = expandedId === bm.id;
                  return (
                    <div key={bm.id} className="rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedId(expanded ? null : bm.id)}
                        className="w-full text-left px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 min-w-0"
                      >
                        {bm.color && (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_DOT[bm.color] ?? ""}`} />
                        )}
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
                          {bm.chapter}:{bm.verse}
                        </span>
                        {bm.text && (
                          <span className={`text-xs text-gray-500 dark:text-gray-400 min-w-0 ${expanded ? "" : "truncate"}`}>
                            {bm.text}
                          </span>
                        )}
                      </button>
                      {expanded && (
                        <div className="flex items-center gap-2 px-3 pb-2">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {formatDate(bm.created_at)}
                          </span>
                          {bm.translation_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase">
                              {bm.translation_id}
                            </span>
                          )}
                          {bm.note && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic flex-1 min-w-0 truncate">
                              {bm.note}
                            </p>
                          )}
                          <div className="flex items-center gap-1 ml-auto shrink-0">
                            <button
                              onClick={() => handleDelete(bm)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title={t("download.delete")}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onNavigate(bm.book_id, bm.chapter, bm.verse)}
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
