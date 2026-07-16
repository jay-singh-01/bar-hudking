interface EmptyStateProps {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-slate-200">{title}</h2>
      <p className="max-w-xs text-sm text-slate-400">{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-slate-950"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
