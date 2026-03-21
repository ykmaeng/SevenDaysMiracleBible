import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export type CommentaryPosition = "right" | "bottom" | "left";

interface SettingsState {
  language: string;
  fontSize: number;
  fontFamily: string;
  theme: "light" | "dark" | "system";
  defaultTranslation: string;
  showVerseNumbers: boolean;
  showParallelInline: boolean;
  versePerLine: boolean;
  parallelTranslations: string[];
  commentaryPosition: CommentaryPosition;
  commentarySplitRatio: number;
  ttsVoiceName: string;
  ttsSpeed: number;
  ttsOnline: boolean;
  ttsOnlineVoice: string;
  showDictionary: boolean;
  showNotes: boolean;
  showCommentary: boolean;
  onboardingComplete: boolean;
  tipsComplete: boolean;
}

interface SettingsActions {
  setLanguage: (lang: string) => void;
  setFontSize: (size: number) => void;
  setFontFamily: (family: string) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setDefaultTranslation: (id: string) => void;
  setShowVerseNumbers: (show: boolean) => void;
  setShowParallelInline: (show: boolean) => void;
  setVersePerLine: (show: boolean) => void;
  setCommentaryPosition: (pos: CommentaryPosition) => void;
  setCommentarySplitRatio: (ratio: number) => void;
  toggleParallelTranslation: (id: string) => void;
  reorderParallelTranslation: (fromIndex: number, toIndex: number) => void;
  setTtsVoiceName: (name: string) => void;
  setTtsSpeed: (speed: number) => void;
  setTtsOnline: (on: boolean) => void;
  setTtsOnlineVoice: (name: string) => void;
  setShowDictionary: (show: boolean) => void;
  setShowNotes: (show: boolean) => void;
  setShowCommentary: (show: boolean) => void;
  completeOnboarding: () => void;
  completeTips: () => void;
}

export const DEFAULT_TRANSLATION_BY_LANG: Record<string, string> = {
  ko: "sav-ko",
  en: "kjv",
};

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    immer((set) => ({
      language: "ko",
      fontSize: 16,
      fontFamily: "",
      theme: "system",
      defaultTranslation: "kjv",
      showVerseNumbers: true,
      showParallelInline: false,
      versePerLine: false,
      parallelTranslations: ["kjv", "sav-ko"],
      commentaryPosition: (window.innerWidth < 768 ? "bottom" : "right") as CommentaryPosition,
      commentarySplitRatio: 0.6,
      ttsVoiceName: "",
      ttsSpeed: 1.0,
      ttsOnline: true,
      ttsOnlineVoice: "",
      showDictionary: true,
      showNotes: false,
      showCommentary: false,
      onboardingComplete: false,
      tipsComplete: false,

      setLanguage: (lang) =>
        set((state) => {
          state.language = lang;
          state.defaultTranslation = DEFAULT_TRANSLATION_BY_LANG[lang] ?? "kjv";
        }),

      setFontSize: (size) =>
        set((state) => {
          state.fontSize = Math.max(12, Math.min(28, size));
        }),

      setFontFamily: (family) =>
        set((state) => {
          state.fontFamily = family;
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

      setVersePerLine: (show) =>
        set((state) => {
          state.versePerLine = show;
        }),

      setCommentaryPosition: (pos) =>
        set((state) => {
          state.commentaryPosition = pos;
        }),

      setCommentarySplitRatio: (ratio) =>
        set((state) => {
          state.commentarySplitRatio = Math.max(0.2, Math.min(0.8, ratio));
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

      setTtsVoiceName: (name) =>
        set((state) => {
          state.ttsVoiceName = name;
        }),

      setTtsSpeed: (speed) =>
        set((state) => {
          state.ttsSpeed = Math.max(0.5, Math.min(2.0, speed));
        }),

      setTtsOnline: (on) =>
        set((state) => {
          state.ttsOnline = on;
        }),

      setTtsOnlineVoice: (name) =>
        set((state) => {
          state.ttsOnlineVoice = name;
        }),

      setShowDictionary: (show) =>
        set((state) => {
          state.showDictionary = show;
        }),

      setShowNotes: (show) =>
        set((state) => {
          state.showNotes = show;
        }),

      setShowCommentary: (show) =>
        set((state) => {
          state.showCommentary = show;
        }),

      completeOnboarding: () =>
        set((state) => {
          state.onboardingComplete = true;
        }),

      completeTips: () =>
        set((state) => {
          state.tipsComplete = true;
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
