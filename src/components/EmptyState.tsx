import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ icon = "compass", title, message, action }: EmptyStateProps) {
  return (
    <div className="flex animate-fade-up flex-col items-center gap-3 px-8 py-16 text-center">
      <Icon name={icon} className="mb-1 h-7 w-7 text-faint" strokeWidth={1.5} />
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted">{message}</p>
      {action && (
        <button onClick={action.onClick} className="btn-ghost mt-2">
          {action.label}
        </button>
      )}
    </div>
  );
}
