import { format, formatDistanceToNow, formatDistance, isPast, parseISO } from 'date-fns';

/**
 * Safely parses a date string to a Date object using a more robust approach than just `new Date()`
 * @param date Date string or Date object
 * @returns A valid Date object or null if parsing fails
 */
function parseDate(date: string | Date | undefined | null): Date | null {
  if (!date) return null;
  
  try {
    // If it's already a Date object, just return it
    if (date instanceof Date) {
      return isNaN(date.getTime()) ? null : date;
    }
    
    // First try parseISO as it handles ISO 8601 dates correctly across browsers
    try {
      const parsedDate = parseISO(date);
      // Validate the parsed date
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    } catch (isoError) {
      // parseISO failed, continue to fallback
    }
    
    // Fallback to standard Date constructor with additional validation
    const fallbackDate = new Date(date);
    return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
  } catch (error) {
    console.error('Error parsing date:', error, { input: date });
    return null;
  }
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return 'Not set';
  
  try {
    const dateObj = parseDate(date);
    if (!dateObj) {
      return 'Invalid date';
    }
    return format(dateObj, 'MMM d, yyyy - h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error, { input: date });
    return 'Invalid date';
  }
}

export function formatShortDate(date: string | Date | undefined | null): string {
  if (!date) return 'Not set';
  
  try {
    const dateObj = parseDate(date);
    if (!dateObj) {
      return 'Invalid date';
    }
    return format(dateObj, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting short date:', error, { input: date });
    return 'Invalid date';
  }
}

export function formatTimeRemaining(dueDate: string | Date | undefined | null): string {
  if (!dueDate) return 'No due date';
  
  try {
    const dateObj = parseDate(dueDate);
    if (!dateObj) {
      return 'Invalid due date';
    }
    
    if (isPast(dateObj)) {
      return 'Past due';
    }
    
    const timeRemaining = formatDistance(dateObj, new Date(), { addSuffix: false });
    return `${timeRemaining} remaining`;
  } catch (error) {
    console.error('Error formatting time remaining:', error, { input: dueDate });
    return 'Invalid due date';
  }
}

export function getTimeAgo(date: string | Date | undefined | null): string {
  if (!date) return 'Unknown time';
  
  try {
    const dateObj = parseDate(date);
    if (!dateObj) {
      return 'Invalid date';
    }
    
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    console.error('Error getting time ago:', error, { input: date });
    return 'Invalid date';
  }
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatProcessingTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

export function getUserInitials(name: string): string {
  if (!name) return '';
  
  const parts = name.split(' ');
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// formatFileSize has been moved to utils/file.ts to avoid duplication
