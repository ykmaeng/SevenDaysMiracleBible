import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import { useTranslation } from "react-i18next";
import Markdown, { type Components } from "react-markdown";
import { getChapterCommentary } from "../../lib/bible";
import { downloadCommentary, commentaryDownloadKey, isCommentaryDbDownloaded } from "../../lib/commentaryService";
import { useDownloadStore } from "../../stores/downloadStore";
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
  onClose?: () => void;
}

export function CommentaryPanel({ bookId, chapter, onClose }: CommentaryPanelProps) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [dbExists, setDbExists] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const dlKey = commentaryDownloadKey(language);
  const dl = useDownloadStore((s) => s.downloads[dlKey]);
  const clearDownload = useDownloadStore((s) => s.clearDownload);

  const loadCommentary = () => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      isCommentaryDbDownloaded(language),
      isCommentaryDbDownloaded(language).then((exists) =>
        exists ? getChapterCommentary(bookId, chapter, language) : null
      ),
    ]).then(([downloaded, data]) => {
      if (!cancelled) {
        setDbExists(downloaded);
        setCommentary(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setDbExists(false);
        setCommentary(null);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  };

  useEffect(loadCommentary, [bookId, chapter, language]);

  // Reload after download completes
  useEffect(() => {
    if (dl?.status === "done") {
      loadCommentary();
      clearDownload(dlKey);
    }
  }, [dl?.status]);

  // Reload when commentary is deleted from Settings
  useEffect(() => {
    window.addEventListener("commentary-deleted", loadCommentary);
    return () => window.removeEventListener("commentary-deleted", loadCommentary);
  }, [bookId, chapter, language]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!commentary) {
    const isDownloading = dl && dl.status !== "done" && dl.status !== "error";
    const isError = dl?.status === "error";

    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4 gap-3">
        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p className="text-sm text-center">
          {dbExists ? t("commentary.noCommentary") : t("commentary.downloadPrompt")}
        </p>
        {isDownloading ? (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all"
                style={{ width: `${dl.progress}%` }}
              />
            </div>
            <span className="text-xs text-blue-600">
              {dl.status === "importing" ? t("download.importing") : `${dl.progress}%`}
            </span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-1">
            {dl.error && <p className="text-xs text-red-500">{dl.error}</p>}
            <button
              onClick={() => { clearDownload(dlKey); downloadCommentary(language); }}
              className="text-sm text-orange-600 font-medium hover:text-orange-800"
            >
              {t("download.retry")}
            </button>
          </div>
        ) : (
          <button
            onClick={() => downloadCommentary(language)}
            className="text-sm text-blue-600 font-medium hover:text-blue-800"
          >
            {dbExists ? t("download.retry") : t("commentary.download")}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto px-4 py-3 relative">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <p className="text-xs text-gray-400 mb-2">{t("commentary.aiGenerated")}</p>
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <Markdown components={mdComponents}>{commentary.content}</Markdown>
      </div>
    </div>
  );
}
