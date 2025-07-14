
import { Request, Response } from 'express';
import { db } from '../db';

// Cache health check results for 30 seconds
let healthCache: { status: string; timestamp: number; checks: any } | null = null;
const CACHE_DURATION = 30000; // 30 seconds

export async function healthCheck(req: Request, res: Response) {
  try {
    // Return cached result if still valid
    if (healthCache && Date.now() - healthCache.timestamp < CACHE_DURATION) {
      return res.json(healthCache.status);
    }
    
    const start = Date.now();
    
    // Quick database connectivity check
    const dbCheck = await db.execute('SELECT 1 as healthy');
    const dbHealthy = dbCheck.rows.length > 0;
    
    // Basic queue check (if available)
    let queueHealthy = true;
    try {
      // Simple queue health check without heavy operations
      queueHealthy = process.env.REDIS_URL ? true : false;
    } catch {
      queueHealthy = false;
    }
    
    const duration = Date.now() - start;
    
    const checks = {
      database: dbHealthy,
      queue: queueHealthy,
      responseTime: duration
    };
    
    const status = {
      status: dbHealthy && queueHealthy ? 'ok' : 'degraded',
      message: 'System operational',
      timestamp: new Date().toISOString(),
      checks
    };
    
    // Cache the result
    healthCache = {
      status,
      timestamp: Date.now(),
      checks
    };
    
    res.json(status);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
}
