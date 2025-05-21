import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import ErrorPage from '@/pages/error';

interface GlobalErrorBoundaryProps {
  children: ReactNode;
}

/**
 * Global error boundary to catch unexpected errors across the application.
 * Displays a friendly error page instead of leaving the UI blank.
 */
export default function GlobalErrorBoundary({ children }: GlobalErrorBoundaryProps) {
  const handleError = (error: Error, info: React.ErrorInfo): void => {
    // In production, send this information to an error monitoring service
    console.error('Global error caught:', error, info);
  };

  const handleReset = (): void => {
    window.location.reload();
  };

  return (
    <ErrorBoundary fallback={<ErrorPage />} onError={handleError} onReset={handleReset}>
      {children}
    </ErrorBoundary>
  );
}
