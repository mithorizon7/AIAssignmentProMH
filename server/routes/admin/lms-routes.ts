/**
 * LMS Integration API Routes
 * 
 * Defines the routes for managing LMS integrations:
 * - Testing connections
 * - Managing credentials
 * - Synchronizing data between the LMS and local system
 */

import express from 'express';
import { Router, Request, Response } from 'express';
import {
  testLmsConnection,
  getLmsCredentials,
  createLmsCredentials,
  updateLmsCredentials,
  deleteLmsCredentials,
  startLmsSync,
  getSyncJobStatus
} from '../../controllers/lms-controller';

const router = express.Router();

// Note: Authentication is already handled by the parent admin router

// LMS credential management
router.get('/credentials', getLmsCredentials);
router.post('/credentials', createLmsCredentials);
router.put('/credentials/:id', updateLmsCredentials);
router.delete('/credentials/:id', deleteLmsCredentials);

// LMS connection testing
router.post('/test-connection', testLmsConnection);

// LMS synchronization
router.post('/sync', startLmsSync);
router.get('/sync/:id', getSyncJobStatus);

export default router;