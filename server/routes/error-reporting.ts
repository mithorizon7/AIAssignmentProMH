import express from 'express';
import { asyncHandler } from '../lib/error-handler';
import { z } from 'zod';

const router = express.Router();

// Schema for error reporting
const errorReportSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  errorId: z.string(),
  timestamp: z.string(),
  userAgent: z.string(),
  url: z.string(),
  userId: z.number().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
});

// Endpoint for client-side error reporting
router.post('/errors', asyncHandler(async (req, res) => {
  try {
    const errorData = errorReportSchema.parse(req.body);
    
    // In production, this would send to error monitoring service
    // For now, log to console with structured logging
    console.error('Client-side error reported:', {
      errorId: errorData.errorId,
      message: errorData.message,
      url: errorData.url,
      timestamp: errorData.timestamp,
      userAgent: errorData.userAgent,
      userId: errorData.userId,
      severity: errorData.severity
    });
    
    // In production, you would:
    // 1. Send to error monitoring service (Sentry, LogRocket, etc.)
    // 2. Store in database for analysis
    // 3. Alert if critical error
    // 4. Increment error metrics
    
    res.json({ success: true, errorId: errorData.errorId });
  } catch (error) {
    console.error('Failed to process error report:', error);
    res.status(400).json({ 
      success: false, 
      message: 'Invalid error report format' 
    });
  }
}));

export default router;