import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import type { Bookmark, BookmarkLabel } from "../types/bible";
import * as bookmarkDb from "../lib/bookmarks";

interface BookmarkState {
  /** key: "bookId:chapter:verse" */
  bookmarks: Record<string, Bookmark>;
  loadedChapter: string | null;
  labels: BookmarkLabel[];
  labelsLoaded: boolean;
}

interface BookmarkActions {
  loadChapterBookmarks: (bookId: number, chapter: number) => Promise<void>;
  addBookmark: (bookId: number, chapter: number, verse: number, color?: string, note?: string, translationId?: string, labelId?: number, text?: string) => Promise<void>;
  removeBookmark: (bookId: number, chapter: number, verse: number) => Promise<void>;
  updateColor: (bookId: number, chapter: number, verse: number, color: string | null) => Promise<void>;
  updateNote: (bookId: number, chapter: number, verse: number, note: string | null) => Promise<void>;
  updateLabel: (bookId: number, chapter: number, verse: number, labelId: number | null) => Promise<void>;
  getBookmark: (bookId: number, chapter: number, verse: number) => Bookmark | undefined;
  loadLabels: () => Promise<void>;
  createLabel: (name: string) => Promise<BookmarkLabel>;
  renameLabel: (id: number, name: string) => Promise<void>;
  deleteLabel: (id: number) => Promise<void>;
}

function key(bookId: number, chapter: number, verse: number) {
  return `${bookId}:${chapter}:${verse}`;
}

export const useBookmarkStore = create<BookmarkState & BookmarkActions>()(
  immer((set, get) => ({
    bookmarks: {},
    loadedChapter: null,
    labels: [],
    labelsLoaded: false,

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

    addBookmark: async (bookId, chapter, verse, color, note, translationId, labelId, text) => {
      const id = await bookmarkDb.addBookmark(bookId, chapter, verse, color, note, translationId, labelId, text);
      set((state) => {
        state.bookmarks[key(bookId, chapter, verse)] = {
          id,
          book_id: bookId,
          chapter,
          verse,
          color: color ?? null,
          note: note ?? null,
          translation_id: translationId ?? null,
          label_id: labelId ?? null,
          text: text ?? null,
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

    updateLabel: async (bookId, chapter, verse, labelId) => {
      await bookmarkDb.updateBookmarkLabel(bookId, chapter, verse, labelId);
      set((state) => {
        const bm = state.bookmarks[key(bookId, chapter, verse)];
        if (bm) bm.label_id = labelId;
      });
    },

    getBookmark: (bookId, chapter, verse) => {
      return get().bookmarks[key(bookId, chapter, verse)];
    },

    loadLabels: async () => {
      const labels = await bookmarkDb.getAllLabels();
      set((state) => {
        state.labels = labels;
        state.labelsLoaded = true;
      });
    },

    createLabel: async (name) => {
      const label = await bookmarkDb.createLabel(name);
      set((state) => {
        state.labels.unshift(label);
      });
      return label;
    },

    renameLabel: async (id, name) => {
      await bookmarkDb.renameLabel(id, name);
      set((state) => {
        const label = state.labels.find((l) => l.id === id);
        if (label) label.name = name;
      });
    },

    deleteLabel: async (id) => {
      await bookmarkDb.deleteLabel(id);
      set((state) => {
        state.labels = state.labels.filter((l) => l.id !== id);
      });
    },
  }))
);
