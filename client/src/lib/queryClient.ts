import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Variable to store our CSRF token
let csrfToken: string | null = null;

/**
 * Custom error class for API responses
 */
export class ApiError extends Error {
  status: number;
  statusText: string;
  responseBody: string;

  constructor(status: number, statusText: string, responseBody: string) {
    super(`${status}: ${responseBody || statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

/**
 * Throws an ApiError if the response is not OK
 * @param res The fetch Response object
 * @throws ApiError if the response is not OK
 */
async function throwIfResNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new ApiError(res.status, res.statusText, text);
  }
}

// Function to fetch CSRF token
async function fetchCsrfToken(): Promise<string> {
  // If we already have a token, return it
  if (csrfToken) {
    return csrfToken;
  }
  
  try {
    // Fetch a new token from the server
    const res = await fetch('/api/csrf-token', {
      credentials: 'include',
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch CSRF token');
    }
    
    const data = await res.json();
    // Store the token for future requests
    csrfToken = data.csrfToken;
    return data.csrfToken; // Return the actual token string, not the nullable variable
  } catch (error) {
    console.error('Error fetching CSRF token:', error);
    throw error;
  }
}

// Enhanced API request function with CSRF token
// Define valid HTTP methods as a type
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export async function apiRequest<TData = unknown>(
  method: HttpMethod,
  url: string,
  data?: TData | undefined,
): Promise<Response> {
  // Prepare request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // If it's a state-changing request (not GET/HEAD/OPTIONS), add CSRF token
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Skip token for login/register
    if (!['/api/auth/login', '/api/auth/register'].includes(url)) {
      try {
        const token = await fetchCsrfToken();
        headers['X-CSRF-Token'] = token;
      } catch (error) {
        console.error('Failed to add CSRF token to request:', error);
        // Continue with the request anyway, server will reject if needed
      }
    }
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get a 403 with CSRF error, invalidate our token and retry once
  if (res.status === 403) {
    try {
      const errorData = await res.json();
      if (errorData.message === 'CSRF token validation failed') {
        console.warn('CSRF token validation failed. Retrying with a new token.');
        // Invalidate the token
        csrfToken = null;
        
        // Retry the request with a fresh token
        const newToken = await fetchCsrfToken();
        const retryRes = await fetch(url, {
          method, // HttpMethod type ensures this is valid
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': newToken,
          },
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        
        // Handle the second 403 more specifically
        if (retryRes.status === 403) {
          try {
            const retryErrorData = await retryRes.json();
            // If it's still a CSRF error after retry, this may indicate a more serious issue
            if (retryErrorData.message === 'CSRF token validation failed') {
              throw new ApiError(403, 'Forbidden', 'Persistent CSRF token validation failure. Please refresh the page and try again.');
            } else if (retryErrorData.message) {
              // Return any other specific error message
              throw new ApiError(403, 'Forbidden', retryErrorData.message);
            }
          } catch (retryParseError) {
            // If we can't parse the response as JSON, or if any other error occurred
            if (retryParseError instanceof ApiError) {
              throw retryParseError; // Rethrow our custom error
            }
          }
        }
        
        await throwIfResNotOk(retryRes);
        return retryRes;
      }
    } catch (e) {
      // If we can't parse the response as JSON or another error occurred
      if (e instanceof ApiError) {
        throw e; // Rethrow our custom error
      }
      // Otherwise continue with normal error handling
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
/**
 * Creates a query function for use with TanStack Query
 * @template TResponse The expected response type from the API
 * @param options Configuration options
 * @param options.on401 How to handle 401 unauthorized responses
 * @returns QueryFunction that returns the expected response type or null (if on401 is "returnNull")
 */
export const getQueryFn: <TResponse>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<TResponse | null> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // For GET requests we don't typically need a CSRF token, but we include it anyway
    // to ensure we get a token early in the user session
    let headers: Record<string, string> = {};
    
    try {
      // Try to get a CSRF token, but don't fail if we can't
      if (csrfToken === null) {
        await fetchCsrfToken();
      }
      
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken;
      }
    } catch (error) {
      // Continue without a CSRF token
      console.error('Failed to fetch CSRF token for query:', error);
    }
    
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * Creates a type-safe API client for a specific endpoint
 * @template TResponse The expected response type from the API
 * @template TRequestBody The expected request body type
 * @param baseUrl The base URL for this API client
 * @returns An object with methods for each HTTP verb
 */
export function createTypedApiClient<TResponse, TRequestBody = unknown>(baseUrl: string) {
  return {
    /**
     * Performs a GET request to the specified endpoint
     * @param id Optional ID to append to the URL
     * @returns Promise resolving to the expected response type
     */
    get: async (id?: number | string): Promise<TResponse> => {
      const url = id ? `${baseUrl}/${id}` : baseUrl;
      const res = await apiRequest<never>('GET', url);
      return await res.json();
    },
    
    /**
     * Performs a POST request to the specified endpoint
     * @param data The data to send in the request body
     * @returns Promise resolving to the expected response type
     */
    post: async (data: TRequestBody): Promise<TResponse> => {
      const res = await apiRequest<TRequestBody>('POST', baseUrl, data);
      return await res.json();
    },
    
    /**
     * Performs a PUT request to the specified endpoint
     * @param id The ID to append to the URL
     * @param data The data to send in the request body
     * @returns Promise resolving to the expected response type
     */
    put: async (id: number | string, data: TRequestBody): Promise<TResponse> => {
      const res = await apiRequest<TRequestBody>('PUT', `${baseUrl}/${id}`, data);
      return await res.json();
    },
    
    /**
     * Performs a PATCH request to the specified endpoint
     * @param id The ID to append to the URL
     * @param data The data to send in the request body
     * @returns Promise resolving to the expected response type
     */
    patch: async (id: number | string, data: Partial<TRequestBody>): Promise<TResponse> => {
      const res = await apiRequest<Partial<TRequestBody>>('PATCH', `${baseUrl}/${id}`, data);
      return await res.json();
    },
    
    /**
     * Performs a DELETE request to the specified endpoint
     * @param id The ID to append to the URL
     * @returns Promise resolving to the expected response type
     */
    delete: async (id: number | string): Promise<TResponse> => {
      const res = await apiRequest<never>('DELETE', `${baseUrl}/${id}`);
      return await res.json();
    }
  };
}
