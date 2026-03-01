import { query } from "./db";
import type {
  Book,
  BookName,
  Verse,
  OriginalText,
  Commentary,
  CrossReference,
  Translation,
  ParallelVerse,
} from "../types/bible";

export async function getTranslations(): Promise<Translation[]> {
  return query<Translation>("SELECT * FROM translations ORDER BY language, name");
}

export async function getDownloadedTranslations(): Promise<Translation[]> {
  return query<Translation>(
    "SELECT * FROM translations WHERE downloaded = 1 ORDER BY language, name"
  );
}


export async function getBooks(): Promise<Book[]> {
  return query<Book>("SELECT * FROM books ORDER BY id");
}

export async function getBookNames(language: string): Promise<BookName[]> {
  return query<BookName>("SELECT * FROM book_names WHERE language = $1 ORDER BY book_id", [
    language,
  ]);
}

export async function getChapter(
  translationId: string,
  bookId: number,
  chapter: number
): Promise<Verse[]> {
  return query<Verse>(
    "SELECT * FROM verses WHERE translation_id = $1 AND book_id = $2 AND chapter = $3 ORDER BY verse",
    [translationId, bookId, chapter]
  );
}

export async function getVerse(
  translationId: string,
  bookId: number,
  chapter: number,
  verse: number
): Promise<Verse | null> {
  const results = await query<Verse>(
    "SELECT * FROM verses WHERE translation_id = $1 AND book_id = $2 AND chapter = $3 AND verse = $4",
    [translationId, bookId, chapter, verse]
  );
  return results[0] ?? null;
}

export async function getOriginalText(
  bookId: number,
  chapter: number,
  verse: number
): Promise<OriginalText | null> {
  const results = await query<OriginalText>(
    "SELECT * FROM original_texts WHERE book_id = $1 AND chapter = $2 AND verse = $3",
    [bookId, chapter, verse]
  );
  return results[0] ?? null;
}

export async function getParallelVerses(
  bookId: number,
  chapter: number,
  verse: number,
  translationIds: string[]
): Promise<ParallelVerse> {
  const original = await getOriginalText(bookId, chapter, verse);

  const translations = await Promise.all(
    translationIds.map(async (tid) => {
      const v = await getVerse(tid, bookId, chapter, verse);
      const t = await query<Translation>("SELECT name FROM translations WHERE id = $1", [tid]);
      return {
        translationId: tid,
        translationName: t[0]?.name ?? tid,
        text: v?.text ?? "",
      };
    })
  );

  return { original, translations };
}

export async function getChapterCommentary(
  bookId: number,
  chapter: number,
  language: string
): Promise<Commentary | null> {
  const results = await query<Commentary>(
    "SELECT * FROM commentary WHERE book_id = $1 AND chapter = $2 AND verse IS NULL AND language = $3",
    [bookId, chapter, language]
  );
  return results[0] ?? null;
}

export async function getVerseCommentary(
  bookId: number,
  chapter: number,
  verse: number,
  language: string
): Promise<Commentary | null> {
  const results = await query<Commentary>(
    "SELECT * FROM commentary WHERE book_id = $1 AND chapter = $2 AND verse = $3 AND language = $4",
    [bookId, chapter, verse, language]
  );
  return results[0] ?? null;
}

export async function getCrossReferences(
  bookId: number,
  chapter: number,
  verse: number
): Promise<CrossReference[]> {
  return query<CrossReference>(
    "SELECT * FROM cross_references WHERE from_book = $1 AND from_chapter = $2 AND from_verse = $3 ORDER BY votes DESC",
    [bookId, chapter, verse]
  );
}

export async function getParallelChapter(
  translationIds: string[],
  bookId: number,
  chapter: number
): Promise<Map<string, Map<number, { translationId: string; translationName: string; text: string }>>> {
  const result = new Map<string, Map<number, { translationId: string; translationName: string; text: string }>>();

  await Promise.all(
    translationIds.map(async (tid) => {
      const [verses, meta] = await Promise.all([
        getChapter(tid, bookId, chapter),
        query<Translation>("SELECT name FROM translations WHERE id = $1", [tid]),
      ]);
      const name = meta[0]?.name ?? tid;
      const verseMap = new Map<number, { translationId: string; translationName: string; text: string }>();
      for (const v of verses) {
        verseMap.set(v.verse, { translationId: tid, translationName: name, text: v.text });
      }
      result.set(tid, verseMap);
    })
  );

  return result;
}

export async function searchVerses(
  translationId: string,
  searchText: string,
  limit = 50
): Promise<Verse[]> {
  return query<Verse>(
    `SELECT v.* FROM verses v
     JOIN verses_fts fts ON v.id = fts.rowid
     WHERE fts.text MATCH $1 AND v.translation_id = $2
     LIMIT $3`,
    [searchText, translationId, limit]
  );
}
