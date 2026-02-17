import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getChapterCommentary } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Commentary } from "../../types/bible";

interface CommentaryPanelProps {
  bookId: number;
  chapter: number;
}

export function CommentaryPanel({ bookId, chapter }: CommentaryPanelProps) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getChapterCommentary(bookId, chapter, language).then((data) => {
      if (!cancelled) {
        setCommentary(data);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bookId, chapter, language]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!commentary) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
        <svg className="w-12 h-12 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p className="text-sm text-center">{t("commentary.noCommentary")}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-4 py-3">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">
          {t("commentary.chapterCommentary")}
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">{t("commentary.aiGenerated")}</p>
      </div>
      <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
        {commentary.content}
      </div>
    </div>
  );
}
