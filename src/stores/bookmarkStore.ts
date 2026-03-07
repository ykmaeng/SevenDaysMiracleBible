import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Bookmark } from "../types/bible";
import * as bookmarkDb from "../lib/bookmarks";

interface BookmarkState {
  /** key: "bookId:chapter:verse" */
  bookmarks: Record<string, Bookmark>;
  loadedChapter: string | null;
}

interface BookmarkActions {
  loadChapterBookmarks: (bookId: number, chapter: number) => Promise<void>;
  addBookmark: (bookId: number, chapter: number, verse: number, color?: string, note?: string, translationId?: string) => Promise<void>;
  removeBookmark: (bookId: number, chapter: number, verse: number) => Promise<void>;
  updateColor: (bookId: number, chapter: number, verse: number, color: string | null) => Promise<void>;
  updateNote: (bookId: number, chapter: number, verse: number, note: string | null) => Promise<void>;
  getBookmark: (bookId: number, chapter: number, verse: number) => Bookmark | undefined;
}

function key(bookId: number, chapter: number, verse: number) {
  return `${bookId}:${chapter}:${verse}`;
}

export const useBookmarkStore = create<BookmarkState & BookmarkActions>()(
  immer((set, get) => ({
    bookmarks: {},
    loadedChapter: null,

    loadChapterBookmarks: async (bookId, chapter) => {
      const chapterKey = `${bookId}:${chapter}`;
      if (get().loadedChapter === chapterKey) return;
      const rows = await bookmarkDb.getChapterBookmarks(bookId, chapter);
      set((state) => {
        state.bookmarks = {};
        for (const bm of rows) {
          state.bookmarks[key(bm.book_id, bm.chapter, bm.verse)] = bm;
        }
        state.loadedChapter = chapterKey;
      });
    },

    addBookmark: async (bookId, chapter, verse, color, note, translationId) => {
      const id = await bookmarkDb.addBookmark(bookId, chapter, verse, color, note, translationId);
      set((state) => {
        state.bookmarks[key(bookId, chapter, verse)] = {
          id,
          book_id: bookId,
          chapter,
          verse,
          color: color ?? null,
          note: note ?? null,
          translation_id: translationId ?? null,
          created_at: new Date().toISOString(),
        };
      });
    },

    removeBookmark: async (bookId, chapter, verse) => {
      await bookmarkDb.removeBookmark(bookId, chapter, verse);
      set((state) => {
        delete state.bookmarks[key(bookId, chapter, verse)];
      });
    },

    updateColor: async (bookId, chapter, verse, color) => {
      await bookmarkDb.updateBookmarkColor(bookId, chapter, verse, color);
      set((state) => {
        const bm = state.bookmarks[key(bookId, chapter, verse)];
        if (bm) bm.color = color;
      });
    },

    updateNote: async (bookId, chapter, verse, note) => {
      await bookmarkDb.updateBookmarkNote(bookId, chapter, verse, note);
      set((state) => {
        const bm = state.bookmarks[key(bookId, chapter, verse)];
        if (bm) bm.note = note;
      });
    },

    getBookmark: (bookId, chapter, verse) => {
      return get().bookmarks[key(bookId, chapter, verse)];
    },
  }))
);
