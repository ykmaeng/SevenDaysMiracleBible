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
}

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
    })),
    { name: "bible-settings" }
  )
);
