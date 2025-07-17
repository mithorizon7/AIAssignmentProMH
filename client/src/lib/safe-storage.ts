/**
 * Safe Storage Operations
 * Provides error-safe localStorage and sessionStorage operations
 */

// Centralized storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'authToken',
  AUTH_USER: 'authUser',
  THEME: 'theme',
  PREFERENCES: 'userPreferences',
  LAST_ACTIVITY: 'lastActivity',
  FORM_DRAFT: 'formDraft'
} as const;

// Add the missing logout redirect storage keys
export const EXTENDED_STORAGE_KEYS = {
  ...STORAGE_KEYS,
  AUTH0_LOGOUT_REDIRECT: 'auth0LogoutRedirect',
  HORIZON_LOGOUT_REDIRECT: 'horizonLogoutRedirect'
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
export type ExtendedStorageKey = typeof EXTENDED_STORAGE_KEYS[keyof typeof EXTENDED_STORAGE_KEYS];

/**
 * Safe localStorage operations with error handling
 */
export class SafeStorage {
  private static isStorageAvailable(storage: Storage): boolean {
    try {
      const test = '__storage_test__';
      storage.setItem(test, test);
      storage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private static getStorage(useSession = false): Storage | null {
    try {
      const storage = useSession ? sessionStorage : localStorage;
      return this.isStorageAvailable(storage) ? storage : null;
    } catch {
      return null;
    }
  }

  /**
   * Safely get item from storage
   */
  static getItem(key: StorageKey | ExtendedStorageKey, useSession = false): string | null {
    try {
      const storage = this.getStorage(useSession);
      return storage?.getItem(key) ?? null;
    } catch (error) {
      console.warn(`Failed to get item ${key} from storage:`, error);
      return null;
    }
  }

  /**
   * Safely set item in storage
   */
  static setItem(key: StorageKey | ExtendedStorageKey, value: string, useSession = false): boolean {
    try {
      const storage = this.getStorage(useSession);
      if (!storage) return false;
      
      storage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn(`Failed to set item ${key} in storage:`, error);
      return false;
    }
  }

  /**
   * Safely remove item from storage
   */
  static removeItem(key: StorageKey | ExtendedStorageKey, useSession = false): boolean {
    try {
      const storage = this.getStorage(useSession);
      if (!storage) return false;
      
      storage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`Failed to remove item ${key} from storage:`, error);
      return false;
    }
  }

  /**
   * Safely clear all storage
   */
  static clear(useSession = false): boolean {
    try {
      const storage = this.getStorage(useSession);
      if (!storage) return false;
      
      storage.clear();
      return true;
    } catch (error) {
      console.warn('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Safely get JSON object from storage
   */
  static getJSON<T>(key: StorageKey | ExtendedStorageKey, useSession = false): T | null {
    try {
      const item = this.getItem(key, useSession);
      if (!item) return null;
      
      return JSON.parse(item) as T;
    } catch (error) {
      console.warn(`Failed to parse JSON for ${key}:`, error);
      // Clean up corrupted data
      this.removeItem(key, useSession);
      return null;
    }
  }

  /**
   * Safely set JSON object in storage
   */
  static setJSON<T>(key: StorageKey | ExtendedStorageKey, value: T, useSession = false): boolean {
    try {
      const serialized = JSON.stringify(value);
      return this.setItem(key, serialized, useSession);
    } catch (error) {
      console.warn(`Failed to serialize JSON for ${key}:`, error);
      return false;
    }
  }

  /**
   * Get available storage space (approximation)
   */
  static getAvailableSpace(useSession = false): number | null {
    try {
      const storage = this.getStorage(useSession);
      if (!storage) return null;
      
      let used = 0;
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key) {
          used += key.length + (storage.getItem(key) || '').length;
        }
      }
      
      // Most browsers limit localStorage to 5-10MB
      const limit = 5 * 1024 * 1024; // 5MB
      return Math.max(0, limit - used);
    } catch {
      return null;
    }
  }

  /**
   * Clean up expired or corrupted storage items
   */
  static cleanup(useSession = false): void {
    try {
      const storage = this.getStorage(useSession);
      if (!storage) return;
      
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        
        try {
          const value = storage.getItem(key);
          if (value) {
            // Try to parse as JSON to check for corruption
            JSON.parse(value);
          }
        } catch {
          // Mark corrupted items for removal
          keysToRemove.push(key);
        }
      }
      
      // Remove corrupted items
      keysToRemove.forEach(key => {
        try {
          storage.removeItem(key);
        } catch {
          // Ignore errors during cleanup
        }
      });
      
      if (keysToRemove.length > 0) {
        console.info(`Cleaned up ${keysToRemove.length} corrupted storage items`);
      }
    } catch (error) {
      console.warn('Storage cleanup failed:', error);
    }
  }
}

/**
 * Hook for React components to use safe storage
 */
export function useStorage() {
  return {
    getItem: SafeStorage.getItem,
    setItem: SafeStorage.setItem,
    removeItem: SafeStorage.removeItem,
    getJSON: SafeStorage.getJSON,
    setJSON: SafeStorage.setJSON,
    clear: SafeStorage.clear,
    cleanup: SafeStorage.cleanup
  };
}

// Initialize cleanup on module load
try {
  SafeStorage.cleanup(false); // localStorage
  SafeStorage.cleanup(true);  // sessionStorage
} catch {
  // Ignore initialization errors
}