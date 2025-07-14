/**
 * Safe storage utilities with error handling for localStorage and sessionStorage
 * Implements best practices for storage operations in production environments
 */

// Centralized storage keys to avoid magic strings
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  AUTH_USER: 'authUser',
  AUTH0_LOGOUT_REDIRECT: 'auth0LogoutRedirect',
  HORIZON_LOGOUT_REDIRECT: 'horizonLogoutRedirect',
  USER_PREFERENCES: 'userPreferences',
  THEME: 'theme',
} as const;

// Simple logger for storage operations
const logger = {
  info: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.info(`[STORAGE] ${message}`, meta);
    }
  },
  error: (message: string, meta?: any) => {
    console.error(`[STORAGE] ${message}`, meta);
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[STORAGE] ${message}`, meta);
  }
};

/**
 * Safe localStorage operations with error handling
 */
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get item from localStorage', { key, error });
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      logger.error('Failed to set item in localStorage', { key, error });
    }
  },
  
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      logger.error('Failed to remove item from localStorage', { key, error });
    }
  },
  
  getJSON: <T>(key: string): T | null => {
    try {
      const item = safeLocalStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      return null;
    } catch (error) {
      logger.error('Failed to parse JSON from localStorage', { key, error });
      // Clear corrupted data
      safeLocalStorage.removeItem(key);
      return null;
    }
  },
  
  setJSON: (key: string, value: any): void => {
    try {
      const jsonString = JSON.stringify(value);
      safeLocalStorage.setItem(key, jsonString);
    } catch (error) {
      logger.error('Failed to stringify JSON for localStorage', { key, error });
    }
  },
  
  clear: (): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.clear();
      }
    } catch (error) {
      logger.error('Failed to clear localStorage', { error });
    }
  }
};

/**
 * Safe sessionStorage operations with error handling
 */
export const safeSessionStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        return sessionStorage.getItem(key);
      }
      return null;
    } catch (error) {
      logger.error('Failed to get item from sessionStorage', { key, error });
      return null;
    }
  },
  
  setItem: (key: string, value: string): void => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, value);
      }
    } catch (error) {
      logger.error('Failed to set item in sessionStorage', { key, error });
    }
  },
  
  removeItem: (key: string): void => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      logger.error('Failed to remove item from sessionStorage', { key, error });
    }
  },
  
  getJSON: <T>(key: string): T | null => {
    try {
      const item = safeSessionStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
      return null;
    } catch (error) {
      logger.error('Failed to parse JSON from sessionStorage', { key, error });
      // Clear corrupted data
      safeSessionStorage.removeItem(key);
      return null;
    }
  },
  
  setJSON: (key: string, value: any): void => {
    try {
      const jsonString = JSON.stringify(value);
      safeSessionStorage.setItem(key, jsonString);
    } catch (error) {
      logger.error('Failed to stringify JSON for sessionStorage', { key, error });
    }
  },
  
  clear: (): void => {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.clear();
      }
    } catch (error) {
      logger.error('Failed to clear sessionStorage', { error });
    }
  }
};

/**
 * Generic safe storage interface that works with both localStorage and sessionStorage
 */
export interface SafeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  getJSON: <T>(key: string) => T | null;
  setJSON: (key: string, value: any) => void;
  clear: () => void;
}

/**
 * Default export for convenience - uses sessionStorage
 */
export const safeStorage = safeSessionStorage;