/**
 * LMS Controller
 * 
 * Handles API requests related to LMS integration:
 * - Testing connections
 * - Managing credentials
 * - Initiating synchronization jobs
 */

import { Request, Response } from 'express';
import { db } from '../db';
import { 
  lmsCredentials, 
  lmsSyncJobs, 
  lmsCourseMappings,
  insertLmsCredentialsSchema 
} from '../../shared/schema';
import { lmsServiceFactory } from '../services/lms/lms-service-factory';
import { eq } from 'drizzle-orm';

/**
 * Test connection to an LMS
 * POST /api/admin/lms/test-connection
 */
export async function testLmsConnection(req: Request, res: Response) {
  try {
    // Validate the request body against our schema
    const validation = insertLmsCredentialsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credential data', 
        errors: validation.error.errors 
      });
    }
    
    // Create a temporary credential (not saved to database yet)
    const credential = {
      ...validation.data,
      id: 0, // Temporary ID
      active: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Create the appropriate service for this provider
    const lmsService = lmsServiceFactory.createService(credential);
    
    // Test the connection
    const testResult = await lmsService.testConnection(credential);
    
    return res.status(200).json(testResult);
  } catch (error) {
    console.error('Error testing LMS connection:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error testing connection: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

/**
 * Get all LMS credentials
 * GET /api/admin/lms/credentials
 */
export async function getLmsCredentials(req: Request, res: Response) {
  try {
    const credentials = await db.select().from(lmsCredentials);
    
    // Mask secrets
    const maskedCredentials = credentials.map(cred => ({
      ...cred,
      clientSecret: cred.clientSecret.replace(/./g, '•')
    }));
    
    return res.status(200).json(maskedCredentials);
  } catch (error) {
    console.error('Error fetching LMS credentials:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error fetching credentials: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

/**
 * Create new LMS credentials
 * POST /api/admin/lms/credentials
 */
export async function createLmsCredentials(req: Request, res: Response) {
  try {
    // Validate the request body against our schema
    const validation = insertLmsCredentialsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credential data', 
        errors: validation.error.errors 
      });
    }
    
    // Get user ID from the authenticated user
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Insert the new credentials
    const [credential] = await db.insert(lmsCredentials).values({
      ...validation.data,
      createdBy: userId,
      active: true
    }).returning();
    
    // Mask the client secret before returning
    const maskedCredential = {
      ...credential,
      clientSecret: credential.clientSecret.replace(/./g, '•')
    };
    
    return res.status(201).json(maskedCredential);
  } catch (error) {
    console.error('Error creating LMS credentials:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error creating credentials: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

/**
 * Update LMS credentials
 * PUT /api/admin/lms/credentials/:id
 */
export async function updateLmsCredentials(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credential ID'
      });
    }
    
    // Validate the request body against our schema
    const validation = insertLmsCredentialsSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid credential data', 
        errors: validation.error.errors 
      });
    }
    
    // Check if the credential exists
    const existing = await db.select().from(lmsCredentials).where(eq(lmsCredentials.id, id));
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'LMS credentials not found'
      });
    }
    
    // Update the credentials
    const [updatedCredential] = await db.update(lmsCredentials)
      .set({
        ...validation.data,
        updatedAt: new Date()
      })
      .where(eq(lmsCredentials.id, id))
      .returning();
    
    // Mask the client secret before returning
    const maskedCredential = {
      ...updatedCredential,
      clientSecret: updatedCredential.clientSecret.replace(/./g, '•')
    };
    
    return res.status(200).json(maskedCredential);
  } catch (error) {
    console.error('Error updating LMS credentials:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error updating credentials: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

/**
 * Delete LMS credentials
 * DELETE /api/admin/lms/credentials/:id
 */
export async function deleteLmsCredentials(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid credential ID'
      });
    }
    
    // Check if the credential exists
    const existing = await db.select().from(lmsCredentials).where(eq(lmsCredentials.id, id));
    
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'LMS credentials not found'
      });
    }
    
    // Delete the credentials
    await db.delete(lmsCredentials).where(eq(lmsCredentials.id, id));
    
    return res.status(200).json({
      success: true,
      message: 'LMS credentials deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting LMS credentials:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error deleting credentials: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

/**
 * Start a sync job for grades or roster
 * POST /api/admin/lms/sync
 */
export async function startLmsSync(req: Request, res: Response) {
  try {
    const { credentialId, courseId, syncType } = req.body;
    
    if (!credentialId || !courseId || !syncType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: credentialId, courseId, and syncType are required'
      });
    }
    
    // Validate syncType
    if (!['grades', 'roster'].includes(syncType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid syncType. Must be "grades" or "roster"'
      });
    }
    
    // Get user ID from the authenticated user
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    // Get the credential
    const [credential] = await db.select().from(lmsCredentials).where(eq(lmsCredentials.id, credentialId));
    
    if (!credential) {
      return res.status(404).json({
        success: false,
        message: 'LMS credentials not found'
      });
    }
    
    // Get the course mapping
    const [mapping] = await db.select()
      .from(lmsCourseMappings)
      .where(eq(lmsCourseMappings.courseId, courseId))
      .where(eq(lmsCourseMappings.credentialId, credentialId));
    
    if (!mapping) {
      return res.status(404).json({
        success: false,
        message: 'Course mapping not found'
      });
    }
    
    // Create a new sync job record
    const [syncJob] = await db.insert(lmsSyncJobs).values({
      credentialId,
      syncType,
      status: 'pending',
      syncData: { courseId, lmsCourseId: mapping.lmsCourseId },
      createdBy: userId
    }).returning();
    
    // In a production system, we would now trigger an async job
    // to actually perform the sync. For this implementation, we'll
    // simulate that by just returning the job record.
    
    return res.status(201).json({
      success: true,
      message: `LMS ${syncType} sync job created`,
      syncJob
    });
  } catch (error) {
    console.error('Error starting LMS sync:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error starting sync: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}

/**
 * Get sync job status
 * GET /api/admin/lms/sync/:id
 */
export async function getSyncJobStatus(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid sync job ID'
      });
    }
    
    // Get the sync job
    const [syncJob] = await db.select().from(lmsSyncJobs).where(eq(lmsSyncJobs.id, id));
    
    if (!syncJob) {
      return res.status(404).json({
        success: false,
        message: 'Sync job not found'
      });
    }
    
    return res.status(200).json(syncJob);
  } catch (error) {
    console.error('Error getting sync job status:', error);
    return res.status(500).json({ 
      success: false, 
      message: `Error getting sync status: ${error instanceof Error ? error.message : String(error)}` 
    });
  }
}