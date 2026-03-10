import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTranslations } from "../../lib/bible";
import { downloadTranslation, deleteTranslation } from "../../lib/translationService";
import { downloadCommentary, deleteCommentary, commentaryDownloadKey, isCommentaryDbDownloaded } from "../../lib/commentaryService";
import { downloadDictionary, deleteDictionary, isDictionaryDownloaded, DICTIONARY_DOWNLOAD_KEY } from "../../lib/dictionaryService";
import { downloadInterlinear, deleteInterlinear, isInterlinearDbDownloaded, interlinearDownloadKey } from "../../lib/interlinearService";
import { BUNDLED_TRANSLATIONS, COMMENTARY_LANGUAGES } from "../../lib/downloadConfig";
import { useDownloadStore } from "../../stores/downloadStore";
import { useToastStore } from "../../stores/toastStore";
import type { Translation } from "../../types/bible";

export function DownloadManager() {
  const { t } = useTranslation();
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [dictDownloaded, setDictDownloaded] = useState(false);
  const [interlinearDownloaded, setInterlinearDownloaded] = useState(false);
  const downloads = useDownloadStore((s) => s.downloads);
  const clearDownload = useDownloadStore((s) => s.clearDownload);

  const refresh = () => getTranslations().then(setTranslations);
  const refreshDict = () => isDictionaryDownloaded().then(setDictDownloaded);
  const refreshInterlinear = () => isInterlinearDbDownloaded().then(setInterlinearDownloaded);

  useEffect(() => {
    refresh();
    refreshDict();
    refreshInterlinear();
  }, []);

  // Refresh when any translation download completes
  useEffect(() => {
    const doneKeys = Object.entries(downloads)
      .filter(([k, v]) => !k.startsWith("commentary-") && k !== DICTIONARY_DOWNLOAD_KEY && k !== "interlinear" && v.status === "done")
      .map(([k]) => k);
    if (doneKeys.length > 0) {
      refresh();
      for (const k of doneKeys) clearDownload(k);
    }
  }, [downloads]);

  const handleDownload = async (id: string) => {
    try {
      await downloadTranslation(id);
      await refresh();
    } catch {
      // error is already stored in downloadStore
    }
  };

  const handleDelete = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId(null);
    setDeleting(id);
    try {
      await deleteTranslation(id);
      useToastStore.getState().showToast(t("download.deleted"), "success");
    } catch (err) {
      console.error("[delete] Failed:", err);
      useToastStore.getState().showToast(
        `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
        "error"
      );
    } finally {
      await refresh();
      setDeleting(null);
    }
  };

  const handleRetry = (id: string) => {
    clearDownload(id);
    handleDownload(id);
  };

  const sorted = [...translations].sort((a, b) => {
    if (a.downloaded === b.downloaded) return 0;
    return a.downloaded ? -1 : 1;
  });

  const renderItem = (tr: Translation) => {
    const dl = downloads[tr.id];
    const isDownloading = dl && dl.status !== "done" && dl.status !== "error";
    const isError = dl?.status === "error";
    const isDone = tr.downloaded || dl?.status === "done";
    const isBundled = BUNDLED_TRANSLATIONS.has(tr.id);
    const isDeletingThis = deleting === tr.id;

    return (
      <div key={tr.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{tr.name}</span>
            <span className="text-[11px] text-gray-400">
              {tr.language.toUpperCase()}
              {tr.is_ai_generated ? " · AI" : ""}
              {tr.download_size_mb ? ` · ${t("download.size", { size: tr.download_size_mb })}` : ""}
            </span>
          </div>
          {tr.description && (
            <p className="text-xs text-gray-500">{tr.description}</p>
          )}
          {isError && dl.error && (
            <p className="text-xs text-red-500">{dl.error}</p>
          )}
        </div>
        <div>
          {isDownloading ? (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
          ) : isDone ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 font-medium">
                {t("download.downloaded")}
              </span>
              {!isBundled && (
                confirmId === tr.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(tr.id)}
                      className="text-xs text-red-600 font-medium hover:text-red-800"
                    >
                      {t("download.confirmShort")}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs text-gray-400 font-medium hover:text-gray-600"
                    >
                      {t("download.cancel")}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDelete(tr.id)}
                    disabled={isDeletingThis}
                    className="text-xs text-red-500 font-medium hover:text-red-700 disabled:opacity-50"
                  >
                    {isDeletingThis ? "..." : t("download.delete")}
                  </button>
                )
              )}
            </div>
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
      {sorted.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{t("download.bibleTranslations")}</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>
          <div>{sorted.map(renderItem)}</div>
        </section>
      )}

      {/* AI Commentary */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{t("commentary.title")}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>
        <CommentaryDownloadList
          downloads={downloads}
          clearDownload={clearDownload}
          t={t}
        />
      </section>

      {/* Offline Dictionary */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{t("dictionary.offline")}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>
        <DictionaryDownloadItem
          downloaded={dictDownloaded}
          downloads={downloads}
          clearDownload={clearDownload}
          onRefresh={refreshDict}
          t={t}
        />
      </section>

      {/* Interlinear (Greek/Hebrew) */}
      <section>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">{t("interlinear.title")}</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>
        <InterlinearDownloadItem
          downloaded={interlinearDownloaded}
          downloads={downloads}
          clearDownload={clearDownload}
          onRefresh={refreshInterlinear}
          t={t}
        />
      </section>
    </div>
  );
}

function DictionaryDownloadItem({
  downloaded,
  downloads,
  clearDownload,
  onRefresh,
  t,
}: {
  downloaded: boolean;
  downloads: Record<string, { progress: number; status: string; error?: string }>;
  clearDownload: (id: string) => void;
  onRefresh: () => void;
  t: (key: string) => string;
}) {
  const [deletingDict, setDeletingDict] = useState(false);
  const [confirmDict, setConfirmDict] = useState(false);
  const dl = downloads[DICTIONARY_DOWNLOAD_KEY];
  const isDownloading = dl && dl.status !== "done" && dl.status !== "error";
  const isError = dl?.status === "error";
  const isDone = downloaded || dl?.status === "done";

  const handleDownload = async () => {
    try {
      await downloadDictionary();
      onRefresh();
    } catch {
      // error stored in downloadStore
    }
  };

  const handleDelete = async () => {
    if (!confirmDict) {
      setConfirmDict(true);
      return;
    }
    setConfirmDict(false);
    setDeletingDict(true);
    try {
      await deleteDictionary();
      onRefresh();
    } catch {
      // ignore
    } finally {
      setDeletingDict(false);
    }
  };

  const handleRetry = () => {
    clearDownload(DICTIONARY_DOWNLOAD_KEY);
    handleDownload();
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {t("dictionary.download")}
        </span>
        <span className="text-[11px] text-gray-400">EN</span>
        {isError && dl.error && (
          <span className="text-xs text-red-500">{dl.error}</span>
        )}
      </div>
      <div>
        {isDownloading ? (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
            onClick={handleRetry}
            className="text-xs text-orange-600 font-medium hover:text-orange-800"
          >
            {t("download.retry")}
          </button>
        ) : isDone ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 font-medium">
              {t("download.downloaded")}
            </span>
            {confirmDict ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  className="text-xs text-red-600 font-medium hover:text-red-800"
                >
                  {t("download.confirmShort")}
                </button>
                <button
                  onClick={() => setConfirmDict(false)}
                  className="text-xs text-gray-400 font-medium hover:text-gray-600"
                >
                  {t("download.cancel")}
                </button>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                disabled={deletingDict}
                className="text-xs text-red-500 font-medium hover:text-red-700 disabled:opacity-50"
              >
                {deletingDict ? "..." : t("download.delete")}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleDownload}
            className="text-xs text-blue-600 font-medium hover:text-blue-800"
          >
            {t("download.title")}
          </button>
        )}
      </div>
    </div>
  );
}

function InterlinearDownloadItem({
  downloaded,
  downloads,
  clearDownload,
  onRefresh,
  t,
}: {
  downloaded: boolean;
  downloads: Record<string, { progress: number; status: string; error?: string }>;
  clearDownload: (id: string) => void;
  onRefresh: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const key = interlinearDownloadKey();
  const dl = downloads[key];
  const isDownloading = dl && dl.status !== "done" && dl.status !== "error";
  const isError = dl?.status === "error";
  const isDone = downloaded || dl?.status === "done";

  useEffect(() => {
    if (dl?.status === "done") {
      onRefresh();
      clearDownload(key);
    }
  }, [dl?.status]);

  const handleDownload = async () => {
    try {
      await downloadInterlinear();
      onRefresh();
    } catch {
      // error stored in downloadStore
    }
  };

  const handleDelete = async () => {
    if (!confirm) {
      setConfirm(true);
      return;
    }
    setConfirm(false);
    setDeleting(true);
    try {
      await deleteInterlinear();
      onRefresh();
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  };

  const handleRetry = () => {
    clearDownload(key);
    handleDownload();
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {t("interlinear.download")}
        </span>
        <span className="text-[11px] text-gray-400">{t("download.size", { size: 38 })}</span>
        {isError && dl.error && (
          <span className="text-xs text-red-500">{dl.error}</span>
        )}
      </div>
      <div>
        {isDownloading ? (
          <div className="flex items-center gap-2">
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
            onClick={handleRetry}
            className="text-xs text-orange-600 font-medium hover:text-orange-800"
          >
            {t("download.retry")}
          </button>
        ) : isDone ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 font-medium">
              {t("download.downloaded")}
            </span>
            {confirm ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleDelete}
                  className="text-xs text-red-600 font-medium hover:text-red-800"
                >
                  {t("download.confirmShort")}
                </button>
                <button
                  onClick={() => setConfirm(false)}
                  className="text-xs text-gray-400 font-medium hover:text-gray-600"
                >
                  {t("download.cancel")}
                </button>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs text-red-500 font-medium hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? "..." : t("download.delete")}
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={handleDownload}
            className="text-xs text-blue-600 font-medium hover:text-blue-800"
          >
            {t("download.title")}
          </button>
        )}
      </div>
    </div>
  );
}

function CommentaryDownloadList({
  downloads,
  clearDownload,
  t,
}: {
  downloads: Record<string, { progress: number; status: string; error?: string }>;
  clearDownload: (id: string) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
  const [downloadedLangs, setDownloadedLangs] = useState<Set<string>>(new Set());
  const [confirmLang, setConfirmLang] = useState<string | null>(null);
  const [deletingLang, setDeletingLang] = useState<string | null>(null);

  const refresh = () => {
    Promise.all(
      COMMENTARY_LANGUAGES.map(async (c) => {
        const downloaded = await isCommentaryDbDownloaded(c.language);
        return downloaded ? c.language : null;
      })
    ).then((results) => {
      setDownloadedLangs(new Set(results.filter((r): r is string => r !== null)));
    });
  };

  useEffect(() => { refresh(); }, []);

  // Refresh when any commentary download completes
  useEffect(() => {
    const doneKeys = Object.entries(downloads)
      .filter(([k, v]) => k.startsWith("commentary-") && v.status === "done")
      .map(([k]) => k);
    if (doneKeys.length > 0) {
      refresh();
      for (const k of doneKeys) clearDownload(k);
    }
  }, [downloads]);

  const handleDownload = async (language: string) => {
    try {
      await downloadCommentary(language);
    } catch {
      // error stored in downloadStore
    }
  };

  const handleDelete = async (language: string) => {
    if (confirmLang !== language) {
      setConfirmLang(language);
      return;
    }
    setConfirmLang(null);
    setDeletingLang(language);
    try {
      await deleteCommentary(language);
      refresh();
    } catch {
      // ignore
    } finally {
      setDeletingLang(null);
    }
  };

  return (
    <div>
      {COMMENTARY_LANGUAGES.map((c) => {
        const key = commentaryDownloadKey(c.language);
        const dl = downloads[key];
        const isDownloaded = downloadedLangs.has(c.language);
        const isReady = c.ready !== false;
        const isDownloading = dl && dl.status !== "done" && dl.status !== "error";
        const isError = dl?.status === "error";
        const isDone = isDownloaded || dl?.status === "done";
        const isDeletingThis = deletingLang === c.language;

        return (
          <div key={c.language} className={`flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 ${!isReady ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-none">{c.name}</span>
              <span className="text-[11px] text-gray-400 leading-none">{t("download.size", { size: c.sizeMb })}</span>
              {isError && dl.error && (
                <span className="text-xs text-red-500">{dl.error}</span>
              )}
            </div>
            <div>
              {!isReady ? (
                <span className="text-xs text-gray-400 font-medium">{t("download.preparing")}</span>
              ) : isDownloading ? (
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
                  onClick={() => { clearDownload(key); handleDownload(c.language); }}
                  className="text-xs text-orange-600 font-medium hover:text-orange-800"
                >
                  {t("download.retry")}
                </button>
              ) : isDone ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-green-600 font-medium">
                    {t("download.downloaded")}
                  </span>
                  {confirmLang === c.language ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(c.language)}
                        className="text-xs text-red-600 font-medium hover:text-red-800"
                      >
                        {t("download.confirmShort")}
                      </button>
                      <button
                        onClick={() => setConfirmLang(null)}
                        className="text-xs text-gray-400 font-medium hover:text-gray-600"
                      >
                        {t("download.cancel")}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(c.language)}
                      disabled={isDeletingThis}
                      className="text-xs text-red-500 font-medium hover:text-red-700 disabled:opacity-50"
                    >
                      {isDeletingThis ? "..." : t("download.delete")}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => handleDownload(c.language)}
                  className="text-xs text-blue-600 font-medium hover:text-blue-800"
                >
                  {t("download.title")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
