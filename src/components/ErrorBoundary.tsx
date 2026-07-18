/**
 * ErrorBoundary — limitează erorile React și afișează fallback-uri i18n.
 */
import { Component, type ReactNode, type ErrorInfo } from "react";
import { toUserMessage } from "@/lib/userErrorMessage";
import { useT } from "@/i18n";

interface Props {
  children: ReactNode;
  context?: string;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const context = this.props.context ?? "Unknown";
    console.error(
      JSON.stringify({
        type: "ErrorBoundary",
        context,
        message: error.message,
        componentStack: info.componentStack?.slice(0, 500),
        timestamp: new Date().toISOString(),
      }),
    );
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback(this.state.error, this.reset);
    }

    return (
      <DefaultErrorFallback
        error={this.state.error}
        context={this.props.context}
        onReset={this.reset}
      />
    );
  }
}

function DefaultErrorFallback({
  error,
  context,
  onReset,
}: {
  error: Error;
  context?: string;
  onReset: () => void;
}) {
  const t = useT();

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-800/40 bg-red-950/30 p-6 text-center"
    >
      <div className="text-2xl">⚠</div>
      <p className="font-semibold text-red-300">
        {context
          ? t("app.errors.genericWithContext", { context })
          : t("app.errors.generic")}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground">
        {toUserMessage(error, t("app.errors.unexpected"))}
      </p>
      <button
        onClick={onReset}
        className="mt-2 rounded-lg bg-red-900/50 px-4 py-2 text-sm text-red-200 transition hover:bg-red-800/50"
      >
        {t("app.ui.tryAgain")}
      </button>
    </div>
  );
}

