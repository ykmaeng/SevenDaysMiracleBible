import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type CommentaryPosition = "right" | "bottom" | "left";

interface SettingsState {
  language: string;
  fontSize: number;
  theme: "light" | "dark" | "system";
  defaultTranslation: string;
  showVerseNumbers: boolean;
  showParallelInline: boolean;
  parallelTranslations: string[];
  commentaryPosition: CommentaryPosition;
}

interface SettingsActions {
  setLanguage: (lang: string) => void;
  setFontSize: (size: number) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setDefaultTranslation: (id: string) => void;
  setShowVerseNumbers: (show: boolean) => void;
  setShowParallelInline: (show: boolean) => void;
  setCommentaryPosition: (pos: CommentaryPosition) => void;
  toggleParallelTranslation: (id: string) => void;
  reorderParallelTranslation: (fromIndex: number, toIndex: number) => void;
}

export const DEFAULT_TRANSLATION_BY_LANG: Record<string, string> = {
  ko: "ai-ko",
  en: "kjv",
  zh: "cuv",
  es: "rv1909",
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    immer((set) => ({
      language: "ko",
      fontSize: 16,
      theme: "system",
      defaultTranslation: "kjv",
      showVerseNumbers: true,
      showParallelInline: false,
      parallelTranslations: ["kjv"],
      commentaryPosition: "right" as CommentaryPosition,

      setLanguage: (lang) =>
        set((state) => {
          state.language = lang;
          state.defaultTranslation = DEFAULT_TRANSLATION_BY_LANG[lang] ?? "kjv";
        }),

      setFontSize: (size) =>
        set((state) => {
          state.fontSize = Math.max(12, Math.min(28, size));
        }),

      setTheme: (theme) =>
        set((state) => {
          state.theme = theme;
        }),

      setDefaultTranslation: (id) =>
        set((state) => {
          state.defaultTranslation = id;
        }),

      setShowVerseNumbers: (show) =>
        set((state) => {
          state.showVerseNumbers = show;
        }),

      setShowParallelInline: (show) =>
        set((state) => {
          state.showParallelInline = show;
        }),

      setCommentaryPosition: (pos) =>
        set((state) => {
          state.commentaryPosition = pos;
        }),

      toggleParallelTranslation: (id) =>
        set((state) => {
          const idx = state.parallelTranslations.indexOf(id);
          if (idx >= 0) {
            state.parallelTranslations.splice(idx, 1);
          } else {
            state.parallelTranslations.push(id);
          }
        }),

      reorderParallelTranslation: (fromIndex, toIndex) =>
        set((state) => {
          const item = state.parallelTranslations.splice(fromIndex, 1)[0];
          state.parallelTranslations.splice(toIndex, 0, item);
        }),
    })),
    {
      name: "bible-settings",
      onRehydrateStorage: () => (state) => {
        if (state) {
          const expected = DEFAULT_TRANSLATION_BY_LANG[state.language] ?? "kjv";
          if (state.defaultTranslation !== expected) {
            state.setDefaultTranslation(expected);
          }
        }
      },
    }
  )
);
