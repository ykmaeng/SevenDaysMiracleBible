import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBooks } from "../../lib/bible";
import type { Book } from "../../types/bible";

interface BookPickerProps {
  onSelect: (bookId: number) => void;
  onClose: () => void;
}

export function BookPicker({ onSelect, onClose }: BookPickerProps) {
  const { t } = useTranslation();
  const [books, setBooks] = useState<Book[]>([]);

  useEffect(() => {
    getBooks().then(setBooks);
  }, []);

  const otBooks = books.filter((b) => b.testament === "OT");
  const ntBooks = books.filter((b) => b.testament === "NT");

  const renderGrid = (bookList: Book[]) => (
    <div className="grid grid-cols-4 gap-1.5">
      {bookList.map((book) => (
        <button
          key={book.id}
          onClick={() => onSelect(book.id)}
          className="text-xs py-2 px-1 rounded-lg bg-gray-50 hover:bg-blue-50 hover:text-blue-700 transition-colors text-center truncate"
        >
          {t(`books.${book.id}`)}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto">
      <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t("reader.selectBook")}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            {t("nav.oldTestament")}
          </h3>
          {renderGrid(otBooks)}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            {t("nav.newTestament")}
          </h3>
          {renderGrid(ntBooks)}
        </section>
      </div>
    </div>
  );
}
