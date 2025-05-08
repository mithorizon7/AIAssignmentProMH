import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Variable to store our CSRF token
let csrfToken: string | null = null;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
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
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Prepare request headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // If it's a state-changing request (not GET/HEAD/OPTIONS), add CSRF token
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
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
        // Invalidate the token
        csrfToken = null;
        
        // Retry the request with a fresh token
        const newToken = await fetchCsrfToken();
        const retryRes = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': newToken,
          },
          body: data ? JSON.stringify(data) : undefined,
          credentials: "include",
        });
        
        await throwIfResNotOk(retryRes);
        return retryRes;
      }
    } catch (e) {
      // If we can't parse the response as JSON, continue with normal error handling
    }
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
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
