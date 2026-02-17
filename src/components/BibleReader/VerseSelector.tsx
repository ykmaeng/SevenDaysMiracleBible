import { useTranslation } from "react-i18next";

interface VerseSelectorProps {
  bookId: number;
  chapter: number;
  verse: number;
  onClose: () => void;
  children: React.ReactNode;
}

export function VerseSelector({ bookId, chapter, verse, onClose, children }: VerseSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
      <div className="bg-white rounded-t-2xl shadow-2xl border-t border-gray-200 max-h-[60vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">
            {t(`books.${bookId}`)} {chapter}:{verse}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
      <div className="fixed inset-0 bg-black/20 -z-10" onClick={onClose} />
    </div>
  );
}
