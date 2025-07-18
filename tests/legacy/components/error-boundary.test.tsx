import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary } from '../../client/src/components/ui/error-boundary';
import React from 'react';

// Test components
const WorkingComponent = () => <div>Working component</div>;

const BrokenComponent = () => {
  throw new Error('Test error');
  return <div>This should not render</div>;
};

// Mock console.error to prevent test output noise
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary Component', () => {
  it('should render children when no error occurs', () => {
    const { container } = render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Working component')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('Something went wrong');
  });
  
  it('should render error UI when child component throws', () => {
    // We need to spy on console.error and mock it to prevent the expected error from being logged
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <BrokenComponent />
      </ErrorBoundary>
    );
    
    // Error boundary should display fallback UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    
    // Clean up
    errorSpy.mockRestore();
  });
  
  it('should use custom fallback if provided', () => {
    // Custom fallback component
    const customFallback = <div data-testid="custom-fallback">Custom error message</div>;
    
    // We need to spy on console.error and mock it to prevent the expected error from being logged
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary fallback={customFallback}>
        <BrokenComponent />
      </ErrorBoundary>
    );
    
    // Should render custom fallback
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
    
    // Should not render default fallback
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    
    // Clean up
    errorSpy.mockRestore();
  });
  
  it('should call onError when error occurs', () => {
    const onErrorMock = vi.fn();
    
    // We need to spy on console.error and mock it to prevent the expected error from being logged
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary onError={onErrorMock}>
        <BrokenComponent />
      </ErrorBoundary>
    );
    
    // onError should be called with the error
    expect(onErrorMock).toHaveBeenCalledTimes(1);
    expect(onErrorMock.mock.calls[0][0].message).toBe('Test error');
    
    // Clean up
    errorSpy.mockRestore();
  });
  
  it('should reset when Try Again button is clicked', () => {
    // Create a component that throws only on first render
    const ThrowOnceComponent = () => {
      const [hasThrown, setHasThrown] = React.useState(false);
      
      if (!hasThrown) {
        setHasThrown(true);
        throw new Error('First render error');
      }
      
      return <div>Component recovered</div>;
    };
    
    // We need to spy on console.error and mock it to prevent the expected error from being logged
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <ErrorBoundary>
        <ThrowOnceComponent />
      </ErrorBoundary>
    );
    
    // Error boundary should display fallback UI
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    
    // Click the Try Again button
    fireEvent.click(screen.getByText('Try Again'));
    
    // Component should now render successfully
    expect(screen.getByText('Component recovered')).toBeInTheDocument();
    
    // Clean up
    errorSpy.mockRestore();
  });
  
  it('should support higher-order component pattern', () => {
    const WrappedComponent = withErrorBoundary(WorkingComponent, {});
    
    const { container } = render(<WrappedComponent />);
    
    expect(screen.getByText('Working component')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('Something went wrong');
  });
});