import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error in component tree:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-4 text-center">
          <h1 className="text-lg font-semibold text-slate-100">Something went wrong</h1>
          <p className="max-w-xs text-sm text-slate-400">
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-slate-950"
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
