import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'wouter';
import { APP_ROUTES, API_ROUTES } from './constants';
import { User } from './types';
import { apiRequest } from './queryClient';
import { useToast } from '@/hooks/use-toast';

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
    // Handle Auth0 logout redirect if returning from Auth0 logout page
    const handleAuth0LogoutRedirect = () => {
      try {
        if (typeof sessionStorage !== 'undefined' && 
            sessionStorage.getItem('auth0LogoutRedirect') === 'true') {
          console.log('Detected return from Auth0 logout, redirecting to login page');
          sessionStorage.removeItem('auth0LogoutRedirect');
          navigate(APP_ROUTES.LOGIN);
        }
      } catch (error) {
        console.error('Error handling Auth0 logout redirect:', error);
      }
    };
    
    async function loadUser() {
      try {
        // Check for Auth0 logout redirect first
        handleAuth0LogoutRedirect();
        
        const response = await fetch(API_ROUTES.USER, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Failed to load user:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, [navigate]);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest('POST', API_ROUTES.LOGIN, { username, password });
      const userData = await response.json();
      
      setUser(userData);
      
      // Redirect based on user role
      if (userData.role === 'admin') {
        navigate(APP_ROUTES.ADMIN_DASHBOARD);
      } else if (userData.role === 'instructor') {
        navigate(APP_ROUTES.INSTRUCTOR_DASHBOARD);
      } else {
        navigate(APP_ROUTES.DASHBOARD);
      }
      
      toast({
        title: 'Login successful',
        description: `Welcome back, ${userData.name}!`,
      });
    } catch (error) {
      console.error('Login failed:', error);
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
      
      // If the server indicates we need to redirect to Auth0 logout
      if (data.redirect && data.redirectUrl) {
        console.log('Redirecting to Auth0 logout URL:', data.redirectUrl);
        
        // Set a flag in sessionStorage to handle the redirect back
        sessionStorage.setItem('auth0LogoutRedirect', 'true');
        
        // Use window.location for full page redirect to Auth0
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
      console.error('Logout failed:', error);
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