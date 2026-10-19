import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Clears the error when it changes, e.g. the pathname, so navigating away recovers. */
  resetKey?: unknown;
  /** Where "Go to home" points. */
  homeHref?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors below it so one broken component shows a recoverable page instead of a blank screen.
 * Uses plain <a> links on purpose: a full page load is the most reliable way out of a broken client state.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled render error", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <ErrorScreen onRetry={() => this.setState({ error: null })} homeHref={this.props.homeHref ?? "/"} />;
  }
}

export function ErrorScreen({ onRetry, homeHref = "/" }: { onRetry: () => void; homeHref?: string }) {
  return (
    <div role="alert" className="container-page py-24 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-danger">
        <AlertTriangle className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-5 text-3xl sm:text-4xl">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-md text-muted">This page hit an unexpected problem. Try again, or head back to the home page. If it keeps happening, please let us know.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onRetry} className="inline-flex h-11 items-center rounded-button bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark">
          Try again
        </button>
        <a href={homeHref} className="inline-flex h-11 items-center rounded-button border border-line-strong bg-white px-5 text-sm font-semibold text-ink hover:bg-primary-soft">
          Go to home
        </a>
      </div>
    </div>
  );
}
