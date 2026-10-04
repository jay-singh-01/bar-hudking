import type { ReactNode } from "react";

interface EmptyStateProps {
  emoji: string;
  title: string;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ emoji, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex animate-fade-up flex-col items-center gap-3 px-8 py-16 text-center">
      <div className="mb-1 flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 text-4xl">{emoji}</div>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted">{message}</p>
      {action && (
        <button onClick={action.onClick} className="btn-primary mt-2">
          {action.label}
        </button>
      )}
    </div>
  );
}
