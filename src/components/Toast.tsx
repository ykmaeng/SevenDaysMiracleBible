import { useEffect, useState } from "react";
import { useToastStore, type ToastType } from "../stores/toastStore";

function ToastItem({ id, message, type }: { id: string; message: string; type: ToastType }) {
  const dismiss = useToastStore((s) => s.dismissToast);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true));

    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => dismiss(id), 300);
    }, 3000);

    return () => clearTimeout(timer);
  }, [id, dismiss]);

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white text-sm transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      } ${type === "success" ? "bg-green-600" : "bg-red-600"}`}
    >
      <span className="flex-1">{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(() => dismiss(id), 300);
        }}
        className="opacity-70 hover:opacity-100 shrink-0"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 max-w-sm w-full px-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  );
}
