export interface Translation {
  id: string;
  name: string;
  language: string;
  description: string | null;
  is_original: boolean;
  is_ai_generated: boolean;
  downloaded: boolean;
  download_size_mb: number | null;
  version: number;
}

export interface Book {
  id: number;
  testament: "OT" | "NT";
  chapters: number;
}

export interface BookName {
  book_id: number;
  language: string;
  name: string;
  abbreviation: string;
}

export interface Verse {
  id: number;
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface OriginalText {
  book_id: number;
  chapter: number;
  verse: number;
  hebrew_text: string | null;
  greek_text: string | null;
  transliteration: string | null;
  strongs_numbers: string | null;
}

export interface Commentary {
  id: number;
  book_id: number;
  chapter: number;
  verse: number | null;
  language: string;
  content: string;
  model_version: string | null;
  created_at: string;
}

export interface CrossReference {
  id: number;
  from_book: number;
  from_chapter: number;
  from_verse: number;
  to_book: number;
  to_chapter_start: number;
  to_verse_start: number;
  to_chapter_end: number | null;
  to_verse_end: number | null;
  votes: number;
}

export interface Bookmark {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  note: string | null;
  color: string | null;
  created_at: string;
}

export interface FeedbackItem {
  id: number;
  book_id: number;
  chapter: number;
  verse: number;
  translation_id: string;
  vote: 1 | -1;
  synced: boolean;
  created_at: string;
}

export interface BibleLocation {
  translationId: string;
  bookId: number;
  chapter: number;
  verse?: number;
}

export interface ParallelVerse {
  original: OriginalText | null;
  translations: {
    translationId: string;
    translationName: string;
    text: string;
  }[];
}
