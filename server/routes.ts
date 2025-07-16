import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { configureAuth } from "./auth";
// Legacy queue worker disabled - using BullMQ implementation directly
// import { submissionQueue } from "./queue/worker";
import multer from "multer";
import path from "path";
import * as fs from 'fs';
import { StorageService } from "./services/storage-service";
import { AIService } from "./services/ai-service";
import { GeminiAdapter, SUPPORTED_MIME_TYPES } from "./adapters/gemini-adapter";
import { OpenAIAdapter } from "./adapters/openai-adapter";
import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { db } from "./db";
import { submissions, feedback, users, userNotificationSettings, newsletterSubscribers, type User } from "@shared/schema";
import { v4 as uuidv4 } from "uuid";
import { defaultRateLimiter, submissionRateLimiter } from "./middleware/rate-limiter";
import adminRoutes from "./routes/admin";
import instructorRoutes from "./routes/instructor";
import dataProtectionRouter from "./routes/data-protection";
import errorReportingRoutes from "./routes/error-reporting";
import { queueSecurityAudit } from "./queue/security-audit";
import { determineContentType, isFileTypeAllowed, ContentType } from "./utils/file-type-settings";
import { processFileForMultimodal } from "./utils/multimodal-processor";
import { asyncHandler } from "./lib/error-handler";
import { generateSecret, verifyTotp, generateOtpAuthUrl } from "./utils/totp";
import { csrfProtection, addCSRFToken, getCSRFToken } from "./middleware/csrf-protection";
import { createCacheMiddleware, getCacheStats, clearCache } from "./middleware/performance-cache";
import { performHealthCheck, quickHealthCheck } from "./lib/health-checker";
import { validateProductionReadiness } from "./lib/production-validator";
import { getDatabaseHealth } from "./lib/database-optimizer";
import { getQueueHealthStatus } from "./lib/queue-manager";
import { getSecurityHealth } from "./lib/security-enhancer";
import { errorRecoverySystem, triggerManualRecovery, getRecoveryMetrics } from "./lib/error-recovery";
import { cacheManager } from "./lib/cache-manager";
import { memoryMonitor } from "./lib/memory-monitor";

// Helper function to generate a unique shareable code for assignments
function generateShareableCode(length = 8): string {
  // Generate a random UUID
  const uuid = uuidv4();

  // Convert to alphanumeric characters by removing dashes and taking first 'length' characters
  // Always use uppercase for consistency in storage
  const code = uuid.replace(/-/g, '').substring(0, length).toUpperCase();

  console.log(`Generated shareable code: ${code}`);
  return code;
}

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const { requireAuth, requireRole } = configureAuth(app);
  
  // Add CSRF protection middleware
  app.use(addCSRFToken);
  
  // CSRF token endpoint
  app.get('/api/csrf-token', getCSRFToken);

  const requireInstructor = (req: Request, res: Response, next: NextFunction) => {
    const role = (req.user as any)?.role;
    if (role !== 'instructor' && role !== 'admin') {
      return res.status(403).json({ message: 'Instructor access required' });
    }
    next();
  };

  // Initialize services
  const storageService = new StorageService();

  // Mount admin routes
  app.use('/api/admin', adminRoutes);

  // Mount instructor routes
  app.use('/api/instructor', instructorRoutes);

  // Data protection routes (GDPR/FERPA compliance) - require admin role
  app.use('/api/data-protection', requireAuth, requireRole('admin'), dataProtectionRouter);
  
  // Mount error reporting routes
  app.use('/api', errorReportingRoutes);

  // Define API routes
  
  // Optimized health check endpoint - no expensive operations
  app.get('/api/health', (req: Request, res: Response) => {
    const startTime = Date.now();
    
    try {
      // Fast health check without database queries
      const memory = process.memoryUsage();
      const uptime = process.uptime();
      
      const response = {
        status: 'ok',
        message: 'System operational',
        timestamp: new Date().toISOString(),
        uptime: Math.round(uptime),
        memory: {
          used: Math.round(memory.heapUsed / 1024 / 1024),
          total: Math.round(memory.heapTotal / 1024 / 1024)
        },
        responseTime: Date.now() - startTime
      };
      
      res.json(response);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        message: 'Health check failed',
        responseTime: Date.now() - startTime
      });
    }
  });
  
  // Comprehensive health check endpoint
  app.get('/api/health/detailed', asyncHandler(async (req, res) => {
    const result = await performHealthCheck();
    const statusCode = result.status === 'healthy' ? 200 : 
                      result.status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(result);
  }));
  
  // Production readiness check (admin only)
  app.get('/api/admin/production-readiness', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const result = await validateProductionReadiness();
    res.status(result.isValid ? 200 : 400).json(result);
  }));

  // Database health check (admin only)
  app.get('/api/admin/database-health', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const result = await getDatabaseHealth();
    res.json(result);
  }));

  // Queue health check (admin only)
  app.get('/api/admin/queue-health', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const result = await getQueueHealthStatus();
    res.json(result);
  }));

  // Security health check (admin only)
  app.get('/api/admin/security-health', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const result = getSecurityHealth();
    res.json(result);
  }));

  // Recovery system status (admin only)
  app.get('/api/admin/recovery-status', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const status = errorRecoverySystem.getRecoveryStatus();
    const metrics = getRecoveryMetrics();
    res.json({ status, metrics });
  }));

  // Manual recovery trigger (admin only)
  app.post('/api/admin/trigger-recovery', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req, res) => {
    const { actionId } = req.body;
    if (!actionId) {
      return res.status(400).json({ error: 'actionId is required' });
    }
    
    try {
      const result = await triggerManualRecovery(actionId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ 
        error: 'Recovery failed', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }));

  // Cache management endpoints (admin only)
  app.get('/api/admin/cache-health', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const health = await cacheManager.getHealth();
    res.json(health);
  }));

  app.post('/api/admin/cache-clear', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req, res) => {
    const { pattern, tags } = req.body;
    
    let deletedCount = 0;
    if (pattern) {
      deletedCount = await cacheManager.invalidateByPattern(pattern);
    } else if (tags) {
      deletedCount = await cacheManager.invalidateByTags(tags);
    } else {
      deletedCount = await cacheManager.clear();
    }
    
    res.json({ success: true, deletedCount });
  }));

  // Queue management and monitoring endpoints (admin only)
  app.get('/api/admin/queue/stats', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
    const stats = await queueApi.getStats();
    res.json(stats);
  }));

  app.get('/api/admin/queue/performance', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
    const report = await queueApi.getPerformanceReport();
    res.json(report);
  }));

  app.get('/api/admin/queue/timings', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const timings = await queueApi.getRecentJobTimings(limit);
    res.json(timings);
  }));

  app.post('/api/admin/queue/retry-failed', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const retried = await queueApi.retryFailedSubmissions();
    res.json({ 
      message: `Retried ${retried} failed submissions`,
      retried 
    });
  }));

  // Memory monitoring endpoints (admin only)
  app.get('/api/admin/memory-status', requireAuth, requireRole('admin'), asyncHandler(async (req, res) => {
    const memoryTrend = memoryMonitor.getMemoryTrend();
    const memoryHistory = memoryMonitor.getMemoryHistory();
    
    res.json({
      current: memoryTrend.current,
      trend: memoryTrend.trend,
      averagePercentage: memoryTrend.averagePercentage,
      peakPercentage: memoryTrend.peakPercentage,
      suggestions: memoryTrend.suggestions,
      history: memoryHistory.slice(-20) // Last 20 entries
    });
  }));

  app.post('/api/admin/memory-gc', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req, res) => {
    const forced = memoryMonitor.forceGarbageCollection();
    const statsAfter = memoryMonitor.getMemoryStats();
    
    res.json({
      success: true,
      forced,
      memoryAfter: statsAfter
    });
  }));

  // System settings endpoints
  app.get('/api/admin/system-settings', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
    const settings = await storage.listSystemSettings();
    const result: Record<string, any> = {};
    settings.forEach(s => { result[s.key] = { value: s.value, lms: s.lms, storage: s.storage, security: s.security }; });
    res.json(result);
  }));

  app.put('/api/admin/system-settings', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const updates = req.body as Record<string, any>;
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ message: 'Invalid request body' });
    }
    const user = req.user as User;
    const result: Record<string, any> = {};
    for (const key of Object.keys(updates)) {
      const value = updates[key];
      const settingPayload: any = { key, value: value.value ?? value, updatedBy: user.id };
      if (value.lms !== undefined) settingPayload.lms = value.lms;
      if (value.storage !== undefined) settingPayload.storage = value.storage;
      if (value.security !== undefined) settingPayload.security = value.security;

      const setting = await storage.upsertSystemSetting(settingPayload);
      result[setting.key] = { value: setting.value, lms: setting.lms, storage: setting.storage, security: setting.security };
    }
    res.json(result);
  }));

  app.post('/api/admin/security-audit', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as User;
    await queueSecurityAudit(user.id);
    res.json({ message: 'Security audit queued' });
  }));

  // Newsletter subscription
  app.post('/api/newsletter/subscribe', asyncHandler(async (req: Request, res: Response) => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    const { email } = result.data;

    try {
      const existing = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email));
      if (existing.length > 0) {
        return res.status(200).json({ message: 'Already subscribed' });
      }

      await db.insert(newsletterSubscribers).values({ email }).returning();
      return res.status(201).json({ message: 'Subscribed' });
    } catch (error) {
      console.error('Failed to subscribe to newsletter:', error);
      return res.status(500).json({ message: 'Failed to subscribe' });
    }
  }));
  // Authentication endpoints handled in auth.ts

  // Admin user management (from codex/add-admin-user-routes-and-connect-to-storage branch)
  app.get('/api/admin/users', requireAuth, requireRole('admin'), asyncHandler(async (req: Request, res: Response) => {
    const usersList = await storage.listUsers();
    res.json(usersList);
  }));

  app.post('/api/admin/users', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const userSchema = z.object({
      name: z.string().min(1),
      username: z.string().min(3),
      email: z.string().email(),
      password: z.string().min(6).optional(),
      role: z.enum(['student', 'instructor', 'admin']).default('student'),
    });

    const result = userSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid user data', errors: result.error.format() });
    }

    const { password, ...data } = result.data;
    const newUser = await storage.createUser({ ...data, password: password ?? null });
    res.status(201).json(newUser);
  }));

  app.put('/api/admin/users/:id', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const updateSchema = z.object({
      name: z.string().optional(),
      username: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      role: z.enum(['student', 'instructor', 'admin']).optional(),
    });

    const result = updateSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid user data', errors: result.error.format() });
    }

    const updated = await storage.updateUser(userId, result.data);
    if (!updated) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updated);
  }));

  app.delete('/api/admin/users/:id', requireAuth, requireRole('admin'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    await storage.deleteUser(userId);
    res.status(204).end();
  }));

  // User notification settings (from origin/main branch)
  app.get('/api/user/notifications', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as User;
    const settings = await storage.getUserNotificationSettings(user.id);
    if (!settings) {
      return res.json({
        emailNotifications: true,
        assignmentNotifications: true,
        feedbackNotifications: true,
        systemNotifications: false
      });
    }
    res.json(settings);
  }));

  app.put('/api/user/notifications', requireAuth, csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as User;
    const schema = z.object({
      emailNotifications: z.boolean(),
      assignmentNotifications: z.boolean(),
      feedbackNotifications: z.boolean(),
      systemNotifications: z.boolean(),
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid settings', errors: result.error.flatten() });
    }

    const settings = await storage.upsertUserNotificationSettings({
      userId: user.id,
      ...result.data,
    });

    res.json(settings);
  }));

  // MFA endpoints (from origin/main branch)
  app.get('/api/mfa/setup', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any; // Assuming user object has id and username
    const secret = generateSecret();
    const url = generateOtpAuthUrl(secret, user.username); // Ensure user.username exists
    await storage.updateUserMfa(user.id, false, secret); // Make sure storage.updateUserMfa handles these params
    res.json({ secret, url });
  }));

  app.post('/api/mfa/enable', requireAuth, csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;
    const user = await storage.getUser((req.user as any).id);
    if (!user || !user.mfaSecret) {
      return res.status(400).json({ message: 'MFA not initialized' });
    }
    if (!token || !verifyTotp(String(token), user.mfaSecret)) {
      return res.status(401).json({ message: 'Invalid MFA token' });
    }
    await storage.updateUserMfa(user.id, true, user.mfaSecret);
    res.json({ enabled: true });
  }));

  app.post('/api/mfa/disable', requireAuth, csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.body;
    const user = await storage.getUser((req.user as any).id);
    if (!user || !user.mfaSecret) { // Should check if MFA is enabled rather than just secret exists
      return res.status(400).json({ message: 'MFA not enabled' });
    }
    if (!token || !verifyTotp(String(token), user.mfaSecret)) {
      return res.status(401).json({ message: 'Invalid MFA token' });
    }
    await storage.updateUserMfa(user.id, false, null); // Setting secret to null on disable
    res.json({ enabled: false });
  }));

  // Assignment endpoints
  app.get('/api/assignments', requireAuth, createCacheMiddleware({ 
    ttl: 60, // Cache for 60 seconds
    key: (req) => `/api/assignments:${(req.user as any)?.id}:${req.query.courseId || 'all'}`
  }), asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as any;
    let assignments;

    if (user.role === 'student') {
      // Use optimized single query to get assignments with submissions and courses
      console.log(`[PERFORMANCE] Using optimized assignments with submissions query for student ${user.id}`);
      const assignmentsWithSubmissions = await storage.listAssignmentsWithSubmissionsForUser(user.id);
      res.json(assignmentsWithSubmissions);
    } else {
      // For instructors, use optimized assignment stats with single query
      const assignmentsWithStats = await storage.listAssignmentsWithStats();
      console.log(`[PERFORMANCE] Using optimized assignments with stats query - eliminated N+1 queries`);

      res.json(assignmentsWithStats);
    }
  }));

  // Get specific assignment
  app.get('/api/assignments/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseInt(req.params.id);
    const assignment = await storage.getAssignment(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const course = await storage.getCourse(assignment.courseId);

    res.json({
      ...assignment,
      course
    });
  }));

  // Create assignment (instructor only)
  app.post('/api/assignments', requireAuth, requireRole('instructor'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    try {
      const { title, description, courseId, dueDate, rubric } = req.body;

      console.log("Creating assignment with data:", JSON.stringify({
        title,
        description: description?.substring(0, 30) + "...",
        courseId,
        dueDate
      }));

      // Validate request
      const assignmentSchema = z.object({
        title: z.string().min(3),
        description: z.string().min(10),
        courseId: z.union([
          z.number().int().positive(),
          z.string().transform(val => parseInt(val))
        ]).optional(), // Make optional for standalone assignments
        dueDate: z.string().refine(val => !isNaN(Date.parse(val)), {
          message: 'Invalid date format'
        }),
        rubric: z.object({
          criteria: z.array(z.object({
            id: z.string(),
            type: z.string(),
            name: z.string(),
            description: z.string(),
            maxScore: z.number().int().min(1),
            weight: z.number().int().min(1),
          })).optional(),
          totalPoints: z.number().int().positive().optional(),
          passingThreshold: z.number().int().min(0).max(100).optional(),
        }).optional(),
      });

      const result = assignmentSchema.safeParse(req.body);
      if (!result.success) {
        const errorDetails = JSON.stringify(result.error.format());
        console.error("Assignment validation failed:", errorDetails);
        return res.status(400).json({
          message: 'Invalid assignment data',
          errors: result.error.format()
        });
      }

      // Check if course exists (if courseId is provided)
      if (courseId) {
        const courseIdNum = typeof courseId === 'string' ? parseInt(courseId) : courseId;
        const course = await storage.getCourse(courseIdNum);
        if (!course) {
          return res.status(404).json({ message: 'Course not found' });
        }
      }

      // Generate a unique shareable code
      const shareableCode = generateShareableCode();

      // Create assignment - if no courseId provided, use the default course
      let finalCourseId = courseId ? (typeof courseId === 'string' ? parseInt(courseId) : courseId) : undefined;
      
      // If no course specified, create or use a default course
      if (!finalCourseId) {
        // Try to get or create a default course
        const courses = await storage.listCourses();
        if (courses.length === 0) {
          // Create a default course
          const defaultCourse = await storage.createCourse({
            name: "General Assignments",
            code: "GENERAL",
            description: "Default course for standalone assignments"
          });
          finalCourseId = defaultCourse.id;
        } else {
          // Use the first available course
          finalCourseId = courses[0].id;
        }
      }
      
      const assignment = await storage.createAssignment({
        title,
        description,
        courseId: finalCourseId,
        dueDate: new Date(dueDate),
        status: 'active',
        shareableCode,
        rubric: rubric ? JSON.stringify(rubric) as any : null,
      });

      console.log("Assignment created successfully, ID:", assignment.id);
      return res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      return res.status(500).json({
        message: 'Failed to create assignment',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }));

  // Get assignment details for instructor - OPTIMIZED
  app.get('/api/assignments/:id/details', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseInt(req.params.id);

    if (isNaN(assignmentId)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }

    try {
      // Use optimized method to get assignment with stats in single query
      const assignmentWithDetails = await storage.getAssignmentWithDetails(assignmentId);
      console.log(`[PERFORMANCE] Using optimized assignment details query with database-level aggregation for assignment ${assignmentId}`);
      
      if (!assignmentWithDetails) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Generate shareable code if missing
      let shareableCode = assignmentWithDetails.shareableCode;
      if (!shareableCode && assignmentWithDetails.id) {
        shareableCode = generateShareableCode();
        try {
          await storage.updateAssignmentShareableCode(assignmentWithDetails.id, shareableCode);
          assignmentWithDetails.shareableCode = shareableCode;
        } catch (err) {
          console.error('Error updating assignment with shareable code:', err);
        }
      }

      res.json({
        ...assignmentWithDetails,
        submittedCount: assignmentWithDetails.submissionCount,
        course: {
          id: assignmentWithDetails.courseId,
          name: assignmentWithDetails.courseName,
          code: assignmentWithDetails.courseCode
        },
        shareableCode: shareableCode || `TEMP-${assignmentWithDetails.id}`
      });
    } catch (error) {
      console.error('Error fetching assignment details:', error);
      return res.status(500).json({ message: 'Failed to fetch assignment details' });
    }
  }));

  app.patch('/api/assignments/:id/status', requireAuth, requireRole('instructor'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
    const assignmentId = parseInt(req.params.id);

    if (isNaN(assignmentId)) {
      return res.status(400).json({ message: 'Invalid assignment ID' });
    }

    const statusSchema = z.object({
      status: z.enum(['active', 'upcoming', 'completed'])
    });

    const result = statusSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid status value', errors: result.error });
    }

    const { status } = result.data;

    const assignment = await storage.getAssignment(assignmentId);
    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    const updatedAssignment = await storage.updateAssignmentStatus(assignmentId, status);

    res.json(updatedAssignment);
  }));

  app.get('/api/assignments/code/:code', defaultRateLimiter, asyncHandler(async (req: Request, res: Response) => {
    const code = req.params.code;

    console.log(`Looking up assignment with code: ${code}`);

    if (!code || code.length < 6) {
      console.log(`Invalid shareable code: ${code}`);
      return res.status(400).json({ message: 'Invalid shareable code' });
    }

    // Use optimized database lookup instead of scanning all assignments
    const assignment = await storage.getAssignmentByShareableCode(code);
    console.log(`[PERFORMANCE] Using optimized shareable code lookup for: ${code}`);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found with this code' });
    }

    const course = await storage.getCourse(assignment.courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found for this assignment' });
    }

    const isAuthenticated = req.isAuthenticated();

    let shareableCode = assignment.shareableCode;

    if (!shareableCode && assignment.id) {
      shareableCode = generateShareableCode();
      try {
        await storage.updateAssignmentShareableCode(assignment.id, shareableCode);
        console.log(`Generated new shareable code ${shareableCode} for assignment ${assignment.id}`);
      } catch (err) {
        console.error('Error updating assignment with new shareable code:', err);
      }
    }

    res.json({
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      courseId: assignment.courseId,
      courseCode: course.code,
      courseName: course.name,
      dueDate: assignment.dueDate,
      shareableCode: shareableCode || `TEMP-${assignment.id}`,
      requiresAuth: true,
      isAuthenticated: isAuthenticated
    });
  }));

  app.post('/api/anonymous-submissions', submissionRateLimiter, csrfProtection, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
    const submissionSchema = z.object({
      assignmentId: z.string().transform(val => parseInt(val)),
      submissionType: z.enum(['file', 'code']),
      name: z.string().min(1),
      email: z.string().email(),
      notes: z.string().optional(),
      code: z.string().optional(),
      shareableCode: z.string().min(1, "Shareable code is required for anonymous submissions"),
    });

    const result = submissionSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: 'Invalid submission data', errors: result.error });
    }

    const { assignmentId, submissionType, name, email, notes, code, shareableCode } = result.data;

    const assignment = await storage.getAssignment(assignmentId);

    if (!assignment) {
      return res.status(404).json({ message: 'Assignment not found' });
    }

    let storedShareableCode = assignment.shareableCode;

    if (!storedShareableCode && assignment.id) {
      storedShareableCode = generateShareableCode();
      try {
        await storage.updateAssignmentShareableCode(assignment.id, storedShareableCode);
        console.log(`Generated new shareable code ${storedShareableCode} for assignment ${assignment.id}`);
      } catch (err) {
        console.error('Error updating assignment with new shareable code:', err);
      }
    }

    if (!storedShareableCode) {
      storedShareableCode = `TEMP-${assignment.id}`;
    }

    if (shareableCode !== storedShareableCode) {
      return res.status(403).json({ message: 'Invalid shareable code' });
    }

    const userId = req.user ? (req.user as any).id : 1;  // Use user ID 1 for anonymous submissions
    console.log(`[DEBUG] Anonymous submission userId: ${userId}, type: ${typeof userId}`);

    let submission: any = {
      assignmentId,
      userId,
      name,
      email,
      status: 'pending',
      notes,
      contentType: null,
      fileSize: null,
      fileName: null,
      fileExtension: null,
      submissionType
    };

    console.log(`[DEBUG] Submission object before creation:`, JSON.stringify(submission, null, 2));

    if (submissionType === 'file') {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const extension = path.extname(req.file.originalname).toLowerCase().slice(1);
      const mimeType = req.file.mimetype;
      const contentType = determineContentType(mimeType, req.file.originalname);

      if (!contentType || !isFileTypeAllowed(extension, contentType)) {
        return res.status(400).json({
          message: `File type .${extension} is not allowed`,
          allowedTypes: SUPPORTED_MIME_TYPES
        });
      }

      submission.contentType = contentType;
      submission.fileSize = req.file.size;
      submission.fileName = req.file.originalname;
      submission.fileExtension = extension;
      submission.content = req.file.buffer.toString('base64');
    } else if (submissionType === 'code') {
      if (!code) {
        return res.status(400).json({ message: 'Code content is required for code submissions' });
      }

      submission.contentType = 'text';
      submission.content = code;
      submission.fileExtension = 'txt';
    } else {
      return res.status(400).json({ message: 'Invalid submission type' });
    }

    const createdSubmission = await storage.createSubmission(submission);

    // Add submission to BullMQ queue for processing
    try {
      const { queueApi } = await import('./queue/bullmq-submission-queue');
      await queueApi.addSubmission(createdSubmission.id);
    } catch (error) {
      console.error('Error adding submission to queue:', error);
      // Fallback: mark as failed if queue addition fails
      await storage.updateSubmissionStatus(createdSubmission.id, 'failed');
    }

    res.status(201).json({
      id: createdSubmission.id,
      message: 'Submission added successfully and queued for processing'
    });
  }));

  app.post('/api/submissions', requireAuth, csrfProtection, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;

      if (user.role !== 'student') {
        return res.status(403).json({ message: 'Only students can submit assignments' });
      }

      const submissionSchema = z.object({
        assignmentId: z.string().transform(val => parseInt(val)),
        submissionType: z.enum(['file', 'code']),
        notes: z.string().optional()
      });

      const result = submissionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid submission data', errors: result.error });
      }

      const { assignmentId, submissionType, notes } = result.data;

      const isActive = await storageService.isAssignmentActive(assignmentId);
      if (!isActive) {
        return res.status(400).json({ message: 'Assignment is not active or has passed its due date' });
      }

      const isEnrolled = await storageService.isStudentEnrolled(user.id, assignmentId);
      if (!isEnrolled) {
        return res.status(403).json({ message: 'You are not enrolled in this course' });
      }

      let fileUrl = '';
      let fileName = '';
      let content = '';
      let mimeType = null;
      let fileSize = null;
      let contentType: ContentType | null = null;

      if (submissionType === 'file' && req.file) {
        // Validate file buffer exists and is not empty
        if (!req.file.buffer || req.file.buffer.length === 0) {
          console.error(`[SUBMISSION] Empty file buffer received from user ${user.id}`);
          return res.status(400).json({
            message: "File upload failed - empty file",
            details: "The uploaded file contains no data. Please check the file and try again."
          });
        }
        
        fileName = req.file.originalname;
        mimeType = req.file.mimetype;
        fileSize = req.file.size;

        const fileExtension = path.extname(fileName).slice(1).toLowerCase();
        contentType = determineContentType(mimeType, fileName);

        console.log(`[SUBMISSION] User ${user.id} submission: ${fileName}, MIME: ${mimeType}, Content type: ${contentType}, Size: ${fileSize} bytes`);

        // Check if file type is allowed
        const isAllowed = await storage.checkFileTypeEnabled(contentType, fileExtension, mimeType);
        if (!isAllowed) {
          return res.status(400).json({
            message: `File type .${fileExtension} (${mimeType}) is not allowed`,
            details: 'This file type is currently not supported for AI evaluation'
          });
        }

        // Store the file with error handling
        try {
          fileUrl = await storageService.storeSubmissionFile(req.file, user.id, assignmentId);
          console.log(`[SUBMISSION] File stored successfully at ${fileUrl}`);
        } catch (storageError: any) {
          console.error(`[SUBMISSION] File storage error for user ${user.id}: ${storageError.message}`);
          return res.status(500).json({
            message: "Failed to store file submission",
            details: "An error occurred while saving your file. Please try again."
          });
        }

        // For text files, extract content safely
        if (contentType === 'text' && mimeType.startsWith('text/')) {
          try {
            content = req.file.buffer.toString('utf8');
          } catch (textError: any) {
            console.warn(`[SUBMISSION] Failed to extract text content from file: ${textError.message}`);
            // Continue without text extraction for binary files
          }
        }
      } else if (submissionType === 'code') {
        content = req.body.code || '';

        if (!content.trim()) {
          return res.status(400).json({ message: 'Code content is required for code submissions' });
        }

        mimeType = 'text/plain';
        contentType = 'text' as ContentType;
        fileSize = Buffer.from(content).length;
      } else {
        return res.status(400).json({ message: 'Invalid submission type or missing file' });
      }

      const submission = await storage.createSubmission({
        assignmentId,
        userId: user.id,
        fileUrl,
        fileName,
        content,
        notes: notes || null,
        status: 'pending',
        mimeType: mimeType || null,
        fileSize: fileSize || null,
        contentType: contentType || null
      });

      // Add submission to queue for asynchronous processing
      try {
        const { queueApi } = await import('./queue/bullmq-submission-queue');
        await queueApi.addSubmission(submission.id);
        console.log(`[SUBMISSION] Added submission ${submission.id} to queue for processing`);
      } catch (queueError: any) {
        console.error(`[SUBMISSION] Failed to add submission ${submission.id} to queue:`, queueError);
        // Mark submission as failed if queue addition fails
        await storage.updateSubmissionStatus(submission.id, 'failed');
      }

      res.status(201).json(submission);
  }));

  app.get('/api/submissions', requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      const assignmentId = req.query.assignmentId ? parseInt(req.query.assignmentId as string) : undefined;

      // Use optimized single query to get submissions with feedback
      console.log(`[PERFORMANCE] Using optimized submissions with feedback query for user ${user.id}`);
      const submissionsWithFeedback = await storage.listSubmissionsWithFeedbackForUser(user.id, assignmentId);

      res.json(submissionsWithFeedback);
  }));

  app.get('/api/submissions/recent', requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;

      // Use optimized single query to get submissions with feedback, then slice
      console.log(`[PERFORMANCE] Using optimized submissions with feedback query for recent submissions for user ${user.id}`);
      const submissionsWithFeedback = await storage.listSubmissionsWithFeedbackForUser(user.id);
      
      const recentSubmissions = submissionsWithFeedback
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);

      res.json(recentSubmissions);
  }));

  app.get('/api/assignments/:id/submissions', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const assignmentId = parseInt(req.params.id);

      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      // Use optimized single query to get submissions with feedback
      console.log(`[PERFORMANCE] Using optimized submissions with feedback query for assignment ${assignmentId}`);
      const submissionsWithFeedback = await storage.listSubmissionsWithFeedbackForAssignment(assignmentId);

      res.json(submissionsWithFeedback);
  }));

  app.get('/api/courses', requireAuth, createCacheMiddleware({ 
    ttl: 300, // Cache for 5 minutes
    key: (req) => `/api/courses:${(req.user as any)?.id}`
  }), asyncHandler(async (req: Request, res: Response) => {
      const user = req.user as any;
      let courses;

      if (user.role === 'instructor') {
        // Use optimized method to get courses with stats in single query
        courses = await storage.listCoursesWithStats();
        console.log(`[PERFORMANCE] Using optimized course listing with database-level stats aggregation`);
      } else {
        courses = await storage.listUserEnrollments(user.id);
      }

      res.json(courses);
  }));

  app.get('/api/courses/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
      const courseId = parseInt(req.params.id);

      if (isNaN(courseId)) {
        return res.status(400).json({ message: 'Invalid course ID' });
      }

      const course = await storage.getCourse(courseId);

      if (!course) {
        return res.status(404).json({ message: 'Course not found' });
      }

      const assignments = await storage.listAssignments(courseId);
      const enrolledStudents = await storage.listCourseEnrollments(courseId);
      const studentCount = enrolledStudents.length;

      // Use optimized method to get assignments with stats
      const assignmentsWithStats = await storage.listAssignmentsWithStats(courseId);
      console.log(`[PERFORMANCE] Using optimized assignment listing with database-level stats for course ${courseId}`);

      res.json({
        ...course,
        studentCount,
        assignments: assignmentsWithStats
      });
  }));

  app.post('/api/courses', requireAuth, requireRole('instructor'), csrfProtection, asyncHandler(async (req: Request, res: Response) => {
      const { name, code, description } = req.body;

      const courseSchema = z.object({
        name: z.string().min(3),
        code: z.string().min(2),
        description: z.string().optional()
      });

      const result = courseSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ message: 'Invalid course data', errors: result.error });
      }

      const existingCourse = await storage.getCourseByCode(code);
      if (existingCourse) {
        return res.status(400).json({ message: 'Course code already exists' });
      }

      const course = await storage.createCourse({
        name,
        code,
        description: description || null
      });

      const testStudent = await storage.getUserByEmail('student@test.com');
      if (testStudent) {
        await storage.createEnrollment({
          userId: testStudent.id,
          courseId: course.id
        });
        console.log(`Automatically enrolled test student (ID: ${testStudent.id}) in course ${course.name}`);
      }

      res.status(201).json(course);
  }));

  app.get('/api/courses/:courseId/students', requireAuth, requireInstructor, asyncHandler(async (req: Request, res: Response) => {
      const courseId = parseInt(req.params.courseId);
      if (isNaN(courseId)) {
        return res.status(400).json({ message: 'Invalid course ID' });
      }

      const students = await storage.listCourseEnrollments(courseId);
      res.json(students);
  }));

  app.get('/api/students', requireAuth, requireInstructor, asyncHandler(async (req: Request, res: Response) => {
      const students = await storage.listStudents();
      res.json(students);
  }));

  app.get('/api/students/progress/:assignmentId?', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      let page = 1;
      const pageSize = 10;
      const searchQuery = req.query.search as string || '';
      const statusFilter = req.query.status as string || 'all';

      if (req.query.page) {
        const parsedPage = parseInt(req.query.page as string, 10);
        if (!isNaN(parsedPage) && parsedPage > 0) {
          page = parsedPage;
        }
      }

      let assignmentId: number | undefined = undefined;
      if (req.params.assignmentId) {
        const parsedId = parseInt(req.params.assignmentId, 10);
        if (!isNaN(parsedId) && parsedId > 0) {
          assignmentId = parsedId;
        } else {
          console.warn(`Invalid assignmentId format: ${req.params.assignmentId}`);
        }
      }

      let students;
      let totalCount;

      if (assignmentId) {
        const assignment = await storage.getAssignment(assignmentId);
        if (!assignment) {
          return res.status(404).json({ message: 'Assignment not found' });
        }

        const enrolledStudents = await storage.listCourseEnrollments(assignment.courseId);
        const submissions = await storage.listSubmissionsForAssignment(assignmentId);

        const submissionsByStudent = submissions.reduce((acc, submission) => {
          if (!acc[submission.userId]) {
            acc[submission.userId] = [];
          }
          acc[submission.userId].push(submission);
          return acc;
        }, {} as Record<number, any[]>);

        students = enrolledStudents.map(student => {
          const studentSubmissions = submissionsByStudent[student.id] || [];
          const latestSubmission = studentSubmissions.length > 0 ?
            studentSubmissions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] :
            null;

          let status: 'submitted' | 'not_submitted' | 'needs_review' = 'not_submitted';

          if (latestSubmission) {
            if (latestSubmission.status === 'completed') {
              status = 'submitted';
            } else if (['pending', 'processing'].includes(latestSubmission.status)) {
              status = 'needs_review';
            }
          }

          return {
            id: student.id,
            name: student.name,
            email: student.email,
            status,
            lastSubmission: latestSubmission ? new Date(latestSubmission.createdAt).toLocaleString() : undefined,
            attempts: studentSubmissions.length,
            submissionId: latestSubmission ? latestSubmission.id : undefined
          };
        });

        totalCount = students.length;
      } else {
        // Use optimized method to get student progress with database-level aggregation
        const allStudentProgress = await storage.getStudentProgress();
        console.log(`[PERFORMANCE] Using optimized student progress query with database-level aggregation`);
        
        totalCount = allStudentProgress.length;

        students = allStudentProgress.slice((page - 1) * pageSize, page * pageSize).map((progress: any) => {
          let status: 'submitted' | 'not_submitted' | 'needs_review' = progress.submissionStatus === 'submitted' ? 'submitted' : 'not_submitted';
          
          return {
            id: progress.userId,
            name: progress.userName,
            email: progress.userEmail,
            status,
            lastSubmission: progress.latestSubmissionDate ? new Date(progress.latestSubmissionDate).toLocaleString() : undefined,
            attempts: progress.submissionCount || 0,
            submissionId: undefined // Not available in aggregated query
          };
        });
      }

      if (searchQuery) {
        students = students.filter((student: { name: string; email: string }) =>
          student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          student.email.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      if (statusFilter !== 'all') {
        students = students.filter((student: { status: string }) => student.status === statusFilter);
      }

      const filteredCount = students.length;
      const totalPages = Math.ceil(filteredCount / pageSize);

      const paginatedStudents = students.slice((page - 1) * pageSize, page * pageSize);

      res.json({
        students: paginatedStudents,
        totalCount: filteredCount,
        totalPages,
        currentPage: page
      });
  }));

  const { count: countFn } = await import('drizzle-orm');

  app.get('/api/assignments/stats', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      try {
      let courseId: number | undefined = undefined;
      let assignmentId: number | undefined = undefined;

      console.log("Stats query params:", req.query);

      try {
        if (req.query.courseId &&
            typeof req.query.courseId === 'string' &&
            req.query.courseId !== 'undefined' &&
            req.query.courseId !== 'null') {

          const parsedCourseId = parseInt(req.query.courseId, 10);
          if (!isNaN(parsedCourseId) && parsedCourseId > 0) {
            courseId = parsedCourseId;
            console.log("Using courseId:", courseId);
          } else {
            console.warn("Invalid courseId format:", req.query.courseId);
          }
        }

        if (req.query.assignmentId &&
            typeof req.query.assignmentId === 'string' &&
            req.query.assignmentId !== 'undefined' &&
            req.query.assignmentId !== 'null') {

          const parsedAssignmentId = parseInt(req.query.assignmentId, 10);
          if (!isNaN(parsedAssignmentId) && parsedAssignmentId > 0) {
            assignmentId = parsedAssignmentId;
            console.log("Using assignmentId:", assignmentId);
          } else {
            console.warn("Invalid assignmentId format:", req.query.assignmentId);
          }
        }
      } catch (e) {
        console.warn('Error parsing course/assignment IDs:', e);
      }

      // Use optimized single-query method for assignment statistics
      if (assignmentId) {
        console.log(`[PERFORMANCE] Using optimized assignment stats for assignment ${assignmentId}`);
        const stats = await storage.getAssignmentStats(assignmentId, courseId);
        return res.json(stats);
      }

      // For course-level stats, we still need to aggregate across assignments
      let allAssignments = await storage.listAssignments(courseId);
      console.log(`Total assignments for courseId ${courseId}: ${allAssignments.length}`);

      if (allAssignments.length === 0) {
        return res.json({
          totalStudents: 0,
          submittedCount: 0,
          notStartedCount: 0,
          submissionRate: 0,
          totalSubmissions: 0,
          pendingReviews: 0,
          averageScore: 0,
          feedbackGenerated: 0,
          feedbackViewed: 0,
          feedbackViewRate: 0,
          submissionsIncrease: 0,
          scoreDistribution: { high: 0, medium: 0, low: 0 },
          submittedPercentage: 0,
          notStartedPercentage: 0,
          feedbackViewPercentage: 0
        });
      }

      // For course-level stats, use optimized query with assignment IDs
      const assignmentIds = allAssignments.map(a => a.id);
      console.log(`[PERFORMANCE] Using optimized course-level stats query for ${assignmentIds.length} assignments`);

      const courseStatsQuery = sql`
        WITH course_stats AS (
          SELECT 
            COUNT(DISTINCT s.user_id) as submitted_count,
            COUNT(s.id) as total_submissions,
            COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.user_id END) as pending_reviews,
            AVG(CASE WHEN f.score IS NOT NULL AND f.score >= 0 AND f.score <= 100 THEN f.score END) as average_score,
            COUNT(f.id) as feedback_generated,
            COUNT(CASE WHEN f.viewed = true THEN f.id END) as feedback_viewed,
            COUNT(CASE WHEN f.score >= 80 THEN f.id END) as high_scores,
            COUNT(CASE WHEN f.score >= 50 AND f.score < 80 THEN f.id END) as medium_scores,
            COUNT(CASE WHEN f.score < 50 THEN f.id END) as low_scores,
            COUNT(CASE WHEN s.created_at >= NOW() - INTERVAL '7 days' THEN s.id END) as submissions_last_week,
            COUNT(CASE WHEN s.created_at >= NOW() - INTERVAL '14 days' AND s.created_at < NOW() - INTERVAL '7 days' THEN s.id END) as submissions_previous_week
          FROM submissions s
          LEFT JOIN feedback f ON s.id = f.submission_id
          WHERE s.assignment_id = ANY(${assignmentIds})
        ),
        student_count AS (
          SELECT 
            COUNT(DISTINCT u.id) as total_students
          FROM users u
          INNER JOIN enrollments e ON u.id = e.user_id
          WHERE e.course_id = ${courseId}
          AND u.role = 'student'
        )
        SELECT 
          sc.total_students,
          COALESCE(cs.submitted_count, 0) as submitted_count,
          COALESCE(cs.total_submissions, 0) as total_submissions,
          COALESCE(cs.pending_reviews, 0) as pending_reviews,
          COALESCE(ROUND(cs.average_score), 0) as average_score,
          COALESCE(cs.feedback_generated, 0) as feedback_generated,
          COALESCE(cs.feedback_viewed, 0) as feedback_viewed,
          COALESCE(cs.high_scores, 0) as high_scores,
          COALESCE(cs.medium_scores, 0) as medium_scores,
          COALESCE(cs.low_scores, 0) as low_scores,
          COALESCE(cs.submissions_last_week, 0) as submissions_last_week,
          COALESCE(cs.submissions_previous_week, 0) as submissions_previous_week
        FROM student_count sc
        LEFT JOIN course_stats cs ON true
      `;

      const result = await db.execute(courseStatsQuery);
      const stats = result.rows[0] as any;

      const totalStudents = Number(stats.total_students) || 0;
      const submittedCount = Number(stats.submitted_count) || 0;
      const totalSubmissions = Number(stats.total_submissions) || 0;
      const pendingReviews = Number(stats.pending_reviews) || 0;
      const averageScore = Number(stats.average_score) || 0;
      const feedbackGenerated = Number(stats.feedback_generated) || 0;
      const feedbackViewed = Number(stats.feedback_viewed) || 0;
      const submissionsLastWeek = Number(stats.submissions_last_week) || 0;
      const submissionsPreviousWeek = Number(stats.submissions_previous_week) || 0;

      const notStartedCount = Math.max(0, totalStudents - submittedCount);
      const submissionRate = totalStudents > 0 ? Math.round((submittedCount / totalStudents) * 100) : 0;
      const feedbackViewRate = feedbackGenerated > 0 ? Math.round((feedbackViewed / feedbackGenerated) * 100) : 0;
      const submissionsIncrease = submissionsPreviousWeek > 0 
        ? Math.round((submissionsLastWeek - submissionsPreviousWeek) / submissionsPreviousWeek * 100)
        : (submissionsLastWeek > 0 ? 100 : 0);

      const scoreDistribution = {
        high: Number(stats.high_scores) || 0,
        medium: Number(stats.medium_scores) || 0,
        low: Number(stats.low_scores) || 0
      };

      res.json({
        totalStudents,
        submittedCount,
        notStartedCount,
        submissionRate,
        totalSubmissions,
        pendingReviews,
        averageScore,
        feedbackGenerated,
        feedbackViewed,
        feedbackViewRate,
        submissionsIncrease,
        scoreDistribution,
        submittedPercentage: submissionRate,
        notStartedPercentage: totalStudents > 0 ? Math.round((notStartedCount / totalStudents) * 100) : 0,
        feedbackViewPercentage: feedbackViewRate
      });
      } catch (error) {
        console.error("Error in /api/assignments/stats:", error);
        // Return a default stats object in case of any unhandled error in the try block
        return res.json({
          totalStudents: 0,
          submittedCount: 0,
          notStartedCount: 0,
          submissionRate: 0,
          totalSubmissions: 0,
          pendingReviews: 0,
          averageScore: 0,
          feedbackGenerated: 0,
          feedbackViewed: 0,
          feedbackViewRate: 0,
          submissionsIncrease: 0,
          scoreDistribution: { high: 0, medium: 0, low: 0 },
          feedbackViewLast30Days: Array(30).fill(0), // These fields were in original, keeping for consistency
          submissionsLast30Days: Array(30).fill(0), // These fields were in original, keeping for consistency
          notStartedPercentage: 0,
          submittedPercentage: 0,
          feedbackViewPercentage: 0
        });
      }
  }));

  app.get('/api/assignments/:id?/analytics', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      let assignmentId: number | undefined = undefined;
      if (req.params.id) {
        const parsed = parseInt(req.params.id, 10);
        if (!isNaN(parsed) && parsed > 0) {
          assignmentId = parsed;
        } else {
          console.warn("Invalid assignment ID format:", req.params.id);
        }
      }

      let targetAssignmentId = assignmentId;

      if (!targetAssignmentId) {
        const activeAssignments = (await storage.listAssignments())
          .filter(a => a.status === 'active')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (activeAssignments.length === 0) {
          return res.status(404).json({ message: 'No active assignments found' });
        }

        targetAssignmentId = activeAssignments[0].id;
      }

      const assignment = await storage.getAssignment(targetAssignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      const submissions = await storage.listSubmissionsForAssignment(targetAssignmentId);
      const students = await storage.listCourseEnrollments(assignment.courseId);
      const totalStudents = students.length;

      const submittedStudentIds = new Set(submissions.map(s => s.userId));
      const submittedCount = submittedStudentIds.size;

      const inProgressStudents = new Map();

      for (const submission of submissions) {
        if (!inProgressStudents.has(submission.userId) ||
            new Date(submission.createdAt) > new Date(inProgressStudents.get(submission.userId).createdAt)) {
          inProgressStudents.set(submission.userId, submission);
        }
      }

      const inProgressCount = Array.from(inProgressStudents.values()).filter(
        s => s.status === 'pending' || s.status === 'processing'
      ).length;

      const notStartedCount = totalStudents - submittedCount;

      const timeline = [];
      const today = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const count = submissions.filter(
          s => new Date(s.createdAt) >= date && new Date(s.createdAt) < nextDate
        ).length;

        timeline.push({
          date: date.toISOString().split('T')[0],
          count
        });
      }

      const feedbackItems = await Promise.all(
        submissions.map(s => storage.getFeedbackBySubmissionId(s.id))
      );

      const validFeedback = feedbackItems.filter(f => f !== undefined) as any[];

      const avgFeedbackTime = validFeedback.length > 0
        ? Math.round(validFeedback.reduce((sum, f) => sum + (f.processingTime || 0), 0) / validFeedback.length / 1000) // Added fallback for processingTime
        : 0;

      const submissionsByStudent = submissions.reduce((acc, sub) => {
        if (!acc[sub.userId]) acc[sub.userId] = [];
        acc[sub.userId].push(sub);
        return acc;
      }, {} as Record<number, any[]>);

      const revisionsPerStudent = Object.values(submissionsByStudent)
        .map(subs => subs.length);

      const avgRevisionsPerStudent = revisionsPerStudent.length > 0
        ? revisionsPerStudent.reduce((sum, count) => sum + count, 0) / revisionsPerStudent.length
        : 0;

      const avgImprovementPercentage = 18; // This seems like a placeholder

      res.json({
        assignmentStats: {
          submittedCount,
          inProgressCount,
          notStartedCount,
          totalCount: totalStudents,
          submissionPercentage: totalStudents > 0 ? (submittedCount / totalStudents) * 100 : 0
        },
        submissionTimeline: timeline,
        avgFeedbackTime,
        avgRevisionsPerStudent,
        avgImprovementPercentage
      });
  }));

  app.post('/api/test-rubric', requireAuth, requireRole('instructor'),
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
      let content = req.body.content;
      const { assignmentContext } = req.body;
      let file = req.file;

      if (!content && !file) {
        return res.status(400).json({ message: 'Content or file is required' });
      }

      console.log(`[TEST-RUBRIC] Processing rubric test with ${file ? 'file upload' : 'text content'}`);
      if (file) {
        console.log(`[TEST-RUBRIC] File details: name=${file.originalname}, type=${file.mimetype}, size=${file.size} bytes`);
      }

      const aiService = new AIService(new GeminiAdapter()); // Consider making AI adapter configurable

      try {
        let feedback;

        if (file) {
          // Ensure we have a valid buffer to work with
          if (!file.buffer || file.buffer.length === 0) {
            console.error(`[TEST-RUBRIC] File buffer is empty or undefined`);
            return res.status(400).json({ 
              error: "Invalid file upload",
              message: "File upload failed - empty file",
              strengths: ["We could not process your file."],
              improvements: ["Please try uploading a different file."],
              suggestions: ["Ensure your file is not empty and is a supported type."],
              summary: "The uploaded file couldn't be processed. Please try again with a different file."
            });
          }

          // Determine file type based on mime type
          const isImage = file.mimetype.startsWith('image/');
          const isDocument = file.mimetype.includes('pdf') ||
                             file.mimetype.includes('word') || 
                             file.mimetype.includes('doc') ||
                             file.mimetype.includes('vnd.openxmlformats');

          if (isImage) {
            console.log(`[TEST-RUBRIC] Processing image file: ${file.originalname} (${file.mimetype}), size: ${file.buffer.length} bytes`);

            try {
              // Use a more conservative size limit for inline images
              const MAX_INLINE_SIZE = 4 * 1024 * 1024; // 4MB
              const isSmallImage = file.buffer.length < MAX_INLINE_SIZE;
              
              // For small images, use a data URI for more reliable processing
              const imageDataUri = isSmallImage
                ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
                : undefined;

              console.log(`[TEST-RUBRIC] Using ${isSmallImage ? 'data URI' : 'Files API'} for image processing`);

              feedback = await aiService.analyzeMultimodalSubmission({
                fileBuffer: file.buffer,
                fileDataUri: imageDataUri,
                fileName: file.originalname,
                mimeType: file.mimetype,
                assignmentTitle: "Image Analysis",
                assignmentDescription: assignmentContext || "Please analyze this image submission."
              });
            } catch (error: any) {
              console.error(`[TEST-RUBRIC] Error analyzing image: ${error.message || 'Unknown error'}`, error);
              return res.status(500).json({
                error: "Failed to analyze image",
                message: error.message || 'Unknown error',
                strengths: ["We encountered an error analyzing your image."],
                improvements: ["Please try a different image or a text submission."],
                suggestions: ["Make sure your image is a standard format (JPEG, PNG, etc)."],
                summary: "There was an error processing your image submission. For best results, try using a standard image format under 5MB."
              });
            }
          } else if (isDocument) {
            console.log(`[TEST-RUBRIC] Processing document file: ${file.originalname} (${file.mimetype}), size: ${file.buffer.length} bytes`);

            try {
              // For documents, always use the fileBuffer approach
              // The AIService will handle uploading to Files API internally
              feedback = await aiService.analyzeMultimodalSubmission({
                fileBuffer: file.buffer,
                fileName: file.originalname,
                mimeType: file.mimetype || 'application/octet-stream', // Fallback mime type if none provided
                assignmentTitle: "Document Analysis",
                assignmentDescription: assignmentContext || "Please analyze this document submission."
              });
              
              console.log(`[TEST-RUBRIC] Document analysis completed successfully`);
            } catch (error: any) {
              console.error(`[TEST-RUBRIC] Error analyzing document: ${error.message || 'Unknown error'}`, error);
              return res.status(500).json({
                error: "Failed to analyze document",
                message: error.message || 'Unknown error',
                strengths: ["We encountered an error analyzing your document."],
                improvements: ["Please try a different document format or a text submission."],
                suggestions: ["Make sure your document is a standard format (PDF, DOCX, etc)."],
                summary: "There was an error processing your document. For best results, try using a standard document format like PDF or DOCX under 5MB."
              });
            }
          } else { 
            // Handle text-based files or code files
            console.log(`[TEST-RUBRIC] Processing text/code file: ${file.originalname} (${file.mimetype})`);
            
            // Extract content from file if not already provided
            if (!content) {
              if (file.path && fs.existsSync(file.path)) {
                // For disk storage
                content = fs.readFileSync(file.path, 'utf8');
              } else if (file.buffer) {
                // For memory storage
                content = file.buffer.toString('utf8');
              }
            }
            
            if (!content || content.trim() === '') {
              console.error(`[TEST-RUBRIC] Could not extract text content from file`);
              return res.status(400).json({
                error: "Empty file content",
                message: "Could not extract text content from file",
                strengths: ["We couldn't extract any text from your file."],
                improvements: ["Please try uploading a text file or entering code directly."],
                suggestions: ["Make sure your file contains readable text."],
                summary: "The uploaded file didn't contain any readable text. Please try a different file or paste the content directly."
              });
            }

            feedback = await aiService.analyzeProgrammingAssignment({
              content: content,
              assignmentContext
            });
          }
        } else { // Only text content provided
          feedback = await aiService.analyzeProgrammingAssignment({
            content: content || "", // Ensure content is not undefined
            assignmentContext
          });
        }

        console.log("AI feedback generated successfully:", JSON.stringify(feedback).slice(0, 200) + "...");

        if (file && file.path && fs.existsSync(file.path)) { // Check if path exists before unlinking
          fs.unlink(file.path, (err: NodeJS.ErrnoException | null) => {
            if (err) console.error("Error removing temporary file:", err);
          });
        }

        return res.json({
          strengths: feedback.strengths,
          improvements: feedback.improvements,
          suggestions: feedback.suggestions,
          summary: feedback.summary,
          score: feedback.score
        });
      } catch (error) {
        console.error("Error generating AI feedback:", error);

        if (file && file.path && fs.existsSync(file.path)) { // Check if path exists
          fs.unlink(file.path, (err: NodeJS.ErrnoException | null) => {
            if (err) console.error("Error removing temporary file:", err);
          });
        }

        return res.status(500).json({
          message: 'Failed to generate AI feedback',
          error: error instanceof Error ? error.message : String(error)
        });
      }
  }));

  app.get('/api/export/grades', requireAuth, requireRole('instructor'), asyncHandler(async (req: Request, res: Response) => {
      const assignmentIdStr = req.query.assignmentId as string;
      if (!assignmentIdStr) {
        return res.status(400).json({ message: 'Assignment ID is required' });
      }
      const assignmentId = parseInt(assignmentIdStr);


      if (isNaN(assignmentId)) {
        return res.status(400).json({ message: 'Invalid Assignment ID format' });
      }

      const assignment = await storage.getAssignment(assignmentId);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }

      const course = await storage.getCourse(assignment.courseId);
      if (!course) {
        return res.status(404).json({ message: 'Course not found for this assignment' });
      }

      const students = await storage.listCourseEnrollments(assignment.courseId);
      const submissions = await storage.listSubmissionsForAssignment(assignmentId);

      const submissionsByStudent = submissions.reduce((acc, sub) => {
        if (!acc[sub.userId]) acc[sub.userId] = [];
        acc[sub.userId].push(sub);
        return acc;
      }, {} as Record<number, any[]>);

      const feedbackPromises = submissions.map(s => storage.getFeedbackBySubmissionId(s.id));
      const allFeedback = await Promise.all(feedbackPromises);

      const feedbackBySubmission = new Map();
      allFeedback.filter(Boolean).forEach(f => {
        if (f) { // Ensure f is not null or undefined
          feedbackBySubmission.set(f.submissionId, f);
        }
      });

      let csv = 'Student ID,Student Name,Student Email,Submission Status,Submission Date,Last Score,Attempts,Feedback Summary\n';

      for (const student of students) {
        const studentSubmissions = submissionsByStudent[student.id] || [];

        studentSubmissions.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const latestSubmission = studentSubmissions[0];

        let status = 'Not Submitted';
        let submissionDate = '';
        let score = '';
        let attempts = studentSubmissions.length.toString();
        let feedbackSummary = '';

        if (latestSubmission) {
          status = latestSubmission.status === 'completed' ? 'Completed' :
                   latestSubmission.status === 'processing' ? 'Processing' :
                   latestSubmission.status === 'pending' ? 'Pending' : 'Failed'; // Consider other statuses

          submissionDate = new Date(latestSubmission.createdAt).toLocaleString();

          const feedbackForLatest = feedbackBySubmission.get(latestSubmission.id);
          if (feedbackForLatest) {
            score = feedbackForLatest.score !== null ? feedbackForLatest.score.toString() : '';
            feedbackSummary = feedbackForLatest.summary ? feedbackForLatest.summary.replace(/"/g, '""') : ''; // Handle null summary
          }
        }

        csv += `${student.id},"${student.name}","${student.email}","${status}","${submissionDate}","${score}","${attempts}","${feedbackSummary}"\n`;
      }

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${course.code}_${assignment.title.replace(/\s+/g, '_')}_grades.csv"`);

      res.send(csv);
  }));

  const httpServer = createServer(app);

  return httpServer;
}