import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "./Icon";

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  back?: boolean;
  right?: ReactNode;
}

export default function PageHeader({ title, subtitle, back, right }: PageHeaderProps) {
  const navigate = useNavigate();
  return (
    <header
      className="glass sticky top-0 z-30 flex items-center gap-2 px-2 py-2"
      style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
    >
      {back ? (
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          className="rounded-full p-2.5 active:bg-surface-2"
          aria-label="Back"
        >
          <Icon name="chevronLeft" className="h-6 w-6" />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
