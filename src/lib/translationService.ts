import { fetch } from "@tauri-apps/plugin-http";
import { execute, query } from "./db";
import { getTranslationDownloadUrl, CORE_TRANSLATIONS } from "./downloadConfig";
import { useDownloadStore } from "../stores/downloadStore";

interface VerseRow {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

export async function downloadTranslation(translationId: string): Promise<void> {
  const store = useDownloadStore.getState();
  store.startDownload(translationId);

  try {
    // 1. Fetch JSON from GitHub Releases
    const url = getTranslationDownloadUrl(translationId);
    console.log(`[download] Fetching ${url}`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    store.updateProgress(translationId, 30);

    // 2. Parse JSON
    const verses: VerseRow[] = await response.json();
    console.log(`[download] Parsed ${verses.length} verses`);
    store.updateProgress(translationId, 50);
    store.setStatus(translationId, "importing");

    // 3. Delete existing data for idempotency
    await execute("DELETE FROM verses WHERE translation_id = $1", [translationId]);

    // 4. Insert verses in batches
    const batchSize = 500;
    for (let i = 0; i < verses.length; i += batchSize) {
      const batch = verses.slice(i, i + batchSize);
      for (const v of batch) {
        await execute(
          "INSERT OR IGNORE INTO verses (translation_id, book_id, chapter, verse, text) VALUES ($1, $2, $3, $4, $5)",
          [v.translation_id, v.book_id, v.chapter, v.verse, v.text]
        );
      }
      const progress = 50 + Math.round((i / verses.length) * 40);
      store.updateProgress(translationId, Math.min(progress, 90));
    }

    // 5. Rebuild FTS index
    store.updateProgress(translationId, 95);
    await execute("INSERT INTO verses_fts(verses_fts) VALUES('rebuild')");

    // 6. Mark as downloaded
    await execute("UPDATE translations SET downloaded = 1 WHERE id = $1", [translationId]);

    // 7. Done
    store.setStatus(translationId, "done");
    window.dispatchEvent(new Event("translations-changed"));
    console.log(`[download] ${translationId} complete`);
  } catch (err) {
    console.error("[download] Error:", err);
    const message = toErrorMessage(err);
    store.setStatus(translationId, "error", message);
    throw err;
  }
}

export async function deleteTranslation(translationId: string): Promise<void> {
  if (CORE_TRANSLATIONS.has(translationId)) {
    throw new Error("Cannot delete core translation");
  }

  try {
    await execute("DELETE FROM verses WHERE translation_id = $1", [translationId]);
    await execute("INSERT INTO verses_fts(verses_fts) VALUES('rebuild')");
    await execute("UPDATE translations SET downloaded = 0 WHERE id = $1", [translationId]);
  } catch (err) {
    console.error("[delete] Error:", err);
    throw err;
  }

  window.dispatchEvent(new Event("translations-changed"));
}

export async function isTranslationDownloaded(translationId: string): Promise<boolean> {
  const result = await query<{ downloaded: number }>(
    "SELECT downloaded FROM translations WHERE id = $1",
    [translationId]
  );
  return result[0]?.downloaded === 1;
}
