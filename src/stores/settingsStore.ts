import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

interface SettingsState {
  language: string;
  fontSize: number;
  theme: "light" | "dark" | "system";
  defaultTranslation: string;
  showVerseNumbers: boolean;
  parallelTranslations: string[];
}

interface SettingsActions {
  setLanguage: (lang: string) => void;
  setFontSize: (size: number) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setDefaultTranslation: (id: string) => void;
  setShowVerseNumbers: (show: boolean) => void;
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
      parallelTranslations: ["kjv"],

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
    { name: "bible-settings" }
  )
);
