import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTranslations } from "../../lib/bible";
import { downloadTranslation, deleteTranslation } from "../../lib/translationService";
import { CORE_TRANSLATIONS } from "../../lib/downloadConfig";
import { useDownloadStore } from "../../stores/downloadStore";
import type { Translation } from "../../types/bible";

export function DownloadManager() {
  const { t } = useTranslation();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const downloads = useDownloadStore((s) => s.downloads);
  const clearDownload = useDownloadStore((s) => s.clearDownload);

  const refresh = () => getTranslations().then(setTranslations);

  useEffect(() => {
    refresh();
  }, []);

  const handleDownload = async (id: string) => {
    try {
      await downloadTranslation(id);
      await refresh();
    } catch {
      // error is already stored in downloadStore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("download.confirmDelete"))) return;
    setDeleting(id);
    try {
      await deleteTranslation(id);
      await refresh();
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const handleRetry = (id: string) => {
    clearDownload(id);
    handleDownload(id);
  };

  const downloaded = translations.filter((tr) => tr.downloaded);
  const available = translations.filter((tr) => !tr.downloaded);

  const renderItem = (tr: Translation) => {
    const dl = downloads[tr.id];
    const isDownloading = dl && dl.status !== "done" && dl.status !== "error";
    const isError = dl?.status === "error";
    const isCore = CORE_TRANSLATIONS.has(tr.id);
    const isDeletingThis = deleting === tr.id;

    return (
      <div key={tr.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
        <div>
          <p className="text-sm font-medium text-gray-800">{tr.name}</p>
          {tr.description && (
            <p className="text-xs text-gray-500">{tr.description}</p>
          )}
          <p className="text-xs text-gray-400">
            {tr.language.toUpperCase()}
            {tr.is_ai_generated ? " \u00b7 AI" : ""}
            {tr.download_size_mb ? ` \u00b7 ${t("download.size", { size: tr.download_size_mb })}` : ""}
          </p>
          {isError && dl.error && (
            <p className="text-xs text-red-500 mt-1">{dl.error}</p>
          )}
        </div>
        <div>
          {tr.downloaded ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 font-medium">
                {t("download.downloaded")}
              </span>
              {!isCore && (
                <button
                  onClick={() => handleDelete(tr.id)}
                  disabled={isDeletingThis}
                  className="text-xs text-red-500 font-medium hover:text-red-700 disabled:opacity-50"
                >
                  {isDeletingThis ? "..." : t("download.delete")}
                </button>
              )}
            </div>
          ) : isDownloading ? (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
            <button
              onClick={() => handleRetry(tr.id)}
              className="text-xs text-orange-600 font-medium hover:text-orange-800"
            >
              {t("download.retry")}
            </button>
          ) : (
            <button
              onClick={() => handleDownload(tr.id)}
              className="text-xs text-blue-600 font-medium hover:text-blue-800"
            >
              {t("download.title")}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {downloaded.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            {t("download.downloaded")}
          </h3>
          <div>{downloaded.map(renderItem)}</div>
        </section>
      )}

      {available.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
            {t("download.available")}
          </h3>
          <div>{available.map(renderItem)}</div>
        </section>
      )}
    </div>
  );
}
