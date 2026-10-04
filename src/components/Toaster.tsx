import { createPortal } from "react-dom";
import { dismissToast, useToasts } from "../lib/toast";

export default function Toaster() {
  const toasts = useToasts();
  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[60] flex flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(5.75rem + env(safe-area-inset-bottom))" }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex w-full max-w-sm animate-fade-up items-center justify-between gap-3 rounded-2xl border border-line bg-surface-3/95 px-4 py-3 text-sm shadow-2xl backdrop-blur"
        >
          <span>{t.message}</span>
          {t.action && (
            <button
              className="font-semibold text-brand"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
