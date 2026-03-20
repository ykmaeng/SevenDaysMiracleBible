import { remove, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import i18n from "../i18n";
import { clearCommentaryDbCache } from "./db";
import { getCommentaryDownloadUrl, COMMENTARY_LANGUAGES } from "./downloadConfig";
import { useDownloadStore } from "../stores/downloadStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useToastStore } from "../stores/toastStore";
import { streamDownloadToFile } from "./downloadUtils";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

export function commentaryDownloadKey(language: string): string {
  return `commentary-${language}`;
}

export function commentaryDbFileName(language: string): string {
  return `commentary-${language}.db`;
}

export async function downloadCommentary(language: string): Promise<void> {
  const key = commentaryDownloadKey(language);
  const store = useDownloadStore.getState();
  const existing = store.downloads[key];
  if (existing && (existing.status === "downloading" || existing.status === "importing")) return;
  store.startDownload(key);

  const dbFileName = commentaryDbFileName(language);

  try {
    const url = getCommentaryDownloadUrl(language);
    console.log(`[commentary] Fetching ${url}`);
    const bytes = await streamDownloadToFile(url, dbFileName, (pct) => {
      store.updateProgress(key, Math.round(pct * 0.95));
    });

    const magic = new TextDecoder().decode(bytes.slice(0, 15));
    if (magic !== "SQLite format 3") {
      throw new Error("Invalid DB file");
    }

    store.setStatus(key, "done");
    const displayName = COMMENTARY_LANGUAGES.find((c) => c.language === language)?.name ?? language;
    console.log(`[commentary] ${language} complete`);
    useToastStore.getState().showToast(
      i18n.t("download.completeToast", { name: displayName }),
      "success"
    );
  } catch (err) {
    console.error("[commentary] Error:", err);
    await remove(dbFileName, { baseDir: BaseDirectory.AppData }).catch(() => {});
    const message = toErrorMessage(err);
    store.setStatus(key, "error", message);
    const displayName = COMMENTARY_LANGUAGES.find((c) => c.language === language)?.name ?? language;
    useToastStore.getState().showToast(
      i18n.t("download.errorToast", { name: displayName }),
      "error"
    );
    throw err;
  }
}

export async function deleteCommentary(language: string): Promise<void> {
  // Clear cached connection (don't close — may affect SQL plugin pool)
  clearCommentaryDbCache(language);

  const dbFileName = commentaryDbFileName(language);
  try {
    const fileExists = await exists(dbFileName, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      await remove(dbFileName, { baseDir: BaseDirectory.AppData });
    }
  } catch (err) {
    console.warn("[commentary] remove file warning:", err);
  }

  useSettingsStore.getState().setShowCommentary(false);
}

export async function isCommentaryDbDownloaded(language: string): Promise<boolean> {
  try {
    return await exists(commentaryDbFileName(language), { baseDir: BaseDirectory.AppData });
  } catch {
    return false;
  }
}
