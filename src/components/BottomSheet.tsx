import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";

interface BottomSheetProps {
  title?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Taller sheets for long content (filters). */
  tall?: boolean;
}

// Portaled to document.body: a `backdrop-filter` ancestor creates a new
// containing block for `position: fixed`, which would otherwise pin the sheet
// to that ancestor instead of the viewport.
export default function BottomSheet({ title, onClose, children, footer, tall }: BottomSheetProps) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const close = useCallback(() => {
    setClosing(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(onClose, 220);
  }, [onClose]);
  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close]);

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-[2px] ${closing ? "animate-fade-out" : "animate-fade-in"}`}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`flex w-full max-w-lg ${closing ? "animate-sheet-down" : "animate-sheet-up"} flex-col rounded-t-[28px] border-t border-line bg-surface shadow-2xl ${
          tall ? "h-[88vh]" : "max-h-[85vh]"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" />
        {title && (
          <div className="flex shrink-0 items-center justify-between px-5 pt-3 pb-2">
            <h2 className="text-lg font-bold">{title}</h2>
            <button
              onClick={close}
              className="-mr-2 rounded-full p-2 text-muted active:bg-surface-2"
              aria-label="Close"
            >
              <Icon name="x" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
        {footer && <div className="shrink-0 border-t border-line px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
