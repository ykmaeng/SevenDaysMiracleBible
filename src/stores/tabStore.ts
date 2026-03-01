import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useSettingsStore } from "./settingsStore";

const MAX_TABS = Infinity;

export interface Tab {
  id: string;
  translationId: string;
  bookId: number;
  chapter: number;
  verse?: number;
  scrollPosition: number;
  pinned?: boolean;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string;
}

interface TabActions {
  addTab: (tab?: Partial<Tab>) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  togglePin: (id: string) => void;
  reorderTab: (fromIndex: number, toIndex: number) => void;
  navigateTo: (bookId: number, chapter: number, verse?: number) => void;
}

function createTabId(): string {
  return crypto.randomUUID();
}

function getDefaultTranslationId(): string {
  return useSettingsStore.getState().defaultTranslation || "kjv";
}

const defaultTab: Tab = {
  id: "initial",
  translationId: "kjv",
  bookId: 1,
  chapter: 1,
  scrollPosition: 0,
};

export const useTabStore = create<TabState & TabActions>()(
  persist(
    immer((set, get) => ({
      tabs: [defaultTab],
      activeTabId: defaultTab.id,

      addTab: (partial) => {
        const { tabs } = get();
        if (tabs.length >= MAX_TABS) return;

        const newTab: Tab = {
          id: createTabId(),
          translationId: partial?.translationId ?? getDefaultTranslationId(),
          bookId: partial?.bookId ?? 1,
          chapter: partial?.chapter ?? 1,
          verse: partial?.verse,
          scrollPosition: 0,
        };

        set((state) => {
          state.tabs.push(newTab);
          state.activeTabId = newTab.id;
        });
      },

      closeTab: (id) => {
        const { tabs, activeTabId } = get();
        if (tabs.length <= 1) return;

        set((state) => {
          const idx = state.tabs.findIndex((t) => t.id === id);
          state.tabs.splice(idx, 1);
          if (activeTabId === id) {
            state.activeTabId = state.tabs[Math.max(0, idx - 1)].id;
          }
        });
      },

      setActiveTab: (id) => {
        set((state) => {
          state.activeTabId = id;
        });
      },

      updateTab: (id, updates) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.id === id);
          if (tab) Object.assign(tab, updates);
        });
      },

      togglePin: (id) => {
        set((state) => {
          const tab = state.tabs.find((t) => t.id === id);
          if (!tab) return;
          tab.pinned = !tab.pinned;
          // Sort: pinned tabs first, preserve relative order within each group
          const pinned = state.tabs.filter((t) => t.pinned);
          const unpinned = state.tabs.filter((t) => !t.pinned);
          state.tabs = [...pinned, ...unpinned];
        });
      },

      reorderTab: (fromIndex, toIndex) => {
        set((state) => {
          const [moved] = state.tabs.splice(fromIndex, 1);
          state.tabs.splice(toIndex, 0, moved);
        });
      },

      navigateTo: (bookId, chapter, verse) => {
        const { activeTabId } = get();
        set((state) => {
          const tab = state.tabs.find((t) => t.id === activeTabId);
          if (tab) {
            tab.bookId = bookId;
            tab.chapter = chapter;
            tab.verse = verse;
            tab.scrollPosition = 0;
          }
        });
      },
    })),
    { name: "bible-tabs" }
  )
);
