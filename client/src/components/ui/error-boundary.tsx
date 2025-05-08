import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * An error boundary component that catches JavaScript errors in its child component tree.
 * Displays a fallback UI when an error occurs instead of crashing the entire application.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetErrorBoundary = (): void => {
    // Reset the error boundary state
    this.setState({
      hasError: false,
      error: null
    });
    
    // Call the onReset callback if provided
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default fallback UI
      return (
        <Card className="w-full max-w-md mx-auto mt-8 border-red-200">
          <CardHeader className="bg-red-50 border-b border-red-100">
            <CardTitle className="text-red-800 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Something went wrong
            </CardTitle>
            <CardDescription className="text-red-700">
              We encountered an error while rendering this component
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error details</AlertTitle>
              <AlertDescription className="mt-2">
                <div className="text-sm bg-red-50 p-2 rounded border border-red-200 overflow-auto max-h-32">
                  {this.state.error?.message || 'Unknown error'}
                </div>
              </AlertDescription>
            </Alert>
            <p className="text-sm text-neutral-600">
              Please try refreshing the page. If the problem persists, contact support.
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 bg-gray-50 border-t">
            <Button variant="outline" onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
            <Button onClick={this.resetErrorBoundary} className="gap-1">
              <ReloadIcon className="h-4 w-4" />
              Try Again
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * A hook-based wrapper for the ErrorBoundary component.
 * This allows for easier usage of the error boundary in functional components.
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryProps, 'children'>
): React.FC<P> {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}