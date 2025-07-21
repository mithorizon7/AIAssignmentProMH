import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { Request, Response, NextFunction } from 'express';

// Mock storage interface
const mockStorage = {
  getUserByUsername: vi.fn(),
  getUser: vi.fn(),
  // Add more methods as needed
};

describe('Enhanced Authentication Flow', () => {
  // Setup express app
  const app = express();
  let request: supertest.SuperTest<supertest.Test>;
  let sessionStore: any;
  
  beforeAll(() => {
    // Configure app with middleware for JSON and form data
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    
    // Simple in-memory session store
    sessionStore = {
      sessions: {},
      get: vi.fn((sid, cb) => cb(null, sessionStore.sessions[sid])),
      set: vi.fn((sid, session, cb) => {
        sessionStore.sessions[sid] = session;
        if (cb) cb();
      }),
      destroy: vi.fn((sid, cb) => {
        delete sessionStore.sessions[sid];
        if (cb) cb();
      }),
      all: vi.fn(cb => cb(null, Object.values(sessionStore.sessions))),
      clear: vi.fn(cb => {
        sessionStore.sessions = {};
        if (cb) cb();
      })
    };
    
    // Configure session
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: true,
      store: sessionStore, 
      cookie: { 
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
      }
    }));
    
    // Setup passport
    app.use(passport.initialize());
    app.use(passport.session());
    
    // Configure local strategy
    passport.use(new LocalStrategy(async (username, password, done) => {
      try {
        // Get user from mock storage
        const user = mockStorage.getUserByUsername(username);
        
        if (!user) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
          return done(null, false, { message: 'Invalid username or password' });
        }
        
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    }));
    
    // Configure passport serialization/deserialization
    passport.serializeUser((user: any, done) => {
      console.log('Serializing user:', user.id);
      done(null, user.id);
    });
    
    passport.deserializeUser((id: number, done) => {
      console.log('Deserializing user:', id);
      try {
        const user = mockStorage.getUser(id);
        if (!user) {
          return done(null, false);
        }
        
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        done(null, userWithoutPassword);
      } catch (error) {
        done(error);
      }
    });
    
    // Configure login route
    app.post('/api/auth/login', (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          return next(err);
        }
        
        if (!user) {
          return res.status(401).json({ message: info.message || 'Invalid credentials' });
        }
        
        // Perform login and create session
        req.login(user, (err) => {
          if (err) {
            return next(err);
          }
          
          // Regenerate session to prevent session fixation
          req.session.regenerate((err) => {
            if (err) {
              console.error('Session regeneration error:', err);
              return next(err);
            }
            
            // Save the session
            req.session.save((err) => {
              if (err) {
                console.error('Session save error:', err);
                return next(err);
              }
              
              return res.status(200).json(user);
            });
          });
        });
      })(req, res, next);
    });
    
    // Configure user info endpoint
    app.get('/api/auth/user', (req: Request, res: Response) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      res.json(req.user);
    });
    
    // Configure logout endpoint
    app.post('/api/auth/logout', (req: Request, res: Response, next: NextFunction) => {
      // Get redirect URL before logout
      const redirectUrl = '/login';
      
      // Perform logout
      req.logout((err) => {
        if (err) {
          return next(err);
        }
        
        // Destroy session
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
            return next(err);
          }
          
          // Clear cookie
          res.clearCookie('connect.sid');
          
          // Return success
          res.status(200).json({
            message: 'Logged out successfully',
            redirectUrl
          });
        });
      });
    });
    
    // Protected endpoint
    app.get('/api/protected', (req: Request, res: Response) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Unauthorized - Please log in again' });
      }
      
      res.json({ 
        message: 'Protected data accessed successfully',
        user: req.user
      });
    });
    
    // Create supertest instance
    request = supertest(app);
  });
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    sessionStore.clear();
    
    // Default test user
    const testUser = {
      id: 1,
      username: 'testuser',
      password: '$2b$12$e8CDzMRoWZfEGzpdOIV29.QRsrmnqBkhRGHNXgTHYZDUvDUyCF1u2', // hashed 'password123'
      name: 'Test User',
      email: 'test@example.com',
      role: 'student'
    };
    
    // Setup mock responses
    mockStorage.getUserByUsername.mockImplementation((username) => {
      if (username === 'testuser') {
        return testUser;
      }
      return null;
    });
    
    mockStorage.getUser.mockImplementation((id) => {
      if (id === 1) {
        return testUser;
      }
      return null;
    });
  });
  
  it('should authenticate a user with valid credentials', async () => {
    // Mock bcrypt.compare to always return true for testing
    const bcryptCompareSpy = vi
      .spyOn(bcrypt, 'compare')
      .mockImplementation(() => Promise.resolve(true));
    
    const response = await request
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('id', 1);
    expect(response.body).toHaveProperty('username', 'testuser');
    expect(response.body).not.toHaveProperty('password');
    
    // Check if getUserByUsername was called
    expect(mockStorage.getUserByUsername).toHaveBeenCalledWith('testuser');
    
    // Restore bcrypt spy
    bcryptCompareSpy.mockRestore();
  });
  
  it('should reject authentication with invalid credentials', async () => {
    // Mock bcrypt.compare to always return false for testing
    const bcryptCompareSpy = vi
      .spyOn(bcrypt, 'compare')
      .mockImplementation(() => Promise.resolve(false));
    
    const response = await request
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'wrongpassword'
      });
    
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Invalid username or password');
    
    // Restore bcrypt spy
    bcryptCompareSpy.mockRestore();
  });
  
  it('should maintain authenticated session across requests', async () => {
    // Mock bcrypt.compare to always return true for testing
    const bcryptCompareSpy = vi
      .spyOn(bcrypt, 'compare')
      .mockImplementation(() => Promise.resolve(true));
    
    // Login to create session
    const loginResponse = await request
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });
    
    expect(loginResponse.status).toBe(200);
    
    // Extract cookie for subsequent requests
    const cookies = loginResponse.headers['set-cookie'] as string[];
    expect(cookies).toBeDefined();
    
    // Make authenticated request
    const protectedResponse = await request
      .get('/api/protected')
      .set('Cookie', cookies);
      
    expect(protectedResponse.status).toBe(200);
    expect(protectedResponse.body).toHaveProperty('message', 'Protected data accessed successfully');
    expect(protectedResponse.body.user).toHaveProperty('id', 1);
    
    // Verify user was deserialized from session
    expect(mockStorage.getUser).toHaveBeenCalled();
    
    // Restore bcrypt spy
    bcryptCompareSpy.mockRestore();
  });
  
  it('should log out user and invalidate session', async () => {
    // Mock bcrypt.compare to always return true for testing
    const bcryptCompareSpy = vi
      .spyOn(bcrypt, 'compare')
      .mockImplementation(() => Promise.resolve(true));
    
    // Login to create session
    const loginResponse = await request
      .post('/api/auth/login')
      .send({
        username: 'testuser',
        password: 'password123'
      });
    
    // Extract cookie for subsequent requests
    const cookies = loginResponse.headers['set-cookie'] as string[];
    
    // Logout
    const logoutResponse = await request
      .post('/api/auth/logout')
      .set('Cookie', cookies);
    
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toHaveProperty('message', 'Logged out successfully');
    
    // Attempt to access protected resource
    const protectedResponse = await request
      .get('/api/protected')
      .set('Cookie', cookies);
    
    // Should be unauthorized as session is destroyed
    expect(protectedResponse.status).toBe(401);
    
    // Restore bcrypt spy
    bcryptCompareSpy.mockRestore();
  });
  
  it('should reject access to protected resources without authentication', async () => {
    const response = await request.get('/api/protected');
    
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Unauthorized - Please log in again');
  });
});