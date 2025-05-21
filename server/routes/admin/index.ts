/**
 * Admin Routes Index
 * 
 * This file serves as the entry point for all admin-related routes.
 * It combines routes from various admin modules into a single router.
 */

import { Router } from 'express';
import adminBaseRoutes from '../admin'; // Import the existing admin routes
import lmsRoutes from './lms-routes'; // Import the new LMS routes

const router = Router();

// Mount the existing admin routes
router.use('/', adminBaseRoutes);

// Mount the LMS routes
router.use('/lms', lmsRoutes);

export default router;