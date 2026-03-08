import { query, execute } from "./db";
import type { Bookmark, BookmarkLabel } from "../types/bible";

export interface BookmarkWithText extends Bookmark {
  text: string | null;
}

// ── Labels ──

export async function getAllLabels(): Promise<BookmarkLabel[]> {
  return query<BookmarkLabel>("SELECT * FROM bookmark_labels ORDER BY created_at DESC");
}

export async function createLabel(name: string): Promise<BookmarkLabel> {
  const result = await execute(
    "INSERT INTO bookmark_labels (name) VALUES ($1)",
    [name]
  );
  return {
    id: result.lastInsertId ?? 0,
    name,
    created_at: new Date().toISOString(),
  };
}

export async function renameLabel(id: number, name: string): Promise<void> {
  await execute("UPDATE bookmark_labels SET name = $1 WHERE id = $2", [name, id]);
}

export async function deleteLabel(id: number): Promise<void> {
  await execute("DELETE FROM bookmark_labels WHERE id = $1", [id]);
}

// ── Bookmarks ──

export async function getAllBookmarks(fallbackTranslationId: string, labelId?: number | null): Promise<BookmarkWithText[]> {
  if (labelId != null) {
    return query<BookmarkWithText>(
      `SELECT b.*, v.text FROM bookmarks b
       LEFT JOIN verses v ON v.book_id = b.book_id AND v.chapter = b.chapter AND v.verse = b.verse
         AND v.translation_id = COALESCE(b.translation_id, $1)
       WHERE b.color IS NULL AND b.label_id = $2
       ORDER BY b.book_id, b.chapter, b.verse`,
      [fallbackTranslationId, labelId]
    );
  }
  return query<BookmarkWithText>(
    `SELECT b.*, v.text FROM bookmarks b
     LEFT JOIN verses v ON v.book_id = b.book_id AND v.chapter = b.chapter AND v.verse = b.verse
       AND v.translation_id = COALESCE(b.translation_id, $1)
     WHERE b.color IS NULL
     ORDER BY b.book_id, b.chapter, b.verse`,
    [fallbackTranslationId]
  );
}

export async function getAllHighlights(fallbackTranslationId: string): Promise<BookmarkWithText[]> {
  return query<BookmarkWithText>(
    `SELECT b.*, v.text FROM bookmarks b
     LEFT JOIN verses v ON v.book_id = b.book_id AND v.chapter = b.chapter AND v.verse = b.verse
       AND v.translation_id = COALESCE(b.translation_id, $1)
     WHERE b.color IS NOT NULL
     ORDER BY b.book_id, b.chapter, b.verse`,
    [fallbackTranslationId]
  );
}

export async function getChapterBookmarks(bookId: number, chapter: number): Promise<Bookmark[]> {
  return query<Bookmark>(
    "SELECT * FROM bookmarks WHERE book_id = $1 AND chapter = $2",
    [bookId, chapter]
  );
}

export async function addBookmark(
  bookId: number,
  chapter: number,
  verse: number,
  color?: string,
  note?: string,
  translationId?: string,
  labelId?: number
): Promise<number> {
  const result = await execute(
    "INSERT OR REPLACE INTO bookmarks (book_id, chapter, verse, color, note, translation_id, label_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [bookId, chapter, verse, color ?? null, note ?? null, translationId ?? null, labelId ?? null]
  );
  return result.lastInsertId ?? 0;
}

export async function removeBookmark(bookId: number, chapter: number, verse: number): Promise<void> {
  await execute(
    "DELETE FROM bookmarks WHERE book_id = $1 AND chapter = $2 AND verse = $3",
    [bookId, chapter, verse]
  );
}

export async function updateBookmarkColor(
  bookId: number,
  chapter: number,
  verse: number,
  color: string | null
): Promise<void> {
  await execute(
    "UPDATE bookmarks SET color = $1 WHERE book_id = $2 AND chapter = $3 AND verse = $4",
    [color, bookId, chapter, verse]
  );
}

export async function updateBookmarkNote(
  bookId: number,
  chapter: number,
  verse: number,
  note: string | null
): Promise<void> {
  await execute(
    "UPDATE bookmarks SET note = $1 WHERE book_id = $2 AND chapter = $3 AND verse = $4",
    [note, bookId, chapter, verse]
  );
}

export async function updateBookmarkLabel(
  bookId: number,
  chapter: number,
  verse: number,
  labelId: number | null
): Promise<void> {
  await execute(
    "UPDATE bookmarks SET label_id = $1 WHERE book_id = $2 AND chapter = $3 AND verse = $4",
    [labelId, bookId, chapter, verse]
  );
}
