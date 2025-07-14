import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { APP_ROUTES, API_ROUTES } from './constants';
import { User } from './types';
import { apiRequest } from './queryClient';
import { useToast } from '@/hooks/use-toast';
import { SafeStorage, STORAGE_KEYS } from './safe-storage';

// Simple logger for client-side logging
const logger = {
  info: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[AUTH] ${message}`, meta);
    }
  },
  error: (message: string, meta?: any) => {
    console.error(`[AUTH] ${message}`, meta);
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[AUTH] ${message}`, meta);
  }
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);



export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Handle SSO logout redirects (Auth0 or MIT Horizon)
    const handleSSOLogoutRedirect = () => {
      try {
        // Check for Auth0 logout redirect
        if (SafeStorage.getItem(STORAGE_KEYS.AUTH0_LOGOUT_REDIRECT) === 'true') {
          logger.info('Processing Auth0 logout redirect');
          SafeStorage.removeItem(STORAGE_KEYS.AUTH0_LOGOUT_REDIRECT);
          navigate(APP_ROUTES.LOGIN);
        }
        
        // Check for MIT Horizon OIDC logout redirect
        if (SafeStorage.getItem(STORAGE_KEYS.HORIZON_LOGOUT_REDIRECT) === 'true') {
          logger.info('Processing MIT Horizon logout redirect');
          SafeStorage.removeItem(STORAGE_KEYS.HORIZON_LOGOUT_REDIRECT);
          navigate(APP_ROUTES.LOGIN);
        }
      } catch (error) {
        logger.error('Error handling SSO logout redirect', { error });
      }
    };
    
    async function loadUser() {
      try {
        // Check for SSO logout redirects first
        handleSSOLogoutRedirect();
        
        const response = await fetch(API_ROUTES.USER, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        logger.error('Failed to load user', { error });
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [navigate]);

  // Helper function to get the returnTo parameter from URL
  const getReturnToPath = () => {
    try {
      const queryParams = new URLSearchParams(window.location.search);
      const returnTo = queryParams.get('returnTo');
      // Ensure returnTo is safe - only relative paths allowed
      if (returnTo && returnTo.startsWith('/') && !returnTo.includes('//')) {
        return returnTo;
      }
    } catch (error) {
      logger.error('Error parsing returnTo parameter', { error });
    }
    return null;
  };

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', API_ROUTES.LOGIN, { username, password });
      const userData = await response.json();
      
      setUser(userData);
      
      // Check if there's a returnTo parameter in the URL
      const returnTo = getReturnToPath();
      if (returnTo) {
        // Use the returnTo path for redirection after successful login
        // Redirect logging removed for production
        navigate(returnTo);
      } else {
        // Default redirect based on user role
        if (userData.role === 'admin') {
          navigate(APP_ROUTES.ADMIN_DASHBOARD);
        } else if (userData.role === 'instructor') {
          navigate(APP_ROUTES.INSTRUCTOR_DASHBOARD);
        } else {
          navigate(APP_ROUTES.DASHBOARD);
        }
      }
      
      toast({
        title: 'Login successful',
        description: `Welcome back, ${userData.name}!`,
      });
    } catch (error) {
      logger.error('Login failed', { error });
      toast({
        variant: 'destructive',
        title: 'Login failed',
        description: error instanceof Error ? error.message : 'Invalid credentials',
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const response = await apiRequest('POST', API_ROUTES.LOGOUT, {});
      const data = await response.json();
      
      // Clear user from state
      setUser(null);
      
      // If the server indicates we need to redirect for SSO logout
      if (data.redirect && data.redirectUrl) {
        // Determine if this is an Auth0 or MIT Horizon redirect based on the URL
        const isAuth0Redirect = data.redirectUrl.includes('auth0.com');
        const isMitHorizonRedirect = data.redirectUrl.includes('mit-horizon.auth0.com');
        
        if (isMitHorizonRedirect) {
          logger.info('Setting MIT Horizon logout redirect flag');
          safeStorage.setItem(STORAGE_KEYS.HORIZON_LOGOUT_REDIRECT, 'true');
        } else if (isAuth0Redirect) {
          logger.info('Setting Auth0 logout redirect flag');
          safeStorage.setItem(STORAGE_KEYS.AUTH0_LOGOUT_REDIRECT, 'true');
        } else {
          logger.info('Setting generic SSO logout redirect flag');
          safeStorage.setItem(STORAGE_KEYS.AUTH0_LOGOUT_REDIRECT, 'true');
        }
        
        // Use window.location for full page redirect to SSO provider
        window.location.href = data.redirectUrl;
        return; // Exit early since we're redirecting
      }
      
      // Normal logout flow (no SSO)
      navigate(APP_ROUTES.LOGIN);
      toast({
        title: 'Logged out',
        description: 'You have been successfully logged out',
      });
    } catch (error) {
      logger.error('Logout failed', { error });
      toast({
        variant: 'destructive',
        title: 'Logout failed',
        description: 'An error occurred during logout',
      });
      
      // Even if logout fails on server, clear local state
      setUser(null);
      navigate(APP_ROUTES.LOGIN);
    }
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}