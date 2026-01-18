import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * DesignSystemErrorBoundary - Error boundary component for design system
 * 
 * Catches errors in child components and displays a fallback UI
 * instead of crashing the entire application.
 * 
 * @example
 * ```tsx
 * <DesignSystemErrorBoundary>
 *   <MyComponent />
 * </DesignSystemErrorBoundary>
 * ```
 * 
 * @example With custom fallback
 * ```tsx
 * <DesignSystemErrorBoundary fallback={<CustomErrorUI />}>
 *   <MyComponent />
 * </DesignSystemErrorBoundary>
 * ```
 */
export class DesignSystemErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('Design System Component Error:', error);
      console.error('Component Stack:', errorInfo.componentStack);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-rose-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-rose-900">
                Произошла ошибка при отображении компонента
              </p>
              {import.meta.env.DEV && this.state.error && (
                <p className="mt-1 text-xs text-rose-600 font-mono">
                  {this.state.error.message}
                </p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Export as default for convenience
export default DesignSystemErrorBoundary;
