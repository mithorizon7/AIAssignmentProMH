/**
 * LMS Service Factory
 * 
 * This factory creates the appropriate LMS service implementation
 * based on the provider type specified in the credentials.
 */

import { LmsCredential } from '../../../shared/schema';
import { BaseLmsService } from './base-lms-service';
import { CanvasService } from './canvas-service';
import { BlackboardService } from './blackboard-service';

class LmsServiceFactory {
  /**
   * Create an instance of the appropriate LMS service based on the provider
   */
  createService(credential: LmsCredential): BaseLmsService {
    switch (credential.provider) {
      case 'canvas':
        return new CanvasService(credential);
      case 'blackboard':
        return new BlackboardService(credential);
      case 'moodle':
        // For now, we'll throw an error for unimplemented providers
        // In the future, we would implement MoodleService
        throw new Error('Moodle LMS integration is not yet implemented');
      case 'd2l':
        // For now, we'll throw an error for unimplemented providers
        // In the future, we would implement D2LService
        throw new Error('D2L Brightspace integration is not yet implemented');
      default:
        throw new Error(`Unknown LMS provider: ${credential.provider}`);
    }
  }
}

// Export a singleton instance
export const lmsServiceFactory = new LmsServiceFactory();