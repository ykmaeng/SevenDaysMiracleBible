import { fetch } from "@tauri-apps/plugin-http";
import { writeFile, remove, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import i18n from "../i18n";
import { execute, clearTranslationDbCache } from "./db";
import { getTranslationDownloadUrl, CORE_TRANSLATIONS } from "./downloadConfig";
import { useDownloadStore } from "../stores/downloadStore";
import { useToastStore } from "../stores/toastStore";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

export async function downloadTranslation(translationId: string): Promise<void> {
  const store = useDownloadStore.getState();
  const existing = store.downloads[translationId];
  if (existing && (existing.status === "downloading" || existing.status === "importing")) return;
  store.startDownload(translationId);

  const dbFileName = `${translationId}.db`;

  try {
    // 1. Download .db file from GitHub Releases
    const url = getTranslationDownloadUrl(translationId);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    store.updateProgress(translationId, 50);

    // 2. Save .db file to app data directory
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const magic = new TextDecoder().decode(bytes.slice(0, 15));
    if (magic !== "SQLite format 3") {
      throw new Error(`Invalid DB file`);
    }

    await writeFile(dbFileName, bytes, { baseDir: BaseDirectory.AppData });
    store.updateProgress(translationId, 90);

    // 3. Mark as downloaded in main DB
    await execute("UPDATE translations SET downloaded = 1 WHERE id = $1", [translationId]);

    // 4. Done
    store.setStatus(translationId, "done");
    window.dispatchEvent(new Event("translations-changed"));
    useToastStore.getState().showToast(
      i18n.t("download.completeToast", { name: translationId }),
      "success"
    );
  } catch (err) {
    console.error("[download] Error:", err);
    // Clean up on error
    await remove(dbFileName, { baseDir: BaseDirectory.AppData }).catch(() => {});
    const message = toErrorMessage(err);
    store.setStatus(translationId, "error", message);
    useToastStore.getState().showToast(
      i18n.t("download.errorToast", { name: translationId }),
      "error"
    );
    throw err;
  }
}

export async function deleteTranslation(translationId: string): Promise<void> {
  if (CORE_TRANSLATIONS.has(translationId)) {
    throw new Error("Cannot delete core translation");
  }

  // Clear cached DB connection
  clearTranslationDbCache(translationId);

  // Delete .db file (may not exist if download was partial)
  const dbFileName = `${translationId}.db`;
  try {
    const fileExists = await exists(dbFileName, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      await remove(dbFileName, { baseDir: BaseDirectory.AppData });
    }
  } catch (err) {
    console.warn("[delete] remove file warning:", err);
  }

  // Mark as not downloaded in main DB
  await execute("UPDATE translations SET downloaded = 0 WHERE id = $1", [translationId]);
  window.dispatchEvent(new Event("translations-changed"));
}

export async function isTranslationDownloaded(translationId: string): Promise<boolean> {
  if (CORE_TRANSLATIONS.has(translationId)) return true;
  return exists(`${translationId}.db`, { baseDir: BaseDirectory.AppData });
}
