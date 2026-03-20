import { remove, exists, BaseDirectory } from "@tauri-apps/plugin-fs";
import i18n from "../i18n";
import { clearInterlinearDbCache } from "./db";
import { useDownloadStore } from "../stores/downloadStore";
import { useToastStore } from "../stores/toastStore";
import { DOWNLOAD_CONFIG } from "./downloadConfig";
import { streamDownloadToFile } from "./downloadUtils";

const DB_FILENAME = "interlinear.db";
const DOWNLOAD_KEY = "interlinear";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

export function interlinearDownloadKey(): string {
  return DOWNLOAD_KEY;
}

export async function downloadInterlinear(): Promise<void> {
  const key = DOWNLOAD_KEY;
  const store = useDownloadStore.getState();
  const existing = store.downloads[key];
  if (existing && (existing.status === "downloading" || existing.status === "importing")) return;
  store.startDownload(key);

  try {
    const url = `${DOWNLOAD_CONFIG.baseUrl}/${DOWNLOAD_CONFIG.commentaryTag}/${DB_FILENAME}`;
    console.log(`[interlinear] Fetching ${url}`);
    const bytes = await streamDownloadToFile(url, DB_FILENAME, (pct) => {
      store.updateProgress(key, Math.round(pct * 0.95));
    });

    const magic = new TextDecoder().decode(bytes.slice(0, 15));
    if (magic !== "SQLite format 3") {
      throw new Error("Invalid DB file");
    }

    store.setStatus(key, "done");
    console.log("[interlinear] download complete");
    useToastStore.getState().showToast(
      i18n.t("download.completeToast", { name: i18n.t("interlinear.title") }),
      "success"
    );
  } catch (err) {
    console.error("[interlinear] Error:", err);
    await remove(DB_FILENAME, { baseDir: BaseDirectory.AppData }).catch(() => {});
    const message = toErrorMessage(err);
    store.setStatus(key, "error", message);
    useToastStore.getState().showToast(
      i18n.t("download.errorToast", { name: i18n.t("interlinear.title") }),
      "error"
    );
    throw err;
  }
}

export async function deleteInterlinear(): Promise<void> {
  clearInterlinearDbCache();
  try {
    const fileExists = await exists(DB_FILENAME, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      await remove(DB_FILENAME, { baseDir: BaseDirectory.AppData });
    }
  } catch (err) {
    console.warn("[interlinear] remove file warning:", err);
  }
}

export async function isInterlinearDbDownloaded(): Promise<boolean> {
  try {
    return await exists(DB_FILENAME, { baseDir: BaseDirectory.AppData });
  } catch {
    return false;
  }
}
