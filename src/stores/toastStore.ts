import { create } from "zustand";

export type ToastType = "success" | "error";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastState {
  toasts: Toast[];
  showToast: (message: string, type: ToastType) => void;
  dismissToast: (id: string) => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  showToast: (message, type) => {
    const id = String(++nextId);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
