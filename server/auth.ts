import { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as Auth0Strategy } from 'passport-auth0';
import { storage } from './storage';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import connectPgSimple from 'connect-pg-simple';
import { User } from '@shared/schema';
import { doubleCsrf } from 'csrf-csrf';
import { pool } from './db';
import { authRateLimiter, csrfRateLimiter } from './middleware/rate-limiter';
import { 
  logSuccessfulAuth, 
  logFailedAuth, 
  logLogout, 
  logUserCreation,
  logSecurityEvent,
  AuditEventType
} from './lib/audit-logger';

// Create PostgreSQL session store
const PgStore = connectPgSimple(session);
const sessionStore = new PgStore({
  pool,
  createTableIfMissing: true,
  tableName: 'session'
});

// Function to validate critical security environment variables
function validateSecurityEnvVars() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Check SESSION_SECRET
  if (!process.env.SESSION_SECRET) {
    if (isProduction) {
      throw new Error('FATAL ERROR: SESSION_SECRET environment variable is not set. This is required for production deployments.');
    } else {
      console.error('\x1b[31m%s\x1b[0m', 'WARNING: SESSION_SECRET environment variable is not set. ' + 
                   'This is a security risk. Never deploy to production without setting SESSION_SECRET ' +
                   'to a strong, random value.');
      process.exit(1); // Exit even in development to ensure proper configuration
    }
  } else if (process.env.SESSION_SECRET.length < 32) {
    if (isProduction) {
      throw new Error('FATAL ERROR: SESSION_SECRET is too weak. It should be at least 32 characters long.');
    } else {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: SESSION_SECRET is too weak. It should be at least 32 characters long.');
    }
  }
  
  // Check CSRF_SECRET
  if (!process.env.CSRF_SECRET) {
    if (isProduction) {
      throw new Error('FATAL ERROR: CSRF_SECRET environment variable is not set. This is required for production deployments.');
    } else {
      console.error('\x1b[31m%s\x1b[0m', 'WARNING: CSRF_SECRET environment variable is not set. ' +
                   'This is a security risk. Never deploy to production without setting CSRF_SECRET ' +
                   'to a strong, random value.');
      process.exit(1); // Exit even in development to ensure proper configuration
    }
  } else if (process.env.CSRF_SECRET.length < 32) {
    if (isProduction) {
      throw new Error('FATAL ERROR: CSRF_SECRET is too weak. It should be at least 32 characters long.');
    } else {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: CSRF_SECRET is too weak. It should be at least 32 characters long.');
    }
  }
  
  // Check Auth0 environment variables if SSO is enabled
  const auth0Enabled = process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID && process.env.AUTH0_CLIENT_SECRET;
  
  if (auth0Enabled) {
    console.log('[INFO] Auth0 SSO configuration detected');
    
    // Check for BASE_URL environment variable which is preferred for production deployments
    if (isProduction && !process.env.BASE_URL) {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: BASE_URL environment variable is not set in production. This is recommended for ensuring correct callback URLs.');
    }
    
    // Validate Auth0 callback URL - explicit configuration is strongly recommended
    if (!process.env.AUTH0_CALLBACK_URL) {
      if (isProduction) {
        console.error('\x1b[31m%s\x1b[0m', 'ERROR: AUTH0_CALLBACK_URL is not set in production. Auth0 SSO will likely fail without an explicit callback URL.');
      } else {
        console.warn('\x1b[33m%s\x1b[0m', 'WARNING: AUTH0_CALLBACK_URL is not set. A fallback URL will be generated, but explicit configuration is recommended.');
      }
    } else if (!process.env.AUTH0_CALLBACK_URL.startsWith('http')) {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: AUTH0_CALLBACK_URL should be a full URL including http/https protocol.');
    }
  } else {
    // Only warn in development mode to allow local development without Auth0
    if (!isProduction) {
      console.log('[INFO] Auth0 SSO is not configured. Local authentication will be used.');
    } else {
      console.warn('\x1b[33m%s\x1b[0m', 'WARNING: Auth0 SSO environment variables (AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET) are not fully set in production. SSO functionality will be disabled.');
    }
  }
}

export function configureAuth(app: any) {
  // Validate security environment variables before configuring authentication
  validateSecurityEnvVars();
  
  // Configure express-session with enhanced security
  app.use(
    session({
      secret: process.env.SESSION_SECRET!, // No fallback - we've already validated this exists
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
  
  // Initialize CSRF protection
  const csrfProtection = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET!, // No fallback - we've already validated this exists
    cookieName: process.env.NODE_ENV === 'production' ? '__Host-csrf' : 'csrf',
    cookieOptions: {
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Use strict in production for enhanced security
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    },
    size: 64,
    getCsrfTokenFromRequest: (req: any) => req.headers['x-csrf-token'] as string,
    getSessionIdentifier: (req: any) => req.sessionID || req.ip || '',
  });
  
  // Add CSRF protection to all state-changing routes
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Only protect state-changing methods (not GET, HEAD, OPTIONS)
    const nonProtectedMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (nonProtectedMethods.includes(req.method)) {
      return next();
    }
    
    // Skip CSRF check for these specific endpoints (login, register, logout, Auth0 callback)
    const skipCsrfForRoutes = [
      '/api/auth/login', 
      '/api/auth/register', 
      '/api/auth/logout', 
      '/api/csrf-token',
      '/api/auth-sso/callback' // Skip for Auth0 callback
    ];
    if (skipCsrfForRoutes.includes(req.path)) {
      return next();
    }
    
    // Apply CSRF protection for all other state-changing requests
    try {
      // The doubleCsrfProtection function will call next() on success
      // or throw an error on failure
      csrfProtection.doubleCsrfProtection(req, res, next);
    } catch (error: any) {
      // Log CSRF failure for security monitoring
      logSecurityEvent(
        AuditEventType.CSRF_FAILURE,
        req.ip || 'unknown',
        (req.user as any)?.id,
        (req.user as any)?.username,
        { 
          path: req.path,
          method: req.method,
          userAgent: req.headers['user-agent']
        }
      );
      
      // If the token is invalid, return 403 Forbidden
      return res.status(403).json({
        message: 'CSRF token validation failed',
        error: error.message
      });
    }
  });
  
  // Endpoint to get CSRF token (with rate limiting)
  app.get('/api/csrf-token', csrfRateLimiter, (req: Request, res: Response) => {
    // Generate a new token
    const csrfToken = csrfProtection.generateCsrfToken(req, res);
    return res.json({ csrfToken });
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
        const isPasswordValid = await bcrypt.compare(password, user.password || '');
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
  
  // Configure Auth0 strategy if Auth0 environment variables are set
  const auth0Enabled = process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID && process.env.AUTH0_CLIENT_SECRET;
  
  if (auth0Enabled) {
    console.log('[INFO] Configuring Auth0 strategy for SSO');
    
    // Determine the most reliable callback URL to use
    const getCallbackUrl = () => {
      // 1. Use explicit AUTH0_CALLBACK_URL if provided (highest priority)
      if (process.env.AUTH0_CALLBACK_URL) {
        return process.env.AUTH0_CALLBACK_URL;
      }
      
      // 2. Construct from BASE_URL if available (recommended for production)
      if (process.env.BASE_URL) {
        return `${process.env.BASE_URL.replace(/\/$/, '')}/api/auth-sso/callback`;
      }
      
      // 3. Fallback to constructed URL from host (least reliable)
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const host = app.get('host') || 'localhost:5000';
      return `${protocol}://${host}/api/auth-sso/callback`;
    };
    
    // Log the callback URL being used
    const callbackUrl = getCallbackUrl();
    console.log(`[INFO] Auth0 callback URL: ${callbackUrl}`);
    
    passport.use(
      new Auth0Strategy(
        {
          domain: process.env.AUTH0_DOMAIN!,
          clientID: process.env.AUTH0_CLIENT_ID!,
          clientSecret: process.env.AUTH0_CLIENT_SECRET!,
          callbackURL: callbackUrl,
          state: true
        },
        async (accessToken: string, refreshToken: string, extraParams: any, profile: any, done: any) => {
          try {
            // Log profile information during development to help with integration
            if (process.env.NODE_ENV !== 'production') {
              console.log('[DEBUG] Auth0 profile:', JSON.stringify(profile, null, 2));
            }
            
            // Extract user information from Auth0 profile
            const auth0UserId = profile.id;
            const email = profile.emails?.[0]?.value;
            const name = profile.displayName || (profile.name ? `${profile.name.givenName} ${profile.name.familyName}` : 'Unknown');
            const emailVerified = profile._json?.email_verified || false;
            
            if (!email) {
              return done(new Error('Email is required from Auth0 profile'));
            }
            
            // Try to find user by Auth0 ID first
            let user = await storage.getUserByAuth0Sub(auth0UserId);
            
            // If not found, try to find by email for existing users
            if (!user) {
              const existingUser = await storage.getUserByEmail(email);
              
              if (existingUser) {
                // Update existing user with Auth0 ID
                user = await storage.updateUserAuth0Sub(existingUser.id, auth0UserId);
                console.log(`[INFO] Linked Auth0 ID to existing user: ${existingUser.username}`);
                
                // Update email verification status
                if (user) {
                  await storage.updateUserEmailVerifiedStatus(user.id, emailVerified);
                }
              } else {
                // Create new user with Auth0 information
                // Generate username from email
                const username = email.split('@')[0] + '_' + Math.floor(Math.random() * 10000);
                
                // Create new user with default role of student and null password (Auth0-only user)
                user = await storage.createUser({
                  username,
                  email,
                  name,
                  password: null, // No password for SSO users
                  role: 'student',
                  auth0Sub: auth0UserId,
                  emailVerified
                });
                
                console.log(`[INFO] Created new user from Auth0 login: ${username}`);
                
                // Log the user creation event for audit purposes
                if (user) {
                  logUserCreation(
                    user.id,
                    user.username,
                    undefined, // No creator user ID for SSO registration
                    undefined, // No creator username for SSO registration
                    'Auth0 SSO' // Use a descriptive string instead of IP
                  );
                }
              }
            } else {
              // We found the user by Auth0 ID, update email verification status
              await storage.updateUserEmailVerifiedStatus(user.id, emailVerified);
            }
            
            if (!user) {
              return done(new Error('Failed to retrieve or create user account'));
            }
            
            // Log successful authentication
            logSuccessfulAuth(
              user.id,
              user.username,
              'Auth0 SSO', // Indicate SSO authentication method
              profile.provider || 'Auth0' // Use the provider information from the Auth0 profile
            );
            
            // Create a new object without the password property
            const { password, ...userWithoutPassword } = user;
            
            return done(null, userWithoutPassword as User);
          } catch (error) {
            console.error('[ERROR] Auth0 authentication error:', error);
            return done(error);
          }
        }
      )
    );
    
    // Auth0 login route
    app.get('/api/auth-sso/login', passport.authenticate('auth0', { 
      scope: 'openid email profile' 
    }));
    
    // Auth0 callback route
    app.get('/api/auth-sso/callback', (req: Request, res: Response, next: NextFunction) => {
      passport.authenticate('auth0', (err: Error | null, user: User | undefined, info: any) => {
        if (err) {
          console.error('[ERROR] Auth0 callback error:', err);
          return res.redirect('/login?error=sso_failed&reason=' + encodeURIComponent(err.message));
        }
        
        if (!user) {
          console.error('[ERROR] Auth0 callback did not return a user');
          return res.redirect('/login?error=sso_failed&reason=no_user_returned');
        }
        
        req.login(user, (err) => {
          if (err) {
            console.error('[ERROR] Session login error:', err);
            return res.redirect('/login?error=sso_failed&reason=session_error');
          }
          
          // Successful login
          return res.redirect('/');
        });
      })(req, res, next);
    });
  } else {
    console.log('[INFO] Auth0 SSO not configured, skipping Auth0 strategy setup');
  }

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
      // Log permission denied event for security auditing
      logSecurityEvent(
        AuditEventType.PERMISSION_DENIED,
        req.ip || 'unknown',
        (req.user as any).id,
        (req.user as any).username,
        {
          requiredRole: role,
          actualRole: (req.user as any).role,
          path: req.path,
          method: req.method
        }
      );
      
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

  // Login endpoint (with rate limiting)
  app.post('/api/auth/login', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
          // Log failed authentication attempt
          logFailedAuth(
            req.body.username,
            req.ip || 'unknown',
            info.message || 'Invalid credentials',
            req.headers['user-agent'] as string
          );
          return res.status(401).json({ message: info.message || 'Invalid credentials' });
        }
        req.login(user, (err) => {
          if (err) {
            return next(err);
          }
          
          // Log successful authentication
          logSuccessfulAuth(
            user.id,
            user.username,
            req.ip || 'unknown',
            req.headers['user-agent'] as string
          );
          
          return res.status(200).json(user);
        });
      })(req, res, next);
    } catch (error) {
      next(error);
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    // Store user info before logout for logging
    const user = req.user as any;
    const userId = user?.id;
    const username = user?.username;
    const ipAddress = req.ip || 'unknown';

    req.logout(() => {
      // Log the logout event if the user was authenticated
      if (userId && username) {
        logLogout(userId, username, ipAddress);
      }
      
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
  
  // Register new user endpoint with password strength enforcement (with rate limiting)
  app.post('/api/auth/register', authRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
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
      
      // Log the user creation event for audit purposes
      logUserCreation(
        newUser.id,
        newUser.username,
        undefined,
        undefined,
        req.ip || 'unknown'
      );
      
      // Log the user in
      req.login(userWithoutPassword, (err) => {
        if (err) {
          return next(err);
        }
        
        // Log successful authentication after registration
        logSuccessfulAuth(
          newUser.id,
          newUser.username,
          req.ip || 'unknown',
          req.headers['user-agent'] as string
        );
        
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
