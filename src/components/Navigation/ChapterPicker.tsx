import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBooks } from "../../lib/bible";
import type { Book } from "../../types/bible";

interface ChapterPickerProps {
  bookId: number;
  onSelect: (chapter: number) => void;
  onClose: () => void;
}

export function ChapterPicker({ bookId, onSelect, onClose }: ChapterPickerProps) {
  const { t } = useTranslation();
  const [book, setBook] = useState<Book | null>(null);

  useEffect(() => {
    getBooks().then((books) => {
      setBook(books.find((b) => b.id === bookId) ?? null);
    });
  }, [bookId]);

  if (!book) return null;

  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-auto">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          {t(`books.${bookId}`)} - {t("reader.selectChapter")}
        </h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-6 gap-2">
          {chapters.map((ch) => (
            <button
              key={ch}
              onClick={() => onSelect(ch)}
              className="aspect-square flex items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors text-sm font-medium"
            >
              {ch}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
