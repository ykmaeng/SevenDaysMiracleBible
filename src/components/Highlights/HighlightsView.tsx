import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAllHighlights, type BookmarkWithText } from "../../lib/bookmarks";
import { useBookmarkStore } from "../../stores/bookmarkStore";
import { useSettingsStore } from "../../stores/settingsStore";

const COLORS = ["yellow", "green", "blue", "red", "purple"] as const;

const COLOR_BG: Record<string, string> = {
  yellow: "bg-yellow-400",
  green: "bg-green-400",
  blue: "bg-blue-400",
  red: "bg-red-400",
  purple: "bg-purple-400",
};

const COLOR_TAB_ACTIVE: Record<string, string> = {
  yellow: "border-yellow-400 text-yellow-600 dark:text-yellow-400",
  green: "border-green-400 text-green-600 dark:text-green-400",
  blue: "border-blue-400 text-blue-600 dark:text-blue-400",
  red: "border-red-400 text-red-600 dark:text-red-400",
  purple: "border-purple-400 text-purple-600 dark:text-purple-400",
};

interface HighlightsViewProps {
  onClose: () => void;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = String(d.getFullYear()).slice(2);
  return `${y}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function HighlightsView({ onClose, onNavigate }: HighlightsViewProps) {
  const { t } = useTranslation();
  const defaultTranslation = useSettingsStore((s) => s.defaultTranslation);
  const removeBookmark = useBookmarkStore((s) => s.removeBookmark);
  const updateColor = useBookmarkStore((s) => s.updateColor);
  const [highlights, setHighlights] = useState<BookmarkWithText[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeColor, setActiveColor] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    getAllHighlights(defaultTranslation).then((data) => {
      setHighlights(data);
      setLoading(false);
    });
  }, [defaultTranslation]);

  const filtered = activeColor === "all"
    ? highlights
    : highlights.filter((h) => h.color === activeColor);

  // Group by book
  const groups: { bookId: number; items: BookmarkWithText[] }[] = [];
  const groupMap = new Map<number, BookmarkWithText[]>();
  for (const h of filtered) {
    let arr = groupMap.get(h.book_id);
    if (!arr) {
      arr = [];
      groupMap.set(h.book_id, arr);
      groups.push({ bookId: h.book_id, items: arr });
    }
    arr.push(h);
  }

  const handleRemove = async (bm: BookmarkWithText) => {
    if (bm.note) {
      await updateColor(bm.book_id, bm.chapter, bm.verse, null);
    } else {
      await removeBookmark(bm.book_id, bm.chapter, bm.verse);
    }
    setHighlights((prev) => prev.filter((h) => h.id !== bm.id));
    if (expandedId === bm.id) setExpandedId(null);
  };

  // Count per color
  const colorCounts: Record<string, number> = {};
  for (const h of highlights) {
    if (h.color) colorCounts[h.color] = (colorCounts[h.color] ?? 0) + 1;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("features.highlights")}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Color tabs */}
        <div className="flex px-4 gap-1 pb-2">
          <button
            onClick={() => setActiveColor("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeColor === "all"
                ? "bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900"
                : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            {t("features.all")} {highlights.length}
          </button>
          {COLORS.map((color) => {
            const count = colorCounts[color] ?? 0;
            if (count === 0) return null;
            return (
              <button
                key={color}
                onClick={() => setActiveColor(color)}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  activeColor === color
                    ? COLOR_TAB_ACTIVE[color] + " border-current"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${COLOR_BG[color]}`} />
                {count}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <div className="animate-pulse">Loading...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
          {t("features.noHighlights")}
        </div>
      ) : (
        <div className="p-4 space-y-5">
          {groups.map((group) => (
            <div key={group.bookId}>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                {t(`books.${group.bookId}`)}
              </div>
              <div className="space-y-1">
                {group.items.map((h) => {
                  const expanded = expandedId === h.id;
                  return (
                    <div key={h.id} className="rounded-lg overflow-hidden">
                      <button
                        onClick={() => setExpandedId(expanded ? null : h.id)}
                        className="w-full text-left px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 min-w-0"
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${COLOR_BG[h.color!]}`} />
                        <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0">
                          {h.chapter}:{h.verse}
                        </span>
                        {h.text && (
                          <span className={`text-xs text-gray-500 dark:text-gray-400 min-w-0 ${expanded ? "" : "truncate"}`}>
                            {h.text}
                          </span>
                        )}
                      </button>
                      {expanded && (
                        <div className="flex items-center gap-2 px-3 pb-2">
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">
                            {formatDate(h.created_at)}
                          </span>
                          {h.translation_id && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 uppercase">
                              {h.translation_id}
                            </span>
                          )}
                          <div className="flex items-center gap-1 ml-auto shrink-0">
                            <button
                              onClick={() => handleRemove(h)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                            <button
                              onClick={() => onNavigate(h.book_id, h.chapter, h.verse)}
                              className="p-1.5 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
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
