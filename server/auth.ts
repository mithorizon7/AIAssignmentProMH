import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import createMemoryStore from 'memorystore';
import { storage } from './storage';
import { z } from 'zod';

const MemoryStore = createMemoryStore(session);

// Create a session store with a 24-hour max age
const sessionStore = new MemoryStore({
  checkPeriod: 86400000 // 24 hours (in milliseconds)
});

export function configureAuth(app: any) {
  // Configure express-session
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      }
    })
  );

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to use local strategy
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Find the user
        const user = await storage.getUserByUsername(username);
        
        // If user doesn't exist or password doesn't match
        if (!user || user.password !== password) {
          return done(null, false, { message: 'Incorrect username or password' });
        }
        
        // Remove password from the user object before returning
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    })
  );

  // Configure passport serialization
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(new Error('User not found'));
      }
      // Remove password from the user object
      const { password: _, ...userWithoutPassword } = user;
      done(null, userWithoutPassword);
    } catch (error) {
      done(error);
    }
  });

  // Authentication middleware
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    next();
  };

  // Role-based authorization middleware
  const requireRole = (role: string) => (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if ((req.user as any).role !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };

  // Login schema
  const loginSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });

  // Login endpoint
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Validation failed', errors: result.error.errors });
      }

      passport.authenticate('local', (err: any, user: any, info: any) => {
        if (err) {
          return next(err);
        }
        if (!user) {
          return res.status(401).json({ message: info.message || 'Invalid credentials' });
        }
        req.login(user, (err) => {
          if (err) {
            return next(err);
          }
          return res.status(200).json(user);
        });
      })(req, res, next);
    } catch (error) {
      next(error);
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.logout(() => {
      res.status(200).json({ message: 'Logged out successfully' });
    });
  });

  // Get current user endpoint
  app.get('/api/auth/user', (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    res.json(req.user);
  });

  return { requireAuth, requireRole };
}
