import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Utility for lazy loading components with proper suspense handling
 * Use this for route-based code splitting and large components
 * 
 * @param importFn Function that imports the component dynamically
 * @param options Configuration options
 * @returns Lazy loaded component with suspense fallback
 */
export function lazyLoad(
  importFn: () => Promise<{ default: React.ComponentType<any> }>,
  options: {
    fallback?: React.ReactNode;
    suspenseProps?: React.SuspenseProps;
    preload?: boolean;
  } = {}
) {
  const LazyComponent = React.lazy(importFn);
  
  // Optionally preload the component
  if (options.preload) {
    importFn();
  }
  
  // Default loading indicator
  const defaultFallback = (
    <div className="flex items-center justify-center w-full h-full min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
  
  return (props: any) => (
    <Suspense 
      fallback={options.fallback || defaultFallback} 
      {...options.suspenseProps}
    >
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * Utility to preload a component without rendering it
 * Useful for preloading routes that are likely to be visited next
 * 
 * @param importFn Function that imports the component dynamically
 */
export function preloadComponent(
  importFn: () => Promise<{ default: React.ComponentType<any> }>
) {
  return importFn();
}