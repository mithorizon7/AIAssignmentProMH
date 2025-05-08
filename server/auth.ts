import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { storage } from './storage';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import connectPgSimple from 'connect-pg-simple';
import { pool } from './db';

// Create PostgreSQL session store
const PgStore = connectPgSimple(session);
const sessionStore = new PgStore({
  pool,
  createTableIfMissing: true,
  tableName: 'session'
});

export function configureAuth(app: any) {
  // Configure express-session with enhanced security
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'your-secret-key',
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === 'production', // Requires HTTPS in production
        httpOnly: true, // Prevents client-side JS from reading the cookie
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'lax', // Provides CSRF protection
        path: '/', // Restrict cookie to specific path
      },
      // Enable proxy support for secure cookies behind load balancers
      proxy: process.env.NODE_ENV === 'production'
    })
  );
  
  // Set appropriate security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Helps prevent clickjacking attacks
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    // Enables the Cross-site scripting (XSS) filter in browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Prevents browsers from MIME-sniffing a response away from the declared content-type
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Strict-Transport-Security enforces secure connections to the server
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure passport to use local strategy with bcrypt password verification
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Find the user
        const user = await storage.getUserByUsername(username);
        
        // If user doesn't exist
        if (!user) {
          return done(null, false, { message: 'Incorrect username or password' });
        }
        
        // Verify password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
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

  // Enhanced login schema with stronger validation
  const loginSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  });
  
  // Enhanced registration schema with password strength requirements
  const registerSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    name: z.string().min(1, "Name is required"),
    password: z.string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    role: z.enum(["student", "instructor", "admin"]).optional().default("student"),
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
  
  // Register new user endpoint with password strength enforcement
  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate request against our enhanced schema
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: 'Validation failed', 
          errors: result.error.errors 
        });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(result.data.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(result.data.email);
      if (existingEmail) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      
      // Hash the password
      const hashedPassword = await hashPassword(result.data.password);
      
      // Create the user
      const newUser = await storage.createUser({
        ...result.data,
        password: hashedPassword
      });
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = newUser;
      
      // Log the user in
      req.login(userWithoutPassword, (err) => {
        if (err) {
          return next(err);
        }
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  return { requireAuth, requireRole };
}



// Helper function to hash passwords
async function hashPassword(password: string): Promise<string> {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
}

// Development test accounts (passwords will be hashed before storing)
const DEV_TEST_ACCOUNTS = [
  {
    id: 9999,
    username: 'admin@test.com',
    email: 'admin@test.com',
    password: 'admin123', // Will be hashed before storage
    name: 'Test Admin',
    role: 'admin' as const
  },
  {
    id: 9998,
    username: 'instructor@test.com', 
    email: 'instructor@test.com',
    password: 'instructor123', // Will be hashed before storage
    name: 'Test Instructor',
    role: 'instructor' as const
  },
  {
    id: 9997,
    username: 'student@test.com',
    email: 'student@test.com',
    password: 'student123', // Will be hashed before storage
    name: 'Test Student', 
    role: 'student' as const
  }
];

// Create test accounts in development with hashed passwords
if (process.env.NODE_ENV === 'development') {
  DEV_TEST_ACCOUNTS.forEach(async (account) => {
    const exists = await storage.getUserByUsername(account.username);
    if (!exists) {
      // Hash the password before storing
      const hashedPassword = await hashPassword(account.password);
      await storage.createUser({
        ...account,
        password: hashedPassword
      });
    }
  });
}
