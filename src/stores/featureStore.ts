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
    id: "tabs",
    labelKey: "features.tabs",
    descKey: "features.tabsDesc",
    instructionKey: "features.tabsInstruction",
    showInTabBar: false,
    showInFloating: false,
    showInReaderSettings: false,
  },
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
    showInTabBar: true,
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
  featureOrder: string[];
}

interface FeatureActions {
  toggleFeature: (id: string) => void;
  isEnabled: (id: string) => boolean;
  reorderFeature: (fromIdx: number, toIdx: number) => void;
  getOrderedFeatures: () => FeatureConfig[];
}

export const useFeatureStore = create<FeatureState & FeatureActions>()(
  persist(
    immer((set, get) => ({
      enabledFeatures: [],
      featureOrder: FEATURE_REGISTRY.map((f) => f.id),

      toggleFeature: (id) =>
        set((state) => {
          const idx = state.enabledFeatures.indexOf(id);
          if (idx >= 0) {
            state.enabledFeatures.splice(idx, 1);
          } else {
            state.enabledFeatures.push(id);
          }
          // Ensure featureOrder includes all registry IDs
          for (const f of FEATURE_REGISTRY) {
            if (!state.featureOrder.includes(f.id)) {
              state.featureOrder.push(f.id);
            }
          }
        }),

      isEnabled: (id) => {
        return get().enabledFeatures.includes(id);
      },

      reorderFeature: (fromIdx, toIdx) =>
        set((state) => {
          const [item] = state.featureOrder.splice(fromIdx, 1);
          state.featureOrder.splice(toIdx, 0, item);
        }),

      getOrderedFeatures: () => {
        const { featureOrder } = get();
        // Ensure all registry features are in the order list
        const allIds = new Set(FEATURE_REGISTRY.map((f) => f.id));
        const order = featureOrder.filter((id) => allIds.has(id));
        for (const f of FEATURE_REGISTRY) {
          if (!order.includes(f.id)) order.push(f.id);
        }
        return order
          .map((id) => FEATURE_REGISTRY.find((f) => f.id === id)!)
          .filter(Boolean);
      },
    })),
    { name: "bible-features" }
  )
);
