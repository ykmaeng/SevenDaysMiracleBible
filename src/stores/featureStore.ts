import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

export interface FeatureConfig {
  id: string;
  labelKey: string;
  descKey: string;
  instructionKey: string;
  showInTabBar: boolean;
  showInFloating: boolean;
  showInReaderSettings: boolean;
}

export const FEATURE_REGISTRY: FeatureConfig[] = [
  {
    id: "bookmarks",
    labelKey: "features.bookmarks",
    descKey: "features.bookmarksDesc",
    instructionKey: "features.bookmarksInstruction",
    showInTabBar: true,
    showInFloating: true,
    showInReaderSettings: false,
  },
  {
    id: "highlights",
    labelKey: "features.highlights",
    descKey: "features.highlightsDesc",
    instructionKey: "features.highlightsInstruction",
    showInTabBar: true,
    showInFloating: true,
    showInReaderSettings: false,
  },
  {
    id: "notes",
    labelKey: "features.notes",
    descKey: "features.notesDesc",
    instructionKey: "features.notesInstruction",
    showInTabBar: false,
    showInFloating: true,
    showInReaderSettings: true,
  },
  {
    id: "commentary",
    labelKey: "features.commentary",
    descKey: "features.commentaryDesc",
    instructionKey: "features.commentaryInstruction",
    showInTabBar: false,
    showInFloating: false,
    showInReaderSettings: true,
  },
  {
    id: "interlinear",
    labelKey: "features.interlinear",
    descKey: "features.interlinearDesc",
    instructionKey: "features.interlinearInstruction",
    showInTabBar: false,
    showInFloating: false,
    showInReaderSettings: true,
  },
  {
    id: "dictionary",
    labelKey: "features.dictionary",
    descKey: "features.dictionaryDesc",
    instructionKey: "features.dictionaryInstruction",
    showInTabBar: false,
    showInFloating: false,
    showInReaderSettings: true,
  },
];

interface FeatureState {
  enabledFeatures: string[];
}

interface FeatureActions {
  toggleFeature: (id: string) => void;
  isEnabled: (id: string) => boolean;
}

export const useFeatureStore = create<FeatureState & FeatureActions>()(
  persist(
    immer((set, get) => ({
      enabledFeatures: [],

      toggleFeature: (id) =>
        set((state) => {
          const idx = state.enabledFeatures.indexOf(id);
          if (idx >= 0) {
            state.enabledFeatures.splice(idx, 1);
          } else {
            state.enabledFeatures.push(id);
          }
        }),

      isEnabled: (id) => {
        return get().enabledFeatures.includes(id);
      },
    })),
    { name: "bible-features" }
  )
);
