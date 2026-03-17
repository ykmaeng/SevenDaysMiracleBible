import { query, execute } from "./db";
import type { Bookmark, BookmarkLabel } from "../types/bible";

interface AndroidFile {
  saveFile: (content: string, filename: string, mimeType: string) => void;
  openFile: (mimeType: string) => void;
}

export interface BackupData {
  version: 1;
  exported_at: string;
  labels: Omit<BookmarkLabel, "id">[];
  bookmarks: Omit<Bookmark, "id">[];
}

function getAndroidFile(): AndroidFile | null {
  return (window as unknown as { AndroidFile?: AndroidFile }).AndroidFile ?? null;
}

// ── Export ──

export async function exportBackup(): Promise<void> {
  const labels = await query<BookmarkLabel>("SELECT * FROM bookmark_labels ORDER BY id");
  const bookmarks = await query<Bookmark>("SELECT * FROM bookmarks ORDER BY book_id, chapter, verse");

  const labelMap = new Map(labels.map((l) => [l.id, l.name]));

  const data: BackupData = {
    version: 1,
    exported_at: new Date().toISOString(),
    labels: labels.map(({ name, created_at }) => ({ name, created_at })),
    bookmarks: bookmarks.map((bm) => ({
      book_id: bm.book_id,
      chapter: bm.chapter,
      verse: bm.verse,
      note: bm.note,
      color: bm.color,
      translation_id: bm.translation_id,
      label_id: bm.label_id,
      text: bm.text,
      is_bookmarked: bm.is_bookmarked,
      created_at: bm.created_at,
      _label_name: bm.label_id ? (labelMap.get(bm.label_id) ?? null) : null,
    })) as BackupData["bookmarks"],
  };

  const json = JSON.stringify(data, null, 2);
  const filename = `selah-backup-${new Date().toISOString().slice(0, 10)}.json`;

  const android = getAndroidFile();
  if (android) {
    return new Promise<void>((resolve, reject) => {
      (window as unknown as Record<string, unknown>).__fileSaveCallback = (result: string) => {
        delete (window as unknown as Record<string, unknown>).__fileSaveCallback;
        if (result === "ok") resolve();
        else if (result === "error") reject(new Error("save failed"));
        else reject(new Error("cancelled"));
      };
      android.saveFile(json, filename, "application/json");
    });
  }

  // Desktop fallback: download via blob
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Import ──

export async function openBackupFile(): Promise<string> {
  const android = getAndroidFile();
  if (android) {
    return new Promise<string>((resolve, reject) => {
      (window as unknown as Record<string, unknown>).__fileOpenCallback = (content: string | null) => {
        delete (window as unknown as Record<string, unknown>).__fileOpenCallback;
        if (content) resolve(content);
        else reject(new Error("cancelled"));
      };
      android.openFile("application/json");
    });
  }

  // Desktop fallback: file input
  return new Promise<string>((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { reject(new Error("cancelled")); return; }
      resolve(await file.text());
    };
    input.click();
  });
}

export async function importBackup(json: string, mode: "merge" | "overwrite"): Promise<{ labels: number; bookmarks: number }> {
  const data = JSON.parse(json) as BackupData & { bookmarks: (Omit<Bookmark, "id"> & { _label_name?: string | null })[] };

  if (!data.version || !data.bookmarks) {
    throw new Error("Invalid backup file");
  }

  await execute("BEGIN");
  try {

  if (mode === "overwrite") {
    await execute("DELETE FROM bookmarks");
    await execute("DELETE FROM bookmark_labels");
  }

  let labelCount = 0;
  const labelNameToId = new Map<string, number>();

  const existingLabels = await query<BookmarkLabel>("SELECT * FROM bookmark_labels");
  for (const l of existingLabels) {
    labelNameToId.set(l.name, l.id);
  }

  for (const label of data.labels) {
    if (labelNameToId.has(label.name)) continue;
    const result = await execute(
      "INSERT INTO bookmark_labels (name, created_at) VALUES ($1, $2)",
      [label.name, label.created_at]
    );
    labelNameToId.set(label.name, result.lastInsertId ?? 0);
    labelCount++;
  }

  let bmCount = 0;
  for (const bm of data.bookmarks) {
    let labelId: number | null = null;
    if (bm._label_name) {
      labelId = labelNameToId.get(bm._label_name) ?? null;
    }

    if (mode === "merge") {
      const existing = await query<{ id: number }>(
        "SELECT id FROM bookmarks WHERE book_id = $1 AND chapter = $2 AND verse = $3",
        [bm.book_id, bm.chapter, bm.verse]
      );
      if (existing.length > 0) continue;
    }

    await execute(
      `INSERT INTO bookmarks (book_id, chapter, verse, note, color, translation_id, label_id, text, is_bookmarked, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [bm.book_id, bm.chapter, bm.verse, bm.note ?? null, bm.color ?? null,
       bm.translation_id ?? null, labelId, bm.text ?? null, bm.is_bookmarked, bm.created_at]
    );
    bmCount++;
  }

  await execute("COMMIT");
  return { labels: labelCount, bookmarks: bmCount };

  } catch (e) {
    await execute("ROLLBACK");
    throw e;
  }
}
