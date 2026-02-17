import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

interface DownloadProgress {
  translationId: string;
  progress: number; // 0-100
  status: "pending" | "downloading" | "importing" | "done" | "error";
  error?: string;
}

interface DownloadState {
  downloads: Record<string, DownloadProgress>;
}

interface DownloadActions {
  startDownload: (translationId: string) => void;
  updateProgress: (translationId: string, progress: number) => void;
  setStatus: (translationId: string, status: DownloadProgress["status"], error?: string) => void;
  clearDownload: (translationId: string) => void;
}

export const useDownloadStore = create<DownloadState & DownloadActions>()(
  immer((set) => ({
    downloads: {},

    startDownload: (translationId) =>
      set((state) => {
        state.downloads[translationId] = {
          translationId,
          progress: 0,
          status: "downloading",
        };
      }),

    updateProgress: (translationId, progress) =>
      set((state) => {
        const dl = state.downloads[translationId];
        if (dl) dl.progress = progress;
      }),

    setStatus: (translationId, status, error) =>
      set((state) => {
        const dl = state.downloads[translationId];
        if (dl) {
          dl.status = status;
          if (error) dl.error = error;
          if (status === "done") dl.progress = 100;
        }
      }),

    clearDownload: (translationId) =>
      set((state) => {
        delete state.downloads[translationId];
      }),
  }))
);
