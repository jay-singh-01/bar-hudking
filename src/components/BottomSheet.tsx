import { createPortal } from "react-dom";
import type { ReactNode } from "react";

interface BottomSheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

// Portaled to document.body deliberately: a `backdrop-blur` ancestor (the
// sticky header) creates a new containing block for `position: fixed` in
// Chromium, which would otherwise pin this sheet to the header instead of
// the viewport.
export default function BottomSheet({ title, onClose, children, footer }: BottomSheetProps) {
  return createPortal(
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col rounded-t-2xl bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-sm text-slate-400">
            Done
          </button>
        </div>

        <div className="overflow-y-auto p-4">{children}</div>

        {footer && <div className="shrink-0 border-t border-slate-800 p-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
