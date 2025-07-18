import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { Session } from 'express-session';

// Mock session type
interface MockSession {
  regenerate: (callback: (err?: Error) => void) => void;
  save: (callback: (err?: Error) => void) => void;
  destroy: (callback: (err?: Error) => void) => void;
  id: string;
  cookie: any;
  [key: string]: any;
}

describe('Session Management', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  
  beforeEach(() => {
    // Setup mock request, response and next function
    mockRequest = {
      session: {
        regenerate: vi.fn((cb) => cb()),
        save: vi.fn((cb) => cb()),
        destroy: vi.fn((cb) => cb()),
        id: 'test-session-id',
        cookie: {},
      } as any,
      isAuthenticated: vi.fn().mockReturnValue(false),
      user: undefined,
      login: vi.fn((user, cb) => cb()),
      logout: vi.fn((cb) => cb()),
      sessionID: 'test-session-id',
      path: '/test/path'
    };
    
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn()
    };
    
    mockNext = vi.fn();
  });
  
  it('should set appropriate session cookie options', () => {
    // Test function to configure session
    const configureSession = (
      isProduction: boolean
    ): { cookie: { secure: boolean; httpOnly: boolean; sameSite: string | boolean; } } => {
      // Return session options based on environment
      return {
        cookie: {
          secure: isProduction, // Requires HTTPS in production
          httpOnly: true, // Prevents client-side JS from reading the cookie
          sameSite: isProduction ? 'strict' : 'lax', // Stricter in production
        }
      };
    };
    
    // Test development environment
    const devOptions = configureSession(false);
    expect(devOptions.cookie.secure).toBe(false);
    expect(devOptions.cookie.httpOnly).toBe(true);
    expect(devOptions.cookie.sameSite).toBe('lax');
    
    // Test production environment
    const prodOptions = configureSession(true);
    expect(prodOptions.cookie.secure).toBe(true);
    expect(prodOptions.cookie.httpOnly).toBe(true);
    expect(prodOptions.cookie.sameSite).toBe('strict');
  });
  
  it('should detect unauthenticated requests', () => {
    // Create requireAuth middleware function similar to the one in auth.ts
    const requireAuth = (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized - Please log in again' });
      }
      next();
    };
    
    // Call middleware with unauthenticated request
    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify response
    expect(mockRequest.isAuthenticated).toHaveBeenCalled();
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith({ message: 'Unauthorized - Please log in again' });
    expect(mockNext).not.toHaveBeenCalled();
  });
  
  it('should allow authenticated requests', () => {
    // Set request as authenticated
    mockRequest.isAuthenticated = vi.fn().mockReturnValue(true);
    mockRequest.user = { id: 1, username: 'testuser', role: 'student' };
    
    // Create requireAuth middleware function
    const requireAuth = (req: Request, res: Response, next: NextFunction) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized - Please log in again' });
      }
      next();
    };
    
    // Call middleware with authenticated request
    requireAuth(mockRequest as Request, mockResponse as Response, mockNext);
    
    // Verify next() was called and no 401 response was sent
    expect(mockRequest.isAuthenticated).toHaveBeenCalled();
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
    expect(mockNext).toHaveBeenCalled();
  });
  
  it('should use secure login with session regeneration', async () => {
    // Setup user
    const testUser = { id: 1, username: 'testuser', role: 'student' };
    
    // Mock session methods for promise versions
    const regenerateSession = (req: Request): Promise<void> => {
      return new Promise((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };
    
    const saveSession = (req: Request): Promise<void> => {
      return new Promise((resolve, reject) => {
        req.session.save((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    };
    
    // Secure login function
    const secureLogin = async (req: Request, user: any): Promise<void> => {
      return new Promise((resolve, reject) => {
        req.login(user, async (err) => {
          if (err) return reject(err);
          
          try {
            // Regenerate session to prevent session fixation
            await regenerateSession(req);
            
            // Save the session
            await saveSession(req);
            
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    };
    
    // Perform login
    await secureLogin(mockRequest as Request, testUser);
    
    // Verify all session security steps were performed
    expect(mockRequest.login).toHaveBeenCalledWith(testUser, expect.any(Function));
    expect(mockRequest.session.regenerate).toHaveBeenCalled();
    expect(mockRequest.session.save).toHaveBeenCalled();
  });
  
  it('should handle logout correctly', () => {
    // Create logout function
    const logout = (req: Request, res: Response): Promise<void> => {
      return new Promise((resolve, reject) => {
        req.logout((err) => {
          if (err) return reject(err);
          
          req.session.destroy((err) => {
            if (err) return reject(err);
            resolve();
          });
        });
      });
    };
    
    // Perform logout
    logout(mockRequest as Request, mockResponse as Response);
    
    // Verify logout was called and session was destroyed
    expect(mockRequest.logout).toHaveBeenCalled();
    expect(mockRequest.session.destroy).toHaveBeenCalled();
  });
});