import { AssignmentStatusService } from './assignment-status-service';

export class AssignmentScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the automatic assignment status update scheduler
   * Runs every hour to update assignment statuses based on due dates
   */
  start(intervalMinutes: number = 60): void {
    if (this.isRunning) {
      console.log('[ASSIGNMENT-SCHEDULER] Scheduler already running');
      return;
    }

    console.log(`[ASSIGNMENT-SCHEDULER] Starting automatic status updates every ${intervalMinutes} minutes`);
    
    // Run immediately on start
    this.runStatusUpdate();
    
    // Schedule recurring updates
    this.intervalId = setInterval(() => {
      this.runStatusUpdate();
    }, intervalMinutes * 60 * 1000);
    
    this.isRunning = true;
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('[ASSIGNMENT-SCHEDULER] Scheduler stopped');
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Run a status update cycle
   */
  private async runStatusUpdate(): Promise<void> {
    try {
      console.log('[ASSIGNMENT-SCHEDULER] Running automatic status update cycle');
      
      const result = await AssignmentStatusService.updateAllAssignmentStatuses(false);
      
      if (result.updated > 0) {
        console.log(`[ASSIGNMENT-SCHEDULER] Updated ${result.updated} assignment statuses:`, 
          result.changes.map(c => `${c.title}: ${c.oldStatus} → ${c.newStatus}`));
      } else {
        console.log('[ASSIGNMENT-SCHEDULER] No assignments needed status updates');
      }
    } catch (error) {
      console.error('[ASSIGNMENT-SCHEDULER] Error during automatic status update:', error);
    }
  }

  /**
   * Get status information
   */
  getStatus(): {
    isRunning: boolean;
    nextRunTime?: Date;
    lastRunTime?: Date;
  } {
    return {
      isRunning: this.isRunning,
      // In a real implementation, you'd track these
      nextRunTime: this.isRunning ? new Date(Date.now() + 60 * 60 * 1000) : undefined,
      lastRunTime: undefined
    };
  }
}

// Export singleton instance
export const assignmentScheduler = new AssignmentScheduler();