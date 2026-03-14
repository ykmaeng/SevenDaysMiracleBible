import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { searchVerses } from "../../lib/bible";
import { useTabStore } from "../../stores/tabStore";
import type { Verse } from "../../types/bible";

interface SearchViewProps {
  onClose: () => void;
  onNavigate: (bookId: number, chapter: number, verse: number) => void;
}

export function SearchView({ onClose, onNavigate }: SearchViewProps) {
  const { t } = useTranslation();
  const { tabs, activeTabId } = useTabStore();
  const translationId = tabs.find((t) => t.id === activeTabId)?.translationId ?? "kjv";
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<Verse[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setResults([]);
        setSearched(false);
        return;
      }
      setLoading(true);
      try {
        // FTS5 MATCH: wrap each word with * for prefix matching
        const ftsQuery = trimmed
          .split(/\s+/)
          .map((w) => `"${w}"*`)
          .join(" ");
        const rows = await searchVerses(translationId, ftsQuery, 200);
        setResults(rows);
      } catch {
        setResults([]);
      }
      setSearched(true);
      setLoading(false);
    },
    [translationId]
  );

  const handleChange = (value: string) => {
    setSearchText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  // Group results by book_id
  const groups: { bookId: number; items: Verse[] }[] = [];
  const groupMap = new Map<number, Verse[]>();
  for (const v of results) {
    let arr = groupMap.get(v.book_id);
    if (!arr) {
      arr = [];
      groupMap.set(v.book_id, arr);
      groups.push({ bookId: v.book_id, items: arr });
    }
    arr.push(v);
  }

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const words = query.trim().split(/\s+/).filter(Boolean);
    const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const regex = new RegExp(`(${pattern})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <strong key={i} className="text-blue-600 dark:text-blue-400 font-semibold">
          {part}
        </strong>
      ) : (
        part
      )
    );
  };

  return (
    <div className="h-full overflow-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="px-4 py-3 flex items-center gap-3">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={searchText}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={t("search.placeholder")}
            className="flex-1 bg-transparent outline-none text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <div className="animate-pulse">...</div>
        </div>
      ) : !searched ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
          {t("search.placeholder")}
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm">
          {t("search.noResults")}
        </div>
      ) : (
        <div className="p-4">
          <div className="text-xs text-gray-400 mb-3">
            {t("search.results", { count: results.length })}
          </div>
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.bookId}>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                  {t(`books.${group.bookId}`)}
                </div>
                <div className="space-y-0">
                  {group.items.map((v) => (
                    <button
                      key={`${v.book_id}-${v.chapter}-${v.verse}`}
                      onClick={() => onNavigate(v.book_id, v.chapter, v.verse)}
                      className="w-full text-left px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg flex items-start gap-2 min-w-0"
                    >
                      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                        {v.chapter}:{v.verse}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-gray-300 min-w-0 line-clamp-2">
                        {highlightMatch(v.text, searchText)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
