import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAllBookmarks, type BookmarkWithText } from "../../lib/bookmarks";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useToastStore } from "../../stores/toastStore";
import type { BookmarkLabel } from "../../types/bible";

const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  red: "bg-red-400",
  purple: "bg-purple-400",
};

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
  const { labels, labelsLoaded, loadLabels, renameLabel, deleteLabel } = useBookmarkStore();
  const showToast = useToastStore((s) => s.showToast);
  const [bookmarks, setBookmarks] = useState<BookmarkWithText[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const [filterLabelId, setFilterLabelId] = useState<number | "all">("all");
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [editingLabelId, setEditingLabelId] = useState<number | null>(null);
  const [editingLabelName, setEditingLabelName] = useState("");

  useEffect(() => {
    if (!labelsLoaded) loadLabels();
  }, [labelsLoaded, loadLabels]);

  useEffect(() => {
    setLoading(true);
    const labelId = filterLabelId === "all" ? undefined : filterLabelId;
    getAllBookmarks(defaultTranslation, labelId).then((data) => {
      setBookmarks(data);
      setLoading(false);
    });
  }, [defaultTranslation, filterLabelId]);

  const handleDelete = async (bm: BookmarkWithText) => {
    await removeBookmark(bm.book_id, bm.chapter, bm.verse);
    setBookmarks((prev) => prev.filter((b) => b.id !== bm.id));
    if (expandedId === bm.id) setExpandedId(null);
  };

  const handleRenameLabel = async (label: BookmarkLabel) => {
    const name = editingLabelName.trim();
    if (!name || name === label.name) {
      setEditingLabelId(null);
      return;
    }
    await renameLabel(label.id, name);
    setEditingLabelId(null);
  };

  const handleDeleteLabel = async (label: BookmarkLabel) => {
    if (!confirm(t("features.deleteLabelConfirm"))) return;
    await deleteLabel(label.id);
    showToast(t("features.labelDeleted"), "success");
    if (filterLabelId === label.id) setFilterLabelId("all");
  };

  // Get label name by id
  const labelMap = new Map(labels.map((l) => [l.id, l]));

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
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("features.bookmarks")}</h2>
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
                {expandAll ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                )}
              </svg>
            </button>
            <button
              onClick={() => setShowLabelManager(!showLabelManager)}
              className={`p-1.5 rounded-md transition-colors ${
                showLabelManager
                  ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              title={t("features.manageLabels")}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
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

        {/* Label filter chips */}
        {labels.length > 0 && !showLabelManager && (
          <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterLabelId("all")}
              className={`text-xs px-3 py-1 rounded-full shrink-0 transition-colors ${
                filterLabelId === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
              }`}
            >
              {t("features.all")}
            </button>
            {labels.map((label) => (
              <button
                key={label.id}
                onClick={() => setFilterLabelId(label.id)}
                className={`text-xs px-3 py-1 rounded-full shrink-0 transition-colors ${
                  filterLabelId === label.id
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                {label.name}
              </button>
            ))}
          </div>
        )}

        {/* Label manager */}
        {showLabelManager && (
          <div className="px-4 pb-3 space-y-1">
            {labels.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">{t("features.noLabel")}</p>
            ) : (
              labels.map((label) => (
                <div key={label.id} className="flex items-center gap-2 py-1.5">
                  {editingLabelId === label.id ? (
                    <input
                      autoFocus
                      value={editingLabelName}
                      onChange={(e) => setEditingLabelName(e.target.value)}
                      onBlur={() => handleRenameLabel(label)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameLabel(label);
                        if (e.key === "Escape") setEditingLabelId(null);
                      }}
                      className="flex-1 text-sm px-2 py-0.5 rounded border border-blue-400 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none"
                    />
                  ) : (
                    <span className="flex-1 text-sm text-gray-700 dark:text-gray-300">{label.name}</span>
                  )}
                  <button
                    onClick={() => {
                      setEditingLabelId(label.id);
                      setEditingLabelName(label.name);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                    title={t("features.renameLabel")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteLabel(label)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title={t("features.deleteLabel")}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
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
        <div className="p-4 space-y-3">
          {groups.map((group) => (
            <div key={group.bookId}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {t(`books.${group.bookId}`)}
              </div>
              <div className="space-y-0">
                {group.bookmarks.map((bm) => {
                  const expanded = expandAll || expandedId === bm.id;
                  const label = bm.label_id ? labelMap.get(bm.label_id) : null;
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
                          <span className={`text-sm text-gray-600 dark:text-gray-300 min-w-0 ${expanded ? "" : "truncate"}`}>
                            {bm.text}
                          </span>
                        )}
                      </button>
                      {expanded && (
                        <div className="flex items-center gap-2 px-3 pb-2 flex-wrap">
                          {bm.translation_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase">
                              {bm.translation_id}
                            </span>
                          )}
                          {label && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                              {label.name}
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
