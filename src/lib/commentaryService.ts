import { fetch } from "@tauri-apps/plugin-http";
import i18n from "../i18n";
import { execute } from "./db";
import { getCommentaryDownloadUrl, CORE_COMMENTARY_LANGUAGES, COMMENTARY_LANGUAGES } from "./downloadConfig";
import { useDownloadStore } from "../stores/downloadStore";
import { useToastStore } from "../stores/toastStore";

interface CommentaryRow {
  book_id: number;
  chapter: number;
  language: string;
  content: string;
  model_version: string;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

export function commentaryDownloadKey(language: string): string {
  return `commentary-${language}`;
}

export async function downloadCommentary(language: string): Promise<void> {
  const key = commentaryDownloadKey(language);
  const store = useDownloadStore.getState();
  const existing = store.downloads[key];
  if (existing && (existing.status === "downloading" || existing.status === "importing")) return;
  store.startDownload(key);

  try {
    const url = getCommentaryDownloadUrl(language);
    console.log(`[commentary] Fetching ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    store.updateProgress(key, 30);

    const entries: CommentaryRow[] = await response.json();
    console.log(`[commentary] Parsed ${entries.length} entries`);
    store.updateProgress(key, 50);
    store.setStatus(key, "importing");

    // Delete existing chapter-level commentary for this language
    await execute(
      "DELETE FROM commentary WHERE language = $1 AND verse IS NULL",
      [language]
    );

    // Insert in batches
    const batchSize = 500;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      for (const e of batch) {
        await execute(
          "INSERT OR IGNORE INTO commentary (book_id, chapter, verse, language, content, model_version) VALUES ($1, $2, NULL, $3, $4, $5)",
          [e.book_id, e.chapter, e.language, e.content, e.model_version]
        );
      }
      const progress = 50 + Math.round((i / entries.length) * 45);
      store.updateProgress(key, Math.min(progress, 95));
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
  if (CORE_COMMENTARY_LANGUAGES.has(language)) {
    throw new Error("Cannot delete core commentary");
  }

  try {
    await execute(
      "DELETE FROM commentary WHERE language = $1 AND verse IS NULL",
      [language]
    );
    window.dispatchEvent(new Event("commentary-changed"));
  } catch (err) {
    console.error("[commentary] Delete error:", err);
    throw err;
  }
}
