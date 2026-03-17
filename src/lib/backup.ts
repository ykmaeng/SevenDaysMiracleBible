import { query, execute } from "./db";
import { writeFile, exists, mkdir, BaseDirectory } from "@tauri-apps/plugin-fs";
import type { Bookmark, BookmarkLabel } from "../types/bible";

export interface BackupData {
  version: 1;
  exported_at: string;
  labels: Omit<BookmarkLabel, "id">[];
  bookmarks: Omit<Bookmark, "id">[];
}

// ── Export ──

export async function exportBackup(): Promise<string> {
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

  // Try saving to Download directory first, fallback to AppData
  try {
    if (!(await exists("", { baseDir: BaseDirectory.Download }))) {
      await mkdir("", { baseDir: BaseDirectory.Download, recursive: true });
    }
    await writeFile(filename, new TextEncoder().encode(json), { baseDir: BaseDirectory.Download });
    return filename;
  } catch {
    // Fallback to AppData/backups
    const dir = "backups";
    if (!(await exists(dir, { baseDir: BaseDirectory.AppData }))) {
      await mkdir(dir, { baseDir: BaseDirectory.AppData, recursive: true });
    }
    const path = `${dir}/${filename}`;
    await writeFile(path, new TextEncoder().encode(json), { baseDir: BaseDirectory.AppData });
    return filename;
  }
}

// Share backup via sharesheet (text-based, includes filename for context)
export async function shareBackup(): Promise<void> {
  const filename = await exportBackup();
  try {
    const { shareText } = await import("@buildyourwebapp/tauri-plugin-sharesheet");
    await shareText(`Selah Bible Backup: ${filename}`);
  } catch { /* ignore */ }
}

// ── Import ──

export async function importBackup(json: string, mode: "merge" | "overwrite"): Promise<{ labels: number; bookmarks: number }> {
  const data = JSON.parse(json) as BackupData & { bookmarks: (Omit<Bookmark, "id"> & { _label_name?: string | null })[] };

  if (!data.version || !data.bookmarks) {
    throw new Error("Invalid backup file");
  }

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

  return { labels: labelCount, bookmarks: bmCount };
}
