import { query, execute } from "./db";
import type { Bookmark } from "../types/bible";

export interface BookmarkWithText extends Bookmark {
  text: string | null;
}

export async function getAllBookmarks(translationId: string): Promise<BookmarkWithText[]> {
  return query<BookmarkWithText>(
    `SELECT b.*, v.text FROM bookmarks b
     LEFT JOIN verses v ON v.book_id = b.book_id AND v.chapter = b.chapter AND v.verse = b.verse AND v.translation_id = $1
     ORDER BY b.book_id, b.chapter, b.verse`,
    [translationId]
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
  note?: string
): Promise<number> {
  const result = await execute(
    "INSERT OR REPLACE INTO bookmarks (book_id, chapter, verse, color, note) VALUES ($1, $2, $3, $4, $5)",
    [bookId, chapter, verse, color ?? null, note ?? null]
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
