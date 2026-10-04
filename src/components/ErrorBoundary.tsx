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
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-5xl">🫗</div>
          <h1 className="text-xl font-bold">Something spilled</h1>
          <p className="max-w-xs text-sm text-muted">
            {this.state.error.message || "An unexpected error occurred."} Your saved places are safe on this device.
          </p>
          <button onClick={() => window.location.assign("/")} className="btn-primary mt-2">
            Back to Discover
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
