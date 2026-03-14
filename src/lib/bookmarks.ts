import { query, execute } from "./db";
import type { Bookmark, BookmarkLabel } from "../types/bible";

// ── Labels ──

export async function getAllLabels(): Promise<BookmarkLabel[]> {
  return query<BookmarkLabel>("SELECT * FROM bookmark_labels ORDER BY book_id, chapter, verse");
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

export async function getAllBookmarks(labelId?: number | null): Promise<Bookmark[]> {
  if (labelId != null) {
    return query<Bookmark>(
      "SELECT * FROM bookmarks WHERE color IS NULL AND label_id = $1 ORDER BY book_id, chapter, verse",
      [labelId]
    );
  }
  return query<Bookmark>(
    "SELECT * FROM bookmarks WHERE color IS NULL ORDER BY book_id, chapter, verse"
  );
}

export async function getAllNotes(): Promise<Bookmark[]> {
  return query<Bookmark>(
    "SELECT * FROM bookmarks WHERE note IS NOT NULL AND note != '' ORDER BY book_id, chapter, verse"
  );
}

export async function getAllHighlights(): Promise<Bookmark[]> {
  return query<Bookmark>(
    "SELECT * FROM bookmarks WHERE color IS NOT NULL ORDER BY book_id, chapter, verse"
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
  labelId?: number,
  text?: string
): Promise<number> {
  const result = await execute(
    "INSERT OR REPLACE INTO bookmarks (book_id, chapter, verse, color, note, translation_id, label_id, text) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [bookId, chapter, verse, color ?? null, note ?? null, translationId ?? null, labelId ?? null, text ?? null]
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
