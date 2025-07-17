import { db } from "../db";
import { assignments } from "../../shared/schema";
import { eq, and, or, lte, gte } from "drizzle-orm";

export class AssignmentStatusService {
  /**
   * Calculate what the status should be based on current date, available date, and due date
   */
  static calculateStatusByDate(availableAt: Date, dueDate: Date): 'upcoming' | 'active' | 'completed' {
    const now = new Date();
    const availableAtObj = new Date(availableAt);
    const dueDateObj = new Date(dueDate);
    
    // upcoming: Assignment has not yet opened for submissions
    if (now < availableAtObj) {
      return 'upcoming';
    }
    
    // active: Assignment is open for submissions and before due date
    if (now >= availableAtObj && now <= dueDateObj) {
      return 'active';
    }
    
    // completed: Assignment is past due date
    return 'completed';
  }

  /**
   * Get the effective status for an assignment (checks both manual status and calculated status)
   */
  static getEffectiveStatus(assignment: { status: string; availableAt: Date; dueDate: Date }, preferAutomated: boolean = true): 'upcoming' | 'active' | 'completed' {
    const calculatedStatus = this.calculateStatusByDate(assignment.availableAt, assignment.dueDate);
    
    if (preferAutomated) {
      return calculatedStatus;
    }
    
    // Use manual status if it makes sense, otherwise fall back to calculated
    const manualStatus = assignment.status as 'upcoming' | 'active' | 'completed';
    
    // If manual status is reasonable given the dates, use it
    // Otherwise use calculated status
    const now = new Date();
    const availableAt = new Date(assignment.availableAt);
    const dueDate = new Date(assignment.dueDate);
    
    if (manualStatus === 'completed' && now > dueDate) {
      return 'completed'; // Manual completed status after due date is reasonable
    }
    
    if (manualStatus === 'active' && now >= availableAt && now <= dueDate) {
      return 'active'; // Manual active status when submissions are open is reasonable
    }
    
    if (manualStatus === 'upcoming' && now < availableAt) {
      return 'upcoming'; // Manual upcoming status before available date is reasonable
    }
    
    // Fall back to calculated status if manual doesn't make sense
    return calculatedStatus;
  }

  /**
   * Update assignment statuses based on current date
   */
  static async updateAllAssignmentStatuses(dryRun: boolean = false): Promise<{
    updated: number;
    changes: Array<{
      id: number;
      title: string;
      oldStatus: string;
      newStatus: string;
      dueDate: Date;
    }>;
  }> {
    try {
      console.log(`[ASSIGNMENT-STATUS] ${dryRun ? 'Dry run: ' : ''}Starting automatic status update`);
      
      // Get all assignments
      const allAssignments = await db.select().from(assignments);
      
      const changes: Array<{
        id: number;
        title: string;
        oldStatus: string;
        newStatus: string;
        dueDate: Date;
      }> = [];
      
      for (const assignment of allAssignments) {
        const currentStatus = assignment.status;
        // Use availableAt (which now exists in the database)
        const availableAt = assignment.availableAt;
        const calculatedStatus = this.calculateStatusByDate(availableAt, assignment.dueDate);
        
        if (currentStatus !== calculatedStatus) {
          changes.push({
            id: assignment.id,
            title: assignment.title,
            oldStatus: currentStatus,
            newStatus: calculatedStatus,
            dueDate: assignment.dueDate
          });
          
          if (!dryRun) {
            await db.update(assignments)
              .set({ 
                status: calculatedStatus,
                updatedAt: new Date()
              })
              .where(eq(assignments.id, assignment.id));
          }
        }
      }
      
      console.log(`[ASSIGNMENT-STATUS] ${dryRun ? 'Would update' : 'Updated'} ${changes.length} assignments`);
      
      return {
        updated: changes.length,
        changes
      };
    } catch (error) {
      console.error('[ASSIGNMENT-STATUS] Error updating assignment statuses:', error);
      throw error;
    }
  }

  /**
   * Update a specific assignment's status based on its due date
   */
  static async updateAssignmentStatus(assignmentId: number, force: boolean = false): Promise<{
    updated: boolean;
    oldStatus?: string;
    newStatus?: string;
  }> {
    try {
      const [assignment] = await db.select()
        .from(assignments)
        .where(eq(assignments.id, assignmentId));
      
      if (!assignment) {
        throw new Error(`Assignment ${assignmentId} not found`);
      }
      
      const calculatedStatus = this.calculateStatusByDate(assignment.dueDate);
      
      if (assignment.status === calculatedStatus && !force) {
        return { updated: false };
      }
      
      await db.update(assignments)
        .set({ 
          status: calculatedStatus,
          updatedAt: new Date()
        })
        .where(eq(assignments.id, assignmentId));
      
      console.log(`[ASSIGNMENT-STATUS] Updated assignment ${assignmentId} from ${assignment.status} to ${calculatedStatus}`);
      
      return {
        updated: true,
        oldStatus: assignment.status,
        newStatus: calculatedStatus
      };
    } catch (error) {
      console.error(`[ASSIGNMENT-STATUS] Error updating assignment ${assignmentId}:`, error);
      throw error;
    }
  }

  /**
   * Get assignments grouped by their effective status (calculated from dates)
   */
  static async getAssignmentsByEffectiveStatus(preferAutomated: boolean = true): Promise<{
    upcoming: any[];
    active: any[];
    completed: any[];
  }> {
    try {
      const allAssignments = await db.select().from(assignments);
      
      const grouped = {
        upcoming: [] as any[],
        active: [] as any[],
        completed: [] as any[]
      };
      
      for (const assignment of allAssignments) {
        const effectiveStatus = this.getEffectiveStatus(assignment, preferAutomated);
        grouped[effectiveStatus].push({
          ...assignment,
          effectiveStatus,
          calculatedStatus: this.calculateStatusByDate(assignment.dueDate),
          manualStatus: assignment.status
        });
      }
      
      return grouped;
    } catch (error) {
      console.error('[ASSIGNMENT-STATUS] Error grouping assignments by effective status:', error);
      throw error;
    }
  }
}