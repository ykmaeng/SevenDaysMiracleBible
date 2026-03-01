import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";
import Markdown, { type Components } from "react-markdown";
import { getChapterCommentary } from "../../lib/bible";
import { useSettingsStore } from "../../stores/settingsStore";
import type { Commentary } from "../../types/bible";

const mdComponents: Components = {
  h2: (props: ComponentPropsWithoutRef<"h2">) => (
    <h2 className="text-[0.95em] font-bold text-blue-700 dark:text-blue-400 mt-5 mb-2 pb-1 border-b border-gray-200 dark:border-gray-700" {...props} />
  ),
  h3: (props: ComponentPropsWithoutRef<"h3">) => (
    <h3 className="text-[0.9em] font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1.5" {...props} />
  ),
  p: (props: ComponentPropsWithoutRef<"p">) => (
    <p className="mb-2.5 leading-[1.85]" {...props} />
  ),
  ul: (props: ComponentPropsWithoutRef<"ul">) => (
    <ul className="mb-3 pl-4 space-y-1.5 list-disc" {...props} />
  ),
  ol: (props: ComponentPropsWithoutRef<"ol">) => (
    <ol className="mb-3 pl-4 space-y-1.5 list-decimal" {...props} />
  ),
  li: (props: ComponentPropsWithoutRef<"li">) => (
    <li className="leading-[1.75]" {...props} />
  ),
  strong: (props: ComponentPropsWithoutRef<"strong">) => (
    <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />
  ),
  hr: () => (
    <hr className="my-4 border-gray-200 dark:border-gray-700" />
  ),
};

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
      <p className="text-xs text-gray-400 mb-2">{t("commentary.aiGenerated")}</p>
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <Markdown components={mdComponents}>{commentary.content}</Markdown>
      </div>
    </div>
  );
}
